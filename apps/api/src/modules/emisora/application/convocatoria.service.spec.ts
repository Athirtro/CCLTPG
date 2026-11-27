import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditPort } from '../../../shared/audit/audit.port.js';
import type { DomainEvent } from '../../../shared/events/outbox.port.js';
import type { IdempotencyStore } from '../../../shared/idempotency/idempotency.port.js';
import type { ActorContext } from './emisora.types.js';
import { ConvocatoriaService } from './convocatoria.service.js';
import { EmisoraError } from './emisora-error.js';
import type { EmisoraRepository } from './ports/emisora.repository.js';
import type { EmisoraTransactionContext, EmisoraUnitOfWork } from './ports/unit-of-work.js';

type RegistroAuditoria = Parameters<AuditPort['record']>[0];

const ACTOR: ActorContext = {
  userId: 'actor-1',
  actorProfile: 'jefe_emisora',
  permissions: ['emisora:informe:create', 'emisora:incentivo:update'],
  ip: '127.0.0.1',
  userAgent: 'vitest-emisora',
  requestId: 'request-1',
};

function nuevoEstado(): {
  audit: RegistroAuditoria[];
  outbox: DomainEvent[];
  tx: EmisoraTransactionContext;
  uow: EmisoraUnitOfWork;
} {
  const audit: RegistroAuditoria[] = [];
  const outbox: DomainEvent[] = [];
  const tx = {
    emisora: {} as EmisoraRepository,
    audit: {
      record: vi.fn().mockImplementation((entry: RegistroAuditoria) => {
        audit.push(entry);
        return Promise.resolve();
      }),
    },
    outbox: {
      enqueue: vi.fn().mockImplementation((event: DomainEvent) => {
        outbox.push(event);
        return Promise.resolve();
      }),
    },
  } as unknown as EmisoraTransactionContext;
  const uow = {
    run: <T>(callback: (context: EmisoraTransactionContext) => Promise<T>) => callback(tx),
  };
  return { audit, outbox, tx, uow };
}

function idempotencia(): IdempotencyStore {
  return {
    reserve: vi.fn().mockResolvedValue({ status: 'nuevo', id: 'reserva-1' }),
    complete: vi.fn().mockResolvedValue(undefined),
    abandon: vi.fn().mockResolvedValue(undefined),
    purgeExpired: vi.fn().mockResolvedValue(0),
  };
}

function repositorioBase() {
  return {
    findProyectoById: vi.fn().mockResolvedValue({
      id: 'proyecto-1',
      convocatoriaId: 'convocatoria-1',
      realizadorId: 'realizador-1',
      titulo: 'Proyecto',
      archivoId: 'archivo-1',
      fechaRecepcion: '2026-01-20',
      estado: 'recibido',
      creadoEn: new Date(),
    }),
    findRealizadorById: vi.fn().mockResolvedValue({
      id: 'realizador-1',
      usuarioId: 'usuario-identidad-1',
      nombres: 'Ana',
      apellidos: 'Pérez',
      municipio: null,
      creadoEn: new Date(),
    }),
    findConvocatoriaById: vi.fn().mockResolvedValue({
      id: 'convocatoria-1',
      anio: 2025,
      fechaApertura: '2025-01-15',
      fechaCierre: '2025-02-05',
      estado: 'cerrada',
      basesArchivoId: null,
      creadoEn: new Date(),
    }),
    findRejillaByAnio: vi.fn().mockResolvedValue({
      id: 'rejilla-1',
      anio: 2025,
      comiteId: 'comite-1',
      estado: 'aprobada',
      aprobadaEn: new Date(),
      creadoEn: new Date(),
    }),
    createInforme: vi
      .fn()
      .mockImplementation(
        (input: {
          id: string;
          proyectoId: string;
          realizadorId: string;
          fechaInforme: string;
          archivoId: string;
        }) =>
          Promise.resolve({
            id: input.id,
            proyectoId: input.proyectoId,
            realizadorId: input.realizadorId,
            fechaInforme: input.fechaInforme,
            estado: 'recibido' as const,
            archivoId: input.archivoId,
            creadoEn: new Date(),
          }),
      ),
    createIncentivo: vi
      .fn()
      .mockImplementation(
        (input: { id: string; informeId: string; comiteId: string | null; realizadorId: string }) =>
          Promise.resolve({
            id: input.id,
            informeId: input.informeId,
            comiteId: input.comiteId,
            realizadorId: input.realizadorId,
            estado: 'calificado' as const,
            calificacion: null,
            referenciaCdp: null,
            creadoEn: new Date(),
          }),
      ),
  };
}

function crearServicio(repositorio: object, uow: EmisoraUnitOfWork): ConvocatoriaService {
  return new ConvocatoriaService(
    repositorio as unknown as EmisoraRepository,
    uow,
    idempotencia(),
    {} as never,
    {} as never,
    {} as never,
    {
      findById: vi.fn().mockResolvedValue({
        id: 'archivo-1',
        mime: 'application/pdf',
        estadoEscaneo: 'limpio',
      }),
    },
    {} as never,
  );
}

