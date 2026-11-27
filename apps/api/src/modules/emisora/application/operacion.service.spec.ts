import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditPort } from '../../../shared/audit/audit.port.js';
import type { DomainEvent } from '../../../shared/events/outbox.port.js';
import type { FileDirectory } from '../../../shared/integration/file-directory.port.js';
import type { IdempotencyStore } from '../../../shared/idempotency/idempotency.port.js';
import { cumpleAntelacionMifi } from '../domain/emisora-rules.js';
import { canTransicionarE3 } from '../domain/emisora-states.js';
import { EMISORA_ERRORS } from './emisora-error.js';
import type { ActorContext } from './emisora.types.js';
import { EmisoraOperacionService } from './operacion.service.js';
import type { EmisoraReportExporter } from './ports/report-exporter.port.js';
import type {
  EmisoraRepository,
  NewPrestamoMifi,
  NewResolucion,
  NewViatico,
} from './ports/emisora.repository.js';
import type { EmisoraTransactionContext } from './ports/unit-of-work.js';

type RegistroAuditoria = Parameters<AuditPort['record']>[0];

const ACTOR: ActorContext = {
  userId: 'actor-1',
  actorProfile: 'jefe_emisora',
  permissions: ['emisora:*:manage'],
  ip: '127.0.0.1',
  userAgent: 'vitest-emisora',
  requestId: 'request-1',
};

function repositorio() {
  return {
    findIncentivoById: vi.fn(),
    findRealizadorById: vi.fn(),
    findResolucionById: vi.fn(),
    findResolucionByIncentivoId: vi.fn(),
    createResolucion: vi.fn(),
    findPatrocinioById: vi.fn(),
    createPatrocinio: vi.fn(),
    updatePatrocinioEstado: vi.fn(),
    findPromoById: vi.fn(),
    createPromo: vi.fn(),
    updatePromoEstado: vi.fn(),
    findOrdenById: vi.fn(),
    createOrden: vi.fn(),
    updateOrdenEstado: vi.fn(),
    findPublicacionById: vi.fn(),
    createPublicacion: vi.fn(),
    updatePublicacionEstado: vi.fn(),
    findProgramacionItemById: vi.fn(),
    findTransmisionById: vi.fn(),
    createTransmision: vi.fn(),
    updateTransmisionEstado: vi.fn(),
    findSalidaEquipoByTransmision: vi.fn(),
    createSalidaEquipo: vi.fn(),
    findReporteDesplazamientoByTransmision: vi.fn(),
    createReporteDesplazamiento: vi.fn(),
    createPrestamoMifi: vi.fn(),
    findPrestamoMifiById: vi.fn(),
    updatePrestamoMifiEstado: vi.fn(),
    createViatico: vi.fn(),
    findViaticoById: vi.fn(),
  };
}

type RepositorioMock = ReturnType<typeof repositorio>;

