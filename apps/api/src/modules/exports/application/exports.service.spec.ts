import { describe, expect, it, vi } from 'vitest';

import type { AuditEvent, AuditPort } from '../../../shared/audit/audit.port.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { DomainEvent, OutboxPort } from '../../../shared/events/outbox.port.js';
import type {
  IdempotencyReservation,
  IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import type { ObjectStorage } from '../../../shared/storage/object-storage.port.js';
import { ObjectStorageError } from '../../../shared/storage/object-storage.port.js';
import { ExportsService, type CreateExportInput } from './exports.service.js';
import type { ExportRenderer, RenderedExport } from './ports/export-renderer.js';
import type {
  ExportFileRecord,
  ExportFileRepository,
  NewExportFileRecord,
} from './ports/export-file.repository.js';
import type { ExportsTransactionContext, ExportsUnitOfWork } from './ports/unit-of-work.js';

/**
 * RB1-24/RB1-25: exportación registrada como archivo, auditoría y outbox
 * transaccionales e idempotencia obligatoria.
 */

const USER = '0190f000-0000-7000-8000-000000000001';
const CONTEXT = { ip: '127.0.0.1', userAgent: 'vitest', requestId: 'req-export' };

const PARAMS = {
  periodo: '2026-1',
  filas: [{ programa: 'Artes', matriculados: 10 }],
};

function input(overrides: Partial<CreateExportInput> = {}): CreateExportInput {
  return {
    plantilla: 'matriculas-por-programa',
    formato: 'pdf',
    parametros: PARAMS,
    idempotencyKey: 'clave-export',
    actor: { userId: USER, actorProfile: 'administrador' },
    context: CONTEXT,
    ...overrides,
  };
}

function harness(
  options: {
    reservation?: IdempotencyReservation;
    rendered?: RenderedExport;
    storeFails?: boolean;
    dbFails?: boolean;
  } = {},
) {
  const rendered: RenderedExport = options.rendered ?? {
    buffer: Buffer.from('%PDF-1.7 reporte', 'ascii'),
    mime: 'application/pdf',
    extension: 'pdf',
  };

  const render = vi.fn(() => Promise.resolve(rendered));
  const renderer = { render } as unknown as ExportRenderer;

  const created: NewExportFileRecord[] = [];
  const create = vi.fn((record: NewExportFileRecord) => {
    if (options.dbFails) {
      return Promise.reject(new Error('transacción caída'));
    }
    created.push(record);
    return Promise.resolve({
      ...record,
      creadoEn: new Date('2026-11-19T10:00:00Z'),
    } satisfies ExportFileRecord);
  });
  const files: ExportFileRepository = { create };

  const auditRecord = vi.fn((_event: AuditEvent) => Promise.resolve());
  const audit: AuditPort = { record: auditRecord };
  const enqueue = vi.fn((_event: DomainEvent) => Promise.resolve());
  const outbox: OutboxPort = { enqueue };

  const unitOfWork: ExportsUnitOfWork = {
    run: <T>(callback: (tx: ExportsTransactionContext) => Promise<T>) =>
      callback({ files, audit, outbox }),
  };

  const put = vi.fn((_key: string, _body: Buffer, _contentType: string) =>
    options.storeFails ? Promise.reject(new ObjectStorageError('caído')) : Promise.resolve(),
  );
  const get = vi.fn(() => Promise.resolve(Buffer.alloc(0)));
  const exists = vi.fn(() => Promise.resolve(false));
  const remove = vi.fn(() => Promise.resolve());
  const storage: ObjectStorage = { put, get, exists, delete: remove };

  const complete = vi.fn(() => Promise.resolve());
  const abandon = vi.fn(() => Promise.resolve());
  const reserve = vi.fn(() =>
    Promise.resolve(options.reservation ?? ({ status: 'nuevo', id: 'reserva-export' } as const)),
  );
  const purgeExpired = vi.fn(() => Promise.resolve(0));
  const idempotency = {
    reserve,
    complete,
    abandon,
    purgeExpired,
  } as unknown as IdempotencyStore;

  const service = new ExportsService(unitOfWork, renderer, storage, idempotency);
  return {
    service,
    render,
    files,
    created,
    auditRecord,
    enqueue,
    put,
    remove,
    storage,
    reserve,
    complete,
    abandon,
  };
}

async function codeOf(run: Promise<unknown>): Promise<string> {
  const error = await run.then(
    () => null,
    (failure: unknown) => failure,
  );
  expect(error).toBeInstanceOf(AppError);
  return (error as AppError).code;
}

describe('servicio de exportaciones (RB1-24)', () => {
  it('exige Idempotency-Key antes de renderizar', async () => {
    const h = harness();
    await expect(codeOf(h.service.create(input({ idempotencyKey: null })))).resolves.toBe(
      'IDEMPOTENCY_KEY_REQUIRED',
    );
    expect(h.render).not.toHaveBeenCalled();
  });

  it('rechaza formatos no soportados, plantillas inexistentes y parámetros inválidos', async () => {
    const h = harness();

    await expect(codeOf(h.service.create(input({ formato: 'docx' })))).resolves.toBe(
      'EXPORT_FORMAT_NOT_SUPPORTED',
    );
    await expect(codeOf(h.service.create(input({ plantilla: 'no-existe' })))).resolves.toBe(
      'EXPORT_TEMPLATE_NOT_FOUND',
    );
    await expect(
      codeOf(h.service.create(input({ parametros: { filas: PARAMS.filas } }))),
    ).resolves.toBe('EXPORT_PARAMETERS_INVALID');
    expect(h.render).not.toHaveBeenCalled();
  });

  it('registra el archivo, audita y encola el evento en una sola unidad de trabajo', async () => {
    const h = harness();
    const view = await h.service.create(input());

    expect(view).toMatchObject({
      nombre: 'matriculas-por-programa-v1.pdf',
      mime: 'application/pdf',
      formato: 'pdf',
      tamano: 16,
    });
    expect(view.descargaUrl).toMatch(/\/api\/v1\/files\/.+\/download$/u);

    expect(h.put).toHaveBeenCalledWith(
      expect.stringMatching(/^exports\/.+\/matriculas-por-programa-v1\.pdf$/u),
      expect.any(Buffer),
      'application/pdf',
    );
    expect(h.created).toHaveLength(1);
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'reporte.generado',
        recurso: 'archivo',
        datosDespues: {
          plantilla: 'matriculas-por-programa',
          version: 1,
          formato: 'pdf',
          filas: 1,
          tamano: 16,
        },
      }),
    );
    expect(h.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'reporte.generado',
        agregado: 'archivo',
        usuarioIds: [USER],
      }),
    );
    const enqueued = h.enqueue.mock.calls[0]?.[0];
    expect(enqueued?.payload).toMatchObject({
      archivoId: view.archivoId,
      plantilla: 'matriculas-por-programa',
      formato: 'pdf',
      filas: 1,
    });
    expect(h.complete).toHaveBeenCalledWith('reserva-export', 201, view);
  });

  it('devuelve la respuesta original ante una repetición exacta', async () => {
    const cached = {
      archivoId: '0190f000-0000-7000-8000-0000000000aa',
      nombre: 'matriculas-por-programa-v1.pdf',
      mime: 'application/pdf',
      tamano: 16,
      formato: 'pdf' as const,
      hashSha256: 'a'.repeat(64),
      descargaUrl: '/api/v1/files/0190f000-0000-7000-8000-0000000000aa/download',
    };
    const h = harness({
      reservation: { status: 'repetir', responseStatus: 201, responseBody: cached },
    });

    await expect(h.service.create(input())).resolves.toEqual(cached);
    expect(h.render).not.toHaveBeenCalled();
    expect(h.put).not.toHaveBeenCalled();
  });

  it('rechaza la reutilización de clave y las solicitudes en proceso', async () => {
    const conflict = harness({ reservation: { status: 'conflicto' } });
    await expect(codeOf(conflict.service.create(input()))).resolves.toBe('IDEMPOTENCY_KEY_REUSED');

    const inProgress = harness({ reservation: { status: 'en_proceso' } });
    await expect(codeOf(inProgress.service.create(input()))).resolves.toBe(
      'IDEMPOTENCY_IN_PROGRESS',
    );
  });

  it('traduce la caída del almacenamiento a 503 y abandona la reserva', async () => {
    const h = harness({ storeFails: true });
    await expect(codeOf(h.service.create(input()))).resolves.toBe('FILE_STORAGE_UNAVAILABLE');
    expect(h.abandon).toHaveBeenCalledWith('reserva-export');
    expect(h.complete).not.toHaveBeenCalled();
  });

  it('revierte el objeto si la transacción falla después de guardarlo', async () => {
    const h = harness({ dbFails: true });

    await expect(h.service.create(input())).rejects.toThrow('transacción caída');

    expect(h.remove).toHaveBeenCalledWith(
      expect.stringMatching(/^exports\/.+\/matriculas-por-programa-v1\.pdf$/u),
    );
    expect(h.abandon).toHaveBeenCalledWith('reserva-export');
    expect(h.complete).not.toHaveBeenCalled();
  });
});
