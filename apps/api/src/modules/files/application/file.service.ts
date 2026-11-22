import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { AuditPort } from '../../../shared/audit/audit.port.js';
import { env } from '../../../shared/config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import { canonicalJson, sha256Hex } from '../../../shared/idempotency/canonical-hash.js';
import {
  MALWARE_SCANNER,
  type MalwareScanner,
} from '../../../shared/malware/malware-scanner.port.js';
import {
  OBJECT_STORAGE,
  ObjectNotFoundError,
  ObjectStorageError,
  type ObjectStorage,
} from '../../../shared/storage/object-storage.port.js';
import { AUDIT_PORT } from '../../../shared/audit/audit.port.js';
import { FileError } from './file-error.js';
import type {
  DownloadFileInput,
  DownloadFileResult,
  FileView,
  UploadFileInput,
} from './file.types.js';
import { toFileView } from './file.types.js';
import { FileInspector } from './ports/file-inspector.js';
import { FileRepository } from './ports/file.repository.js';
import { FilesUnitOfWork } from './ports/unit-of-work.js';
import { objectKeyFor, sanitizeOriginalName } from '../domain/file-policy.js';

/**
 * Servicio de archivos (C3 — RB1-21/RB1-22).
 *
 * La carga escribe el objeto después de verificar tipo, tamaño, nombre y
 * malware; la descarga exige permiso global o propiedad y audita antes de
 * responder (AC-AUD-04).
 */
@Injectable()
export class FileService {
  constructor(
    @Inject(FileRepository) private readonly repository: FileRepository,
    @Inject(FilesUnitOfWork) private readonly unitOfWork: FilesUnitOfWork,
    @Inject(FileInspector) private readonly inspector: FileInspector,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(MALWARE_SCANNER) private readonly scanner: MalwareScanner,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  async upload(input: UploadFileInput): Promise<FileView> {
    const key = input.idempotencyKey?.trim();
    if (!key) {
      throw FileError.idempotencyKeyRequired();
    }

    if (input.buffer.length === 0) {
      throw FileError.empty();
    }

    if (input.buffer.length > env.MAX_FILE_BYTES) {
      throw FileError.tooLarge();
    }

    const nombreOriginal = sanitizeOriginalName(input.nombreOriginal);
    const hashSha256 = sha256Hex(input.buffer);
    const hashSolicitud = sha256Hex(
      canonicalJson({
        operacion: 'files:upload',
        hashSha256,
        nombreOriginal,
        mime: input.mime,
      }),
    );

    const reservation = await this.idempotency.reserve({
      usuarioId: input.actor.userId,
      operacion: 'files:upload',
      clave: key,
      hashSolicitud,
      ttlSeconds: env.IDEMPOTENCY_TTL_SECONDS,
    });

    if (reservation.status === 'repetir') {
      return reservation.responseBody as FileView;
    }
    if (reservation.status === 'conflicto') {
      throw FileError.idempotencyKeyReused();
    }
    if (reservation.status === 'en_proceso') {
      throw FileError.idempotencyInProgress();
    }

    let storedNewObject = false;

    try {
      const inspected = await this.inspector.inspect(input.buffer, input.mime, nombreOriginal);
      const scan = await this.scanner.scan({
        buffer: input.buffer,
        nombreOriginal,
        mime: inspected.mime,
      });

      const estadoEscaneo = scan.infected ? 'infectado' : 'limpio';
      const rutaObjeto = objectKeyFor(hashSha256, estadoEscaneo);

      if (scan.infected) {
        // Nunca se conserva el contenido infectado.
        await this.storage.delete(rutaObjeto).catch(() => undefined);
      } else {
        const exists = await this.storage.exists(rutaObjeto);
        if (!exists) {
          await this.storage.put(rutaObjeto, input.buffer, inspected.mime);
          storedNewObject = true;
        }
      }

      const id = uuidv7();
      const record = await this.unitOfWork.run(async (tx) => {
        const created = await tx.files.create({
          id,
          nombreOriginal,
          mime: inspected.mime,
          tamano: input.buffer.length,
          hashSha256,
          rutaObjeto,
          subidoPor: input.actor.userId,
          estadoEscaneo,
        });

        await tx.audit.record({
          accion: scan.infected ? 'archivo.cuarentena' : 'archivo.subido',
          recurso: 'archivo',
          recursoId: created.id,
          actorId: input.actor.userId,
          actorPerfil: input.actor.actorProfile,
          ip: input.context.ip,
          dispositivo: input.context.userAgent,
          datosDespues: scan.infected
            ? { estado_escaneo: 'infectado', firma: scan.signature }
            : { mime: created.mime, tamano: created.tamano, hash_sha256: created.hashSha256 },
          requestId: input.context.requestId,
        });

        return created;
      });

      const view = toFileView(record);
      await this.idempotency.complete(reservation.id, 201, view);
      return view;
    } catch (error) {
      await this.idempotency.abandon(reservation.id).catch(() => undefined);

      if (storedNewObject) {
        const keyOfObject = objectKeyFor(hashSha256, 'limpio');
        await this.storage.delete(keyOfObject).catch(() => undefined);
      }

      if (error instanceof ObjectStorageError) {
        throw new AppError(
          'FILE_STORAGE_UNAVAILABLE',
          HttpStatus.SERVICE_UNAVAILABLE,
          'El almacenamiento de archivos no está disponible.',
        );
      }

      throw error;
    }
  }

  async download(input: DownloadFileInput): Promise<DownloadFileResult> {
    const record = await this.repository.findById(input.id);

    if (!record) {
      throw FileError.notFound();
    }

    const canReadGlobal = input.actor.permissions.includes('files:document:read');
    if (!canReadGlobal && record.subidoPor !== input.actor.userId) {
      throw FileError.notFound();
    }

    if (record.estadoEscaneo !== 'limpio') {
      throw FileError.notFound();
    }

    let body: Buffer;
    try {
      body = await this.storage.get(record.rutaObjeto);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        throw FileError.notFound();
      }
      throw new AppError(
        'FILE_STORAGE_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
        'El almacenamiento de archivos no está disponible.',
      );
    }

    // AC-AUD-04: el evento se escribe antes de enviar el contenido.
    await this.audit.record({
      accion: 'archivo.descargado',
      recurso: 'archivo',
      recursoId: record.id,
      actorId: input.actor.userId,
      actorPerfil: input.actor.actorProfile,
      ip: input.context.ip,
      dispositivo: input.context.userAgent,
      datosDespues: { mime: record.mime, tamano: record.tamano },
      requestId: input.context.requestId,
    });

    return { record, body };
  }
}
