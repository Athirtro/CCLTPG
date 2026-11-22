import { describe, expect, it, vi } from 'vitest';

import type { AuditEvent, AuditPort } from '../../../shared/audit/audit.port.js';
import { env } from '../../../shared/config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type {
  IdempotencyReservation,
  IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import type { MalwareScanner } from '../../../shared/malware/malware-scanner.port.js';
import type { ObjectStorage } from '../../../shared/storage/object-storage.port.js';
import {
  ObjectNotFoundError,
  ObjectStorageError,
} from '../../../shared/storage/object-storage.port.js';
import { FileService } from './file.service.js';
import type { FileRecord, FileRepository, NewFileRecord } from './ports/file.repository.js';
import type { FileInspector } from './ports/file-inspector.js';
import type { FilesTransactionContext, FilesUnitOfWork } from './ports/unit-of-work.js';

/**
 * Compuerta 3 — archivos: límites, MIME, cuarentena, deduplicación,
 * idempotencia, descarga ajena y auditoría.
 */

const CONTEXT = { ip: '127.0.0.1', userAgent: 'vitest', requestId: 'req-1' };
const OWNER = {
  userId: '0190f000-0000-7000-8000-000000000001',
  actorProfile: 'educador',
  permissions: ['files:document:create'],
};
const OTHER = {
  userId: '0190f000-0000-7000-8000-000000000002',
  actorProfile: 'estudiante',
  permissions: ['files:document:read_own'],
};

function recordOf(input: NewFileRecord, creadoEn = new Date('2026-11-19T10:00:00Z')): FileRecord {
  return { ...input, creadoEn };
}

function harness(
  options: {
    reservation?: IdempotencyReservation;
    infected?: boolean;
    exists?: boolean;
    storedBody?: Buffer;
    createRecord?: (input: NewFileRecord) => FileRecord;
  } = {},
) {
  const calls: string[] = [];
  const stored = new Map<string, Buffer>();
  const lookup = new Map<string, FileRecord>();

  const create = vi.fn((input: NewFileRecord) => {
    calls.push('create');
    const record = options.createRecord?.(input) ?? recordOf(input);
    return Promise.resolve(record);
  });
  const findById = vi.fn((id: string) => Promise.resolve(lookup.get(id) ?? null));
  const findByHash = vi.fn(() => Promise.resolve([] as FileRecord[]));
  const repository = { create, findById, findByHash } as unknown as FileRepository;

  const auditRecord = vi.fn((_event: AuditEvent) => {
    calls.push('audit');
    return Promise.resolve();
  });
  const audit = { record: auditRecord } as unknown as AuditPort;
  const outboxEnqueue = vi.fn(() => Promise.resolve());

  const unitOfWork: FilesUnitOfWork = {
    run: <T>(callback: (tx: FilesTransactionContext) => Promise<T>) =>
      callback({ files: repository, audit, outbox: { enqueue: outboxEnqueue } }),
  };

  const inspect = vi.fn((_buffer: Buffer, declaredMime: string) =>
    Promise.resolve({ detectedMime: declaredMime, mime: declaredMime }),
  );
  const inspector = { inspect } as unknown as FileInspector;

  const put = vi.fn((key: string, body: Buffer) => {
    calls.push('put');
    stored.set(key, body);
    return Promise.resolve();
  });
  const get = vi.fn((key: string) => {
    calls.push('get');
    if (options.storedBody) {
      return Promise.resolve(options.storedBody);
    }
    const body = stored.get(key);
    return body ? Promise.resolve(body) : Promise.reject(new ObjectNotFoundError(key));
  });
  const exists = vi.fn((key: string) => {
    calls.push('exists');
    return Promise.resolve(options.exists ?? stored.has(key));
  });
  const remove = vi.fn((key: string) => {
    calls.push('delete');
    stored.delete(key);
    return Promise.resolve();
  });
  const storage: ObjectStorage = { put, get, exists, delete: remove };

  const scan = vi.fn(() =>
    Promise.resolve(
      options.infected
        ? { infected: true, signature: 'EICAR-Test-File' }
        : { infected: false, signature: null },
    ),
  );
  const scanner = { scan } as unknown as MalwareScanner;

  const complete = vi.fn(() => Promise.resolve());
  const abandon = vi.fn(() => Promise.resolve());
  const reserve = vi.fn(() =>
    Promise.resolve(options.reservation ?? ({ status: 'nuevo', id: 'reserva-1' } as const)),
  );
  const purgeExpired = vi.fn(() => Promise.resolve(0));
  const idempotency = {
    reserve,
    complete,
    abandon,
    purgeExpired,
  } as unknown as IdempotencyStore;

  const service = new FileService(
    repository,
    unitOfWork,
    inspector,
    storage,
    scanner,
    idempotency,
    audit,
  );

  return {
    service,
    repository,
    lookup,
    stored,
    auditRecord,
    inspect,
    put,
    get,
    remove,
    scan,
    reserve,
    complete,
    abandon,
    calls,
    create,
  };
}