function incentivoEn(estado: string) {
  return {
    findIncentivoById: vi.fn().mockResolvedValue({
      id: 'incentivo-1',
      informeId: 'informe-1',
      comiteId: 'comite-1',
      realizadorId: 'realizador-1',
      estado,
      calificacion: estado === 'calificado' ? null : 85,
      referenciaCdp: null,
      creadoEn: new Date(),
    }),
    findRealizadorById: vi.fn().mockResolvedValue({
      id: 'realizador-1',
      usuarioId: 'usuario-identidad-1',
      nombres: 'Ana',
      apellidos: 'Pérez',
      municipio: null,
      creadoEn: new Date(),
    }),
    updateIncentivo: vi.fn().mockImplementation((id: string, _from: string, to: string) =>
      Promise.resolve({
        id,
        informeId: 'informe-1',
        comiteId: 'comite-1',
        realizadorId: 'realizador-1',
        estado: to,
        calificacion: 85,
        referenciaCdp: null,
        creadoEn: new Date(),
      }),
    ),
  };
}

describe('ConvocatoriaService — outbox y transiciones de incentivo', () => {
  let estado: ReturnType<typeof nuevoEstado>;

  beforeEach(() => {
    estado = nuevoEstado();
  });

  it('notifica a la cuenta de identidad del realizador, no a su id de emisora', async () => {
    const repositorio = repositorioBase();
    estado.tx.emisora = repositorio as unknown as EmisoraRepository;
    const servicio = crearServicio(repositorio, estado.uow);

    await servicio.createInforme(
      {
        proyectoId: 'proyecto-1',
        fechaInforme: '2025-10-15',
        archivoId: 'archivo-1',
        observaciones: null,
      },
      ACTOR,
      'clave-informe-1',
    );

    expect(repositorio.findRejillaByAnio).toHaveBeenCalledWith(2025);
    expect(estado.outbox).toHaveLength(1);
    expect(estado.outbox[0]).toMatchObject({
      tipo: 'informe.recibido',
      usuarioIds: ['usuario-identidad-1'],
    });
  });

  it.each([
    {
      desde: 'calificado',
      to: 'asignado' as const,
      accion: 'incentivo.asignado',
      evento: 'incentivo.asignado',
      calificacion: 85,
      referenciaCdp: null,
    },
    {
      desde: 'asignado',
      to: 'resuelto' as const,
      accion: 'resolucion.generada',
      evento: 'resolucion.generada',
      calificacion: 85,
      referenciaCdp: 'CDP-2025-01',
    },
    {
      desde: 'asignado',
      to: 'solicitud_cdp' as const,
      accion: 'incentivo.cdp_solicitado',
      evento: null,
      calificacion: null,
      referenciaCdp: null,
    },
  ])('registra $to con el evento contractual correcto', async (caso) => {
    const repositorio = incentivoEn(caso.desde);
    estado.tx.emisora = repositorio as unknown as EmisoraRepository;
    const servicio = crearServicio(repositorio, estado.uow);

    await servicio.updateIncentivo(
      'incentivo-1',
      { to: caso.to, calificacion: caso.calificacion, referenciaCdp: caso.referenciaCdp },
      ACTOR,
    );

    expect(repositorio.updateIncentivo).toHaveBeenCalledWith(
      'incentivo-1',
      caso.desde,
      caso.to,
      caso.calificacion,
      caso.referenciaCdp,
    );
    expect(estado.audit[0]?.accion).toBe(caso.accion);
    if (caso.evento === null) {
      expect(estado.outbox).toHaveLength(0);
    } else {
      expect(estado.outbox).toMatchObject([
        { tipo: caso.evento, usuarioIds: ['usuario-identidad-1'] },
      ]);
    }
  });

  it('omite el destinatario cuando el realizador no tiene cuenta de identidad', async () => {
    const repositorio = incentivoEn('calificado');
    repositorio.findRealizadorById = vi.fn().mockResolvedValue({
      id: 'realizador-1',
      usuarioId: null,
      nombres: 'Ana',
      apellidos: 'Pérez',
      municipio: null,
      creadoEn: new Date(),
    });
    estado.tx.emisora = repositorio as unknown as EmisoraRepository;
    const servicio = crearServicio(repositorio, estado.uow);

    await servicio.updateIncentivo(
      'incentivo-1',
      { to: 'asignado', calificacion: 80, referenciaCdp: null },
      ACTOR,
    );

    expect(estado.outbox).toHaveLength(1);
    expect(estado.outbox[0]?.usuarioIds).toBeUndefined();
  });

  it('rechaza el informe fuera de ventana con el código contractual', async () => {
    const repositorio = repositorioBase();
    estado.tx.emisora = repositorio as unknown as EmisoraRepository;
    const servicio = crearServicio(repositorio, estado.uow);

    await expect(
      servicio.createInforme(
        {
          proyectoId: 'proyecto-1',
          fechaInforme: '2025-09-30',
          archivoId: 'archivo-1',
          observaciones: null,
        },
        ACTOR,
        'clave-informe-fuera',
      ),
    ).rejects.toMatchObject({ code: 'EMISORA_FUERA_VENTANA_INFORME' });
  });

  it('no registra auditoría cuando el estado de origen ya no es válido', async () => {
    const repositorio = incentivoEn('resuelto');
    estado.tx.emisora = repositorio as unknown as EmisoraRepository;
    const servicio = crearServicio(repositorio, estado.uow);

    await expect(
      servicio.updateIncentivo(
        'incentivo-1',
        { to: 'asignado', calificacion: 80, referenciaCdp: null },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(EmisoraError);
    expect(estado.audit).toHaveLength(0);
    expect(estado.outbox).toHaveLength(0);
  });
});
