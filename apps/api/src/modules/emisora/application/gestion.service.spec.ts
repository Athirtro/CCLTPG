import { describe, expect, it, vi } from 'vitest';

import type { DomainEvent } from '../../../shared/events/outbox.port.js';
import type { AuditPort } from '../../../shared/audit/audit.port.js';
import type { IdempotencyStore } from '../../../shared/idempotency/idempotency.port.js';
import { EMISORA_ERRORS } from './emisora-error.js';
import { EmisoraGestionService } from './gestion.service.js';
import type { ActorContext } from './emisora.types.js';
import type { EmisoraRepository } from './ports/emisora.repository.js';
import type { EmisoraTransactionContext } from './ports/unit-of-work.js';

const ACTOR: ActorContext = {
  userId: 'actor-e4',
  actorProfile: 'jefe_emisora',
  permissions: ['emisora:*:manage'],
  ip: '127.0.0.1',
  userAgent: 'vitest-e4',
  requestId: 'request-e4',
};

const CLAVE = 'e4-clave-1';
const TRANSMISOR = 'dddddddd-0000-4000-8000-000000000001';
const OPERADOR = '55555555-5555-4555-8555-555555555555';
const ARCHIVO_PDF = 'eeeeeeee-0000-4000-8000-000000000001';
const ARCHIVO_AUDIO = 'eeeeeeee-0000-4000-8000-000000000002';
const ACTIVIDAD = 'eeeeeeee-0000-4000-8000-000000000003';

const METODOS_REPOSITORIO = [
  'findTransmisorById',
  'createTurno',
  'findTurnoById',
  'updateTurnoEstado',
  'createLectura',
  'findLecturaByTransmisorFecha',
  'listLecturas',
  'createBitacora',
  'createObra',
  'listObras',
  'createReporteObra',
  'createPagoDerechos',
  'findObraById',
  'createEquipo',
  'findEquipoById',
  'updateEquipoEstado',
  'createActualizacion',
  'findActualizacionById',
  'updateActualizacionEstado',
  'createProyeccion',
  'findProyeccionById',
  'findProyeccionByAnio',
  'updateProyeccionEstado',
  'createInversion',
  'findInversionById',
  'updateInversionEstado',
  'createVersionSoftware',
  'createAsignacionEquipo',
  'createActividad',
  'findActividadById',
  'createPermisoGobierno',
  'createArchivoEmisora',
  'findArchivoEmisoraByArchivoId',
  'createPlanilla',
  'findPlanillaByFecha',
  'findProgramacionById',
  'createTramite',
  'findTramiteById',
  'createSoporteTramite',
  'updateTramiteEstado',
] as const;

function crearServicio(opciones: { idempotencia?: IdempotencyStore } = {}) {
  const repo = Object.fromEntries(METODOS_REPOSITORIO.map((nombre) => [nombre, vi.fn()])) as Record<
    (typeof METODOS_REPOSITORIO)[number],
    ReturnType<typeof vi.fn>
  >;
  repo.findTransmisorById.mockResolvedValue({
    id: TRANSMISOR,
    codigo: 'TX-01',
    nombre: 'Transmisor principal',
    sede: 'Sede cultural',
    frecuencia: '107.9',
    activo: true,
  });
  repo.findObraById.mockResolvedValue({ id: 'obra-1' });
  repo.findEquipoById.mockResolvedValue({ id: 'equipo-1' });
  repo.findActividadById.mockResolvedValue({ id: ACTIVIDAD, nombre: 'Festival' });
  repo.listObras.mockResolvedValue([
    {
      id: 'obra-1',
      titulo: 'Obra de prueba',
      compositorAutor: 'Autor',
      duracionSegundos: 125,
      fechaInclusion: '2026-01-10',
      archivoId: null,
    },
  ]);
  repo.findProgramacionById.mockResolvedValue(null);

  const auditoria: Parameters<AuditPort['record']>[0][] = [];
  const eventos: DomainEvent[] = [];
  const tx = {
    emisora: repo,
    audit: {
      record: vi.fn().mockImplementation((entrada: Parameters<AuditPort['record']>[0]) => {
        auditoria.push(entrada);
        return Promise.resolve();
      }),
    },
    outbox: {
      enqueue: vi.fn().mockImplementation((evento: DomainEvent) => {
        eventos.push(evento);
        return Promise.resolve();
      }),
    },
  } as unknown as EmisoraTransactionContext;
  const uow = {
    run: <T>(callback: (contexto: EmisoraTransactionContext) => Promise<T>) => callback(tx),
  };
  const idempotencia = opciones.idempotencia ?? {
    reserve: vi.fn().mockResolvedValue({ status: 'nuevo', id: 'reserva-e4' }),
    complete: vi.fn().mockResolvedValue(undefined),
    abandon: vi.fn().mockResolvedValue(undefined),
    purgeExpired: vi.fn().mockResolvedValue(0),
  };
  const archivos = {
    findById: vi.fn().mockResolvedValue({
      id: ARCHIVO_PDF,
      nombreOriginal: 'soporte.pdf',
      mime: 'application/pdf',
      tamano: 1024,
      estadoEscaneo: 'limpio',
      hashSha256: 'a'.repeat(64),
    }),
  };
  const documento = {
    archivoId: 'archivo-generado-e4',
    nombre: 'documento.pdf',
    descargaUrl: '/api/v1/files/archivo-generado-e4/download',
  };
  const exportador = {
    generarResolucion: vi.fn().mockResolvedValue(documento),
    generarReporteObras: vi.fn().mockResolvedValue(documento),
    generarOficioSalida: vi.fn().mockResolvedValue(documento),
    generarPlanilla: vi.fn().mockResolvedValue(documento),
  };
  const service = new EmisoraGestionService(
    repo as unknown as EmisoraRepository,
    uow,
    idempotencia,
    archivos,
    exportador,
  );
  return { service, repo, idempotencia, archivos, exportador, auditoria, eventos };
}