function crearServicio(
  opciones: {
    repo?: RepositorioMock;
    archivos?: Pick<FileDirectory, 'findById'>;
    exportador?: Pick<EmisoraReportExporter, 'generarResolucion'>;
    idempotencia?: IdempotencyStore;
  } = {},
) {
  const repo = opciones.repo ?? repositorio();
  const audit: RegistroAuditoria[] = [];
  const outbox: DomainEvent[] = [];
  const tx = {
    emisora: repo,
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
  const idempotencia = opciones.idempotencia ?? {
    reserve: vi.fn().mockResolvedValue({ status: 'nuevo', id: 'reserva-1' }),
    complete: vi.fn().mockResolvedValue(undefined),
    abandon: vi.fn().mockResolvedValue(undefined),
    purgeExpired: vi.fn().mockResolvedValue(0),
  };
  const archivos = opciones.archivos ?? {
    findById: vi.fn().mockResolvedValue({
      id: 'archivo-1',
      nombreOriginal: 'soporte.pdf',
      mime: 'application/pdf',
      tamano: 1024,
      estadoEscaneo: 'limpio',
    }),
  };
  const exportador = opciones.exportador ?? {
    generarResolucion: vi.fn().mockResolvedValue({
      archivoId: 'archivo-pdf-1',
      nombre: 'resolucion.pdf',
      descargaUrl: '/api/v1/files/archivo-pdf-1/download',
    }),
  };

  const service = new EmisoraOperacionService(
    repo as unknown as EmisoraRepository,
    uow,
    idempotencia,
    archivos,
    exportador,
  );
  return { service, repo, audit, outbox, archivos, exportador, idempotencia };
}

function incentivo(estado: string, referenciaCdp: string | null = 'CDP-2026-001') {
  return {
    id: 'incentivo-1',
    informeId: 'informe-1',
    comiteId: 'comite-1',
    realizadorId: 'realizador-1',
    estado,
    calificacion: 85,
    referenciaCdp,
    creadoEn: new Date(),
  };
}

function transmision(fechaTransmision: string, esFueraCiudad = true) {
  return {
    id: 'transmision-1',
    programacionItemId: null,
    fechaTransmision,
    esFueraCiudad,
    destino: esFueraCiudad ? 'Villa de Leyva' : null,
    estado: 'programada' as const,
    autorizadaPor: null,
    autorizadaEn: null,
  };
}

describe('reglas de plazo y transiciones E3', () => {
  it('aplica la antelación del mifi sobre días calendario en Bogotá', () => {
    // 02:00 UTC del 19 sigue siendo 18 en Bogotá: dos días antes del 20.
    expect(cumpleAntelacionMifi('2026-01-19T02:00:00.000Z', '2026-01-20')).toBe(true);
    expect(cumpleAntelacionMifi('2026-01-18T06:00:00.000Z', '2026-01-20')).toBe(true);
    expect(cumpleAntelacionMifi('2026-01-18T23:00:00.000Z', '2026-01-20')).toBe(true);
    expect(cumpleAntelacionMifi('2026-01-18T23:00:00.000Z', '2026-01-19')).toBe(false);
    expect(cumpleAntelacionMifi('2026-01-19T02:00:00.000Z', '2026-01-19')).toBe(false);
    expect(cumpleAntelacionMifi('no-fecha', '2026-01-20')).toBe(false);
  });

  it('cierra la tabla de transiciones de los agregados E3', () => {
    expect(canTransicionarE3('patrocinio', 'propuesto', 'aprobado')).toBe(true);
    expect(canTransicionarE3('patrocinio', 'aprobado', 'rechazado')).toBe(false);
    expect(canTransicionarE3('orden', 'borrador', 'programada')).toBe(true);
    expect(canTransicionarE3('orden', 'borrador', 'emitida')).toBe(false);
    expect(canTransicionarE3('transmision', 'autorizada', 'realizada')).toBe(true);
    expect(canTransicionarE3('transmision', 'realizada', 'autorizada')).toBe(false);
    expect(canTransicionarE3('prestamo', 'entregado', 'devuelto')).toBe(true);
    expect(canTransicionarE3('prestamo', 'entregado', 'autorizado')).toBe(false);
  });
});

describe('RF-03.7: resolución PDF', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa la plantilla de Exportaciones y audita sin duplicar resolucion.generada', async () => {
    const ctx = crearServicio();
    ctx.repo.findIncentivoById.mockResolvedValue(incentivo('resuelto'));
    ctx.repo.findResolucionByIncentivoId.mockResolvedValue(null);
    ctx.repo.findRealizadorById.mockResolvedValue({
      id: 'realizador-1',
      usuarioId: 'usuario-1',
      nombres: 'Ana',
      apellidos: 'Pérez',
      municipio: null,
      creadoEn: new Date(),
    });
    ctx.repo.createResolucion.mockImplementation((input: NewResolucion) =>
      Promise.resolve({ ...input, emitidaEn: new Date(), creadoEn: new Date() }),
    );

    const vista = await ctx.service.createResolucion(
      { incentivoId: 'incentivo-1', periodo: '2026' },
      ACTOR,
      'clave-resolucion',
    );

    expect(ctx.exportador.generarResolucion).toHaveBeenCalledWith({
      periodo: '2026',
      filas: [
        {
          realizador: 'Ana Pérez',
          concepto: 'Incentivo de realización de programas',
          estado: 'resuelto',
        },
      ],
      idempotencyKey: 'clave-resolucion',
      actor: ACTOR,
    });
    expect(ctx.audit.map((entrada) => entrada.accion)).toEqual(['resolucion.generada']);
    expect(ctx.outbox).toEqual([]);
    expect(vista).toMatchObject({
      incentivoId: 'incentivo-1',
      archivoId: 'archivo-pdf-1',
      referenciaCdp: 'CDP-2026-001',
    });
    expect(vista.descargaUrl).toContain('/files/archivo-pdf-1/download');
  });

  it('rechaza incentivos no resueltos y resoluciones duplicadas', async () => {
    const ctx = crearServicio();
    ctx.repo.findIncentivoById.mockResolvedValue(incentivo('asignado'));
    await expect(
      ctx.service.createResolucion({ incentivoId: 'incentivo-1', periodo: '2026' }, ACTOR, 'c1'),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.incentivoNoResuelto });
    expect(ctx.exportador.generarResolucion).not.toHaveBeenCalled();

    ctx.repo.findIncentivoById.mockResolvedValue(incentivo('resuelto'));
    ctx.repo.findResolucionByIncentivoId.mockResolvedValue({
      id: 'resolucion-1',
      incentivoId: 'incentivo-1',
      pdfArchivoId: 'archivo-pdf-1',
      referenciaCdp: 'CDP-2026-001',
      emitidaEn: new Date(),
      creadoEn: new Date(),
    });
    await expect(
      ctx.service.createResolucion({ incentivoId: 'incentivo-1', periodo: '2026' }, ACTOR, 'c2'),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.resolucionYaExistente });
  });
});