function uploadInput(overrides: Partial<Parameters<FileService['upload']>[0]> = {}) {
  return {
    buffer: Buffer.from('%PDF-1.7\ncontenido\n', 'ascii'),
    nombreOriginal: 'reporte.pdf',
    mime: 'application/pdf',
    idempotencyKey: 'clave-1',
    actor: OWNER,
    context: CONTEXT,
    ...overrides,
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

describe('carga segura de archivos (RB1-21)', () => {
  it('exige Idempotency-Key antes de cualquier efecto', async () => {
    const h = harness();
    await expect(codeOf(h.service.upload(uploadInput({ idempotencyKey: null })))).resolves.toBe(
      'IDEMPOTENCY_KEY_REQUIRED',
    );
    expect(h.inspect).not.toHaveBeenCalled();
    expect(h.reserve).not.toHaveBeenCalled();
  });

  it('rechaza archivos vacíos y mayores al límite', async () => {
    const h = harness();
    await expect(codeOf(h.service.upload(uploadInput({ buffer: Buffer.alloc(0) })))).resolves.toBe(
      'FILE_EMPTY',
    );

    await expect(
      codeOf(h.service.upload(uploadInput({ buffer: Buffer.alloc(env.MAX_FILE_BYTES + 1) }))),
    ).resolves.toBe('FILE_TOO_LARGE');
    expect(h.reserve).not.toHaveBeenCalled();
  });

  it('persiste objeto y metadatos, audita y completa la idempotencia', async () => {
    const h = harness();
    const view = await h.service.upload(uploadInput({ nombreOriginal: '../../reporte final.pdf' }));

    expect(view).toMatchObject({
      nombreOriginal: '_.._reporte final.pdf',
      mime: 'application/pdf',
      estadoEscaneo: 'limpio',
      tamano: 19,
    });
    expect(h.put).toHaveBeenCalledWith(
      expect.stringMatching(/^objects\/sha256\/[a-f0-9]{64}$/u),
      expect.any(Buffer),
      'application/pdf',
    );
    expect(h.create).toHaveBeenCalledWith(
      expect.objectContaining({ estadoEscaneo: 'limpio', subidoPor: OWNER.userId }),
    );
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'archivo.subido', recursoId: view.id }),
    );
    expect(h.complete).toHaveBeenCalledWith('reserva-1', 201, view);
  });

  it('deduplica el objeto cuando el mismo contenido ya existe', async () => {
    const h = harness({ exists: true });
    await h.service.upload(uploadInput());

    expect(h.put).not.toHaveBeenCalled();
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it('pone en cuarentena un archivo infectado y nunca lo sirve', async () => {
    const h = harness({ infected: true });
    const view = await h.service.upload(uploadInput());

    expect(view.estadoEscaneo).toBe('infectado');
    expect(h.put).not.toHaveBeenCalled();
    expect(h.remove).toHaveBeenCalledWith(expect.stringMatching(/^quarantine\//u));
    expect(h.create).toHaveBeenCalledWith(expect.objectContaining({ estadoEscaneo: 'infectado' }));
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'archivo.cuarentena' }),
    );
  });

  it('devuelve la respuesta original ante una repetición exacta', async () => {
    const cached = {
      id: '0190f000-0000-7000-8000-0000000000aa',
      nombreOriginal: 'reporte.pdf',
      mime: 'application/pdf',
      tamano: 10,
      hashSha256: 'a'.repeat(64),
      estadoEscaneo: 'limpio' as const,
      creadoEn: '2026-11-19T10:00:00.000Z',
    };
    const h = harness({
      reservation: { status: 'repetir', responseStatus: 201, responseBody: cached },
    });

    await expect(h.service.upload(uploadInput())).resolves.toEqual(cached);
    expect(h.inspect).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
  });

  it('rechaza la misma clave con un cuerpo distinto', async () => {
    const h = harness({ reservation: { status: 'conflicto' } });
    await expect(codeOf(h.service.upload(uploadInput()))).resolves.toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('rechaza una solicitud todavía en proceso', async () => {
    const h = harness({ reservation: { status: 'en_proceso' } });
    await expect(codeOf(h.service.upload(uploadInput()))).resolves.toBe('IDEMPOTENCY_IN_PROGRESS');
  });

  it('traduce el fallo de almacenamiento a 503 y abandona la reserva', async () => {
    const h = harness();
    h.put.mockRejectedValueOnce(new ObjectStorageError('caído'));

    await expect(codeOf(h.service.upload(uploadInput()))).resolves.toBe('FILE_STORAGE_UNAVAILABLE');
    expect(h.abandon).toHaveBeenCalledWith('reserva-1');
    expect(h.complete).not.toHaveBeenCalled();
  });
});

describe('descarga autorizada de archivos (RB1-22)', () => {
  function storeFile(
    h: ReturnType<typeof harness>,
    overrides: Partial<FileRecord> = {},
    seed = true,
  ) {
    const record: FileRecord = {
      id: '0190f000-0000-7000-8000-0000000000bb',
      nombreOriginal: 'acta.pdf',
      mime: 'application/pdf',
      tamano: 4,
      hashSha256: 'b'.repeat(64),
      rutaObjeto: 'objects/sha256/' + 'b'.repeat(64),
      subidoPor: OWNER.userId,
      estadoEscaneo: 'limpio',
      creadoEn: new Date('2026-11-19T10:00:00Z'),
      ...overrides,
    };
    h.lookup.set(record.id, record);
    if (seed) {
      h.stored.set(record.rutaObjeto, Buffer.from('data'));
    }
    return record;
  }

  it('oculta como 404 un archivo ajeno', async () => {
    const h = harness();
    const record = storeFile(h);

    await expect(
      codeOf(h.service.download({ id: record.id, actor: OTHER, context: CONTEXT })),
    ).resolves.toBe('FILE_NOT_FOUND');
    expect(h.get).not.toHaveBeenCalled();
    expect(h.auditRecord).not.toHaveBeenCalled();
  });

  it('permite la descarga propia y audita antes de entregar', async () => {
    const h = harness();
    const record = storeFile(h);

    const result = await h.service.download({
      id: record.id,
      actor: OWNER,
      context: CONTEXT,
    });

    expect(result.body).toBeInstanceOf(Buffer);
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'archivo.descargado', recursoId: record.id }),
    );
  });

  it('permite a quien tiene permiso global descargar archivos ajenos', async () => {
    const h = harness();
    const record = storeFile(h);

    await expect(
      h.service.download({
        id: record.id,
        actor: { ...OTHER, permissions: ['files:document:read'] },
        context: CONTEXT,
      }),
    ).resolves.toMatchObject({ record: { id: record.id } });
  });

  it('oculta los archivos en cuarentena', async () => {
    const h = harness();
    const record = storeFile(h, { estadoEscaneo: 'infectado' });

    await expect(
      codeOf(h.service.download({ id: record.id, actor: OWNER, context: CONTEXT })),
    ).resolves.toBe('FILE_NOT_FOUND');
    expect(h.get).not.toHaveBeenCalled();
  });

  it('no entrega contenido si la auditoría falla (AC-AUD-04)', async () => {
    const h = harness();
    const record = storeFile(h);
    h.auditRecord.mockRejectedValueOnce(new Error('auditoría caída'));

    await expect(
      h.service.download({ id: record.id, actor: OWNER, context: CONTEXT }),
    ).rejects.toThrow('auditoría caída');
  });

  it('traduce un objeto perdido a 404 y una caída del almacenamiento a 503', async () => {
    const h = harness();
    const record = storeFile(h, {}, false);

    await expect(
      codeOf(h.service.download({ id: record.id, actor: OWNER, context: CONTEXT })),
    ).resolves.toBe('FILE_NOT_FOUND');

    h.get.mockRejectedValueOnce(new ObjectStorageError('caído'));
    await expect(
      codeOf(h.service.download({ id: record.id, actor: OWNER, context: CONTEXT })),
    ).resolves.toBe('FILE_STORAGE_UNAVAILABLE');
  });
});