describe('RF-07: sede de transmisores', () => {
  it('exige Idempotency-Key para asignar un turno', async () => {
    const { service } = crearServicio();
    await expect(
      service.createTurno(
        {
          transmisorId: TRANSMISOR,
          operadorId: OPERADOR,
          fecha: '2026-01-19',
          horaInicio: '06:00',
          horaFin: '07:00',
        },
        ACTOR,
        null,
      ),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.idempotencyKeyRequired });
  });

  it('devuelve la respuesta cacheada al repetir la misma clave', async () => {
    const respuesta = {
      id: 'turno-cacheado',
      transmisorId: TRANSMISOR,
      operadorId: OPERADOR,
      fecha: '2026-01-19',
      horaInicio: '06:00',
      horaFin: '07:00',
      estado: 'planificado',
    };
    const { service, repo } = crearServicio({
      idempotencia: {
        reserve: vi.fn().mockResolvedValue({
          status: 'repetir',
          responseStatus: 201,
          responseBody: respuesta,
        }),
        complete: vi.fn().mockResolvedValue(undefined),
        abandon: vi.fn().mockResolvedValue(undefined),
        purgeExpired: vi.fn().mockResolvedValue(0),
      },
    });

    await expect(
      service.createTurno(
        {
          transmisorId: TRANSMISOR,
          operadorId: OPERADOR,
          fecha: '2026-01-19',
          horaInicio: '06:00',
          horaFin: '07:00',
        },
        ACTOR,
        CLAVE,
      ),
    ).resolves.toEqual(respuesta);
    expect(repo.createTurno).not.toHaveBeenCalled();
  });

  it('rechaza una segunda lectura del mismo transmisor y fecha', async () => {
    const { service, repo } = crearServicio();
    repo.findLecturaByTransmisorFecha.mockResolvedValue({ id: 'lectura-previa' });
    await expect(
      service.createLectura(
        { transmisorId: TRANSMISOR, fecha: '2026-01-19', potenciaW: 1000 },
        ACTOR,
        CLAVE,
      ),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.lecturaDuplicada });
    expect(repo.createLectura).not.toHaveBeenCalled();
  });

  it('publica lectura.registrada y guarda el actor de la bitácora', async () => {
    const { service, repo, eventos } = crearServicio();
    repo.createLectura.mockResolvedValue({
      id: 'lectura-1',
      transmisorId: TRANSMISOR,
      fecha: '2026-01-19',
      potenciaW: 1000,
      frecuencia: null,
      observaciones: null,
      registradoPor: ACTOR.userId,
    });
    repo.createBitacora.mockResolvedValue({ id: 'bitacora-1' });
    await service.createLectura(
      { transmisorId: TRANSMISOR, fecha: '2026-01-19', potenciaW: 1000 },
      ACTOR,
      CLAVE,
    );
    await service.createBitacora(
      {
        transmisorId: TRANSMISOR,
        fecha: '2026-01-19',
        incidente: 'Caída breve de potencia',
      },
      ACTOR,
      'e4-clave-2',
    );
    expect(eventos.map((evento) => evento.tipo)).toContain('lectura.registrada');
    expect(eventos.map((evento) => evento.tipo)).toContain('bitacora.registrada');
    expect(repo.createBitacora).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ACTOR.userId, requestId: ACTOR.requestId }),
    );
  });

  it('solo permite planificado → confirmado → realizado', async () => {
    const { service, repo } = crearServicio();
    repo.findTurnoById.mockResolvedValue({ id: 'turno-1', estado: 'planificado' });
    await expect(
      service.transitionTurno('turno-1', { to: 'realizado' }, ACTOR),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.invalidStateTransition });
    repo.updateTurnoEstado.mockResolvedValue({
      id: 'turno-1',
      transmisorId: TRANSMISOR,
      operadorId: OPERADOR,
      fecha: '2026-01-19',
      horaInicio: '06:00',
      horaFin: '07:00',
      estado: 'confirmado',
    });
    await expect(
      service.transitionTurno('turno-1', { to: 'confirmado' }, ACTOR),
    ).resolves.toMatchObject({ estado: 'confirmado' });
  });
});