describe('RF-04: aprobación de patrocinios', () => {
  function contextoPatrocinio(estado = 'propuesto') {
    const ctx = crearServicio();
    ctx.repo.findPatrocinioById.mockResolvedValue({
      id: 'patrocinio-1',
      nombre: 'Cultura en la plaza',
      entidad: 'Alcaldía municipal',
      estado,
      fechaInicio: null,
      fechaFin: null,
      contratoArchivoId: null,
    });
    ctx.repo.updatePatrocinioEstado.mockImplementation(
      (id: string, _from: string, to: string, contratoArchivoId: string | null) =>
        Promise.resolve({
          id,
          nombre: 'Cultura en la plaza',
          entidad: 'Alcaldía municipal',
          estado: to,
          fechaInicio: null,
          fechaFin: null,
          contratoArchivoId,
        }),
    );
    return ctx;
  }

  it('exige contrato PDF limpio y publica patrocinio.aprobado', async () => {
    const ctx = contextoPatrocinio();
    await expect(
      ctx.service.transitionPatrocinio('patrocinio-1', { to: 'aprobado' }, ACTOR),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.patrocinioSinContrato });

    ctx.archivos.findById = vi.fn().mockResolvedValue({
      mime: 'application/pdf',
      estadoEscaneo: 'limpio',
    });
    const vista = await ctx.service.transitionPatrocinio(
      'patrocinio-1',
      { to: 'aprobado', contratoArchivoId: 'archivo-1' },
      ACTOR,
    );

    expect(vista.estado).toBe('aprobado');
    expect(ctx.outbox).toMatchObject([
      { tipo: 'patrocinio.aprobado', payload: { patrocinioId: 'patrocinio-1' } },
    ]);
  });

  it('rechaza un contrato infectado y una transición terminal', async () => {
    const ctx = contextoPatrocinio();
    ctx.archivos.findById = vi.fn().mockResolvedValue({
      mime: 'application/pdf',
      estadoEscaneo: 'infectado',
    });
    await expect(
      ctx.service.transitionPatrocinio(
        'patrocinio-1',
        { to: 'aprobado', contratoArchivoId: 'archivo-1' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.validationFailed });
    expect(ctx.repo.updatePatrocinioEstado).not.toHaveBeenCalled();

    const ctxAprobado = contextoPatrocinio('aprobado');
    await expect(
      ctxAprobado.service.transitionPatrocinio('patrocinio-1', { to: 'aprobado' }, ACTOR),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.invalidStateTransition });
  });
});