describe('RF-08: derechos de autor', () => {
  it('rechaza un pago cuyo soporte no es un PDF limpio', async () => {
    const { service, archivos } = crearServicio();
    archivos.findById.mockResolvedValue({
      id: ARCHIVO_PDF,
      nombreOriginal: 'soporte.pdf',
      mime: 'application/pdf',
      tamano: 1024,
      estadoEscaneo: 'infectado',
    });
    await expect(
      service.createPago(
        {
          obraId: 'obra-1',
          soporteArchivoId: ARCHIVO_PDF,
          referencia: 'PAGO-1',
        },
        ACTOR,
        CLAVE,
      ),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.validationFailed });
  });

  it('genera el reporte por Exportaciones con clave de idempotencia propia', async () => {
    const { service, exportador, repo } = crearServicio();
    repo.createReporteObra.mockResolvedValue({
      id: 'reporte-1',
      entidad: 'sayco',
      periodo: '2026-01',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      archivoId: 'archivo-generado-e4',
      generadoEn: new Date(),
    });
    const resultado = await service.createReporteObra(
      {
        entidad: 'sayco',
        periodo: '2026-01',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-01-31',
      },
      ACTOR,
      CLAVE,
    );
    expect(exportador.generarReporteObras).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: CLAVE }),
    );
    expect(resultado.descargaUrl).toBe('/api/v1/files/archivo-generado-e4/download');
  });
});

describe('RF-09: tecnología e inversión', () => {
  it('rechaza dos proyecciones para el mismo año', async () => {
    const { service, repo } = crearServicio();
    repo.findProyeccionByAnio.mockResolvedValue({ id: 'proyeccion-previa', anio: 2026 });
    await expect(
      service.createProyeccion({ anio: 2026, descripcion: 'Renovación de equipos' }, ACTOR, CLAVE),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.proyeccionDuplicada });
  });

  it('exige referencia de contrato para aprobar una inversión', async () => {
    const { service, repo } = crearServicio();
    repo.findInversionById.mockResolvedValue({
      id: 'inversion-1',
      proyeccionId: 'proyeccion-1',
      contratoRef: null,
      estado: 'proyectada',
      fechaInicio: null,
      fechaFin: null,
    });
    await expect(
      service.transitionInversion('inversion-1', { to: 'aprobada' }, ACTOR),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.validationFailed });
  });
});