describe('RF-05: promos', () => {
  function contextoPromo() {
    const ctx = crearServicio();
    ctx.repo.findPromoById.mockResolvedValue({
      id: 'promo-1',
      patrocinioId: 'patrocinio-1',
      nombre: 'Promo cultural',
      guion: null,
      duracionSegundos: 30,
      audioArchivoId: null,
      estado: 'borrador',
    });
    ctx.repo.updatePromoEstado.mockImplementation(
      (id: string, _from: string, to: string, audioArchivoId: string | null) =>
        Promise.resolve({
          id,
          patrocinioId: 'patrocinio-1',
          nombre: 'Promo cultural',
          guion: null,
          duracionSegundos: 30,
          audioArchivoId,
          estado: to,
        }),
    );
    return ctx;
  }

  it('exige audio limpio para producir y publica promo.producida', async () => {
    const ctx = contextoPromo();
    ctx.archivos.findById = vi.fn().mockResolvedValue({
      mime: 'audio/mpeg',
      estadoEscaneo: 'limpio',
    });

    await expect(
      ctx.service.transitionPromo('promo-1', { to: 'producida' }, ACTOR),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.promoSinAudio });

    const vista = await ctx.service.transitionPromo(
      'promo-1',
      { to: 'producida', audioArchivoId: 'audio-1' },
      ACTOR,
    );
    expect(vista.estado).toBe('producida');
    expect(ctx.outbox).toMatchObject([{ tipo: 'promo.producida' }]);
  });

  it('rechaza un audio con MIME incompatible', async () => {
    const ctx = contextoPromo();
    ctx.archivos.findById = vi.fn().mockResolvedValue({
      mime: 'video/mp4',
      estadoEscaneo: 'limpio',
    });
    await expect(
      ctx.service.transitionPromo('promo-1', { to: 'producida', audioArchivoId: 'audio-1' }, ACTOR),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.validationFailed });
    expect(ctx.outbox).toEqual([]);
  });

  it('rechaza una publicación referida a una promo inexistente', async () => {
    const ctx = crearServicio();
    ctx.repo.findPromoById.mockResolvedValue(null);
    await expect(
      ctx.service.createPublicacion(
        { promoId: 'promo-inexistente', canal: 'facebook', fechaPublicacion: '2026-01-21' },
        ACTOR,
        'clave-publicacion',
      ),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.resourceNotFound });
    expect(ctx.repo.createPublicacion).not.toHaveBeenCalled();
  });
});