describe('RF-10 y RF-11: oficio, archivo y planilla', () => {
  it('genera el oficio de salida con la plantilla correspondiente', async () => {
    const { service, exportador, repo } = crearServicio();
    repo.createPermisoGobierno.mockResolvedValue({
      id: 'permiso-1',
      actividadId: ACTIVIDAD,
      oficioArchivoId: 'archivo-generado-e4',
      destino: 'Alcaldía',
      fechaEmision: '2026-01-19',
      estado: 'emitido',
    });
    await expect(
      service.createPermiso(
        { actividadId: ACTIVIDAD, destino: 'Alcaldía', referencia: 'OF-001' },
        ACTOR,
        CLAVE,
      ),
    ).resolves.toMatchObject({ descargaUrl: '/api/v1/files/archivo-generado-e4/download' });
    expect(exportador.generarOficioSalida).toHaveBeenCalledWith(
      expect.objectContaining({ referencia: 'OF-001', idempotencyKey: CLAVE }),
    );
    expect(repo.createPermisoGobierno).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'emitido' }),
    );
  });

  it('rechaza un archivo inexistente y archiva un audio limpio', async () => {
    const { service, archivos, repo, eventos } = crearServicio();
    archivos.findById.mockResolvedValue(null);
    await expect(
      service.createArchivo(
        {
          archivoId: ARCHIVO_AUDIO,
          tipo: 'audio',
          duracionSegundos: 210,
          fecha: '2026-01-19',
          responsableId: OPERADOR,
        },
        ACTOR,
        CLAVE,
      ),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.validationFailed });

    archivos.findById.mockResolvedValue({
      id: ARCHIVO_AUDIO,
      nombreOriginal: 'programa.mp3',
      mime: 'audio/mpeg',
      tamano: 512,
      estadoEscaneo: 'limpio',
      hashSha256: 'b'.repeat(64),
    });
    repo.createArchivoEmisora.mockResolvedValue({
      id: 'archivo-emisora-1',
      archivoId: ARCHIVO_AUDIO,
      tipo: 'audio',
      duracionSegundos: 210,
      fecha: '2026-01-19',
      responsableId: OPERADOR,
      hashSha256: 'b'.repeat(64),
      mime: 'audio/mpeg',
    });
    await service.createArchivo(
      {
        archivoId: ARCHIVO_AUDIO,
        tipo: 'audio',
        duracionSegundos: 210,
        fecha: '2026-01-19',
        responsableId: OPERADOR,
      },
      ACTOR,
      'e4-clave-audio',
    );
    expect(eventos.map((evento) => evento.tipo)).toContain('audio.archivado');
    expect(repo.createArchivoEmisora).toHaveBeenCalledWith(
      expect.objectContaining({ hashSha256: 'b'.repeat(64), mime: 'audio/mpeg' }),
    );
  });

  it('registra la planilla como registrada y publica su evento', async () => {
    const { service, repo, eventos } = crearServicio();
    repo.createPlanilla.mockResolvedValue({
      id: 'planilla-1',
      fecha: '2026-01-19',
      programacionDiariaId: null,
      operadorId: null,
      archivoId: 'archivo-generado-e4',
      estado: 'registrada',
    });
    await expect(
      service.createPlanilla({ fecha: '2026-01-19', programa: 'Programa matutino' }, ACTOR, CLAVE),
    ).resolves.toMatchObject({ estado: 'registrada' });
    expect(repo.createPlanilla).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'registrada' }),
    );
    expect(eventos.map((evento) => evento.tipo)).toContain('planilla.registrada');
  });

  it('rechaza dos planillas para la misma fecha', async () => {
    const { service, repo } = crearServicio();
    repo.findPlanillaByFecha.mockResolvedValue({ id: 'planilla-previa', fecha: '2026-01-19' });
    await expect(
      service.createPlanilla({ fecha: '2026-01-19', programa: 'Programa matutino' }, ACTOR, CLAVE),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.planillaDuplicada });
  });
});

describe('RF-12: trámites externos', () => {
  it('avanza solo en un sentido y exige radicado para poner en trámite', async () => {
    const { service, repo } = crearServicio();
    repo.findTramiteById.mockResolvedValue({
      id: 'tramite-1',
      destino: 'gobierno',
      asunto: 'Permiso',
      radicadoRef: null,
      estado: 'radicado',
      fechaRadicacion: '2026-01-19',
      responsableId: null,
    });
    await expect(
      service.transitionTramite('tramite-1', { to: 'respondido' }, ACTOR),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.invalidStateTransition });
    await expect(
      service.transitionTramite('tramite-1', { to: 'en_tramite' }, ACTOR),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.validationFailed });

    repo.findTramiteById.mockResolvedValue({
      id: 'tramite-1',
      destino: 'gobierno',
      asunto: 'Permiso',
      radicadoRef: null,
      estado: 'radicado',
      fechaRadicacion: '2026-01-19',
      responsableId: null,
    });
    repo.updateTramiteEstado.mockResolvedValue({
      id: 'tramite-1',
      destino: 'gobierno',
      asunto: 'Permiso',
      radicadoRef: 'RAD-1',
      estado: 'en_tramite',
      fechaRadicacion: '2026-01-19',
      responsableId: null,
    });
    await expect(
      service.transitionTramite('tramite-1', { to: 'en_tramite', radicadoRef: 'RAD-1' }, ACTOR),
    ).resolves.toMatchObject({ estado: 'en_tramite' });
  });

  it('valida el soporte PDF antes de adjuntarlo', async () => {
    const { service, archivos, repo } = crearServicio();
    repo.findTramiteById.mockResolvedValue({
      id: 'tramite-1',
      destino: 'gobierno',
      asunto: 'Permiso',
      radicadoRef: null,
      estado: 'radicado',
      fechaRadicacion: '2026-01-19',
      responsableId: null,
    });
    archivos.findById.mockResolvedValue({
      id: ARCHIVO_PDF,
      nombreOriginal: 'soporte.png',
      mime: 'image/png',
      tamano: 1024,
      estadoEscaneo: 'limpio',
    });
    await expect(
      service.createSoporte('tramite-1', { archivoId: ARCHIVO_PDF }, ACTOR, 'e4-clave-soporte'),
    ).rejects.toMatchObject({ code: EMISORA_ERRORS.validationFailed });
  });
});