describe('RF-06: transmisiones, mifi y viáticos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function contextoTransmision(fecha = '2026-01-21', esFueraCiudad = true) {
    const ctx = crearServicio();
    ctx.repo.findTransmisionById.mockResolvedValue(transmision(fecha, esFueraCiudad));
    ctx.repo.updateTransmisionEstado.mockImplementation(
      (
        id: string,
        _from: string,
        to: string,
        autorizadaPor: string | null,
        autorizadaEn: Date | null,
      ) =>
        Promise.resolve({
          ...transmision(fecha, esFueraCiudad),
          id,
          estado: to,
          autorizadaPor,
          autorizadaEn,
        }),
    );
    ctx.repo.findSalidaEquipoByTransmision.mockResolvedValue([
      {
        id: 'salida-1',
        transmisionId: 'transmision-1',
        equipoId: 'MB-01',
        responsableId: 'tecnico-1',
        fechaSalida: new Date(),
        fechaDevolucion: null,
        observaciones: null,
      },
    ]);
    ctx.repo.findReporteDesplazamientoByTransmision.mockResolvedValue({
      id: 'reporte-1',
      transmisionId: 'transmision-1',
      conductorId: 'conductor-1',
      vehiculo: 'Vehículo 01',
      horaSalida: null,
      horaLlegada: null,
      novedades: null,
    });
    return ctx;
  }

  it('autoriza solo con salida de equipo y reporte de desplazamiento', async () => {
    const ctx = contextoTransmision();
    ctx.repo.findSalidaEquipoByTransmision.mockResolvedValue([]);

    await expect(
      ctx.service.transitionTransmision('transmision-1', { to: 'autorizada' }, ACTOR),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.transmisionSinSoportes });
    expect(ctx.repo.updateTransmisionEstado).not.toHaveBeenCalled();

    const ctxValido = contextoTransmision();
    const vista = await ctxValido.service.transitionTransmision(
      'transmision-1',
      { to: 'autorizada' },
      ACTOR,
    );
    expect(vista.estado).toBe('autorizada');
    expect(ctxValido.outbox).toMatchObject([
      {
        tipo: 'transmision.autorizada',
        payload: {
          transmisionId: 'transmision-1',
          fechaTransmision: '2026-01-21',
          esFueraCiudad: true,
        },
      },
    ]);
  });

  it('respeta la antelación de dos días del préstamo de mifi', async () => {
    const ctx = contextoTransmision('2026-01-20');
    await expect(
      ctx.service.createPrestamoMifi(
        { transmisionId: 'transmision-1', usuarioId: 'usuario-1' },
        ACTOR,
        'clave-mifi-insuficiente',
      ),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.mifiAntelacionInsuficiente });
    expect(ctx.repo.createPrestamoMifi).not.toHaveBeenCalled();

    const ctxValido = contextoTransmision('2026-01-21');
    ctxValido.repo.createPrestamoMifi.mockImplementation((input: NewPrestamoMifi) =>
      Promise.resolve({ ...input, estado: 'solicitado' as const }),
    );
    const vista = await ctxValido.service.createPrestamoMifi(
      { transmisionId: 'transmision-1', usuarioId: 'usuario-1' },
      ACTOR,
      'clave-mifi',
    );
    expect(ctxValido.repo.createPrestamoMifi).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaSolicitud: new Date('2026-01-19T12:00:00.000Z'),
        fechaTransmision: '2026-01-21',
      }),
    );
    expect(vista.estado).toBe('solicitado');
    expect(ctxValido.outbox).toEqual([]);
  });

  it('niega viáticos en la ciudad y los notifica cuando es fuera de ella', async () => {
    const ctx = contextoTransmision('2026-01-21', false);
    await expect(
      ctx.service.createViatico(
        { transmisionId: 'transmision-1', usuarioId: 'usuario-1' },
        ACTOR,
        'clave-viatico-invalido',
      ),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.viaticoNoFueraCiudad });

    const ctxValido = contextoTransmision();
    ctxValido.repo.createViatico.mockImplementation((input: NewViatico) =>
      Promise.resolve({
        ...input,
        estado: 'solicitado' as const,
        referenciaCompromiso: null,
        referenciaOrden: null,
      }),
    );
    const vista = await ctxValido.service.createViatico(
      { transmisionId: 'transmision-1', usuarioId: 'usuario-1' },
      ACTOR,
      'clave-viatico',
    );
    expect(vista.estado).toBe('solicitado');
    const evento = ctxValido.outbox[0];
    expect(evento.tipo).toBe('viatico.solicitado');
    expect(evento.payload).toMatchObject({ transmisionId: 'transmision-1' });
    expect(typeof evento.payload.viaticoId).toBe('string');
    expect(evento.usuarioIds).toEqual(['usuario-1']);
  });
});
