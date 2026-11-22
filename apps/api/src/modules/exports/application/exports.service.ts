import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { env } from '../../../shared/config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import { canonicalJson, sha256Hex } from '../../../shared/idempotency/canonical-hash.js';
import {
  OBJECT_STORAGE,
  ObjectStorageError,
  type ObjectStorage,
} from '../../../shared/storage/object-storage.port.js';
import { ExportError } from './export-error.js';
import { ExportRenderer } from './ports/export-renderer.js';
import { ExportsUnitOfWork } from './ports/unit-of-work.js';
import {
  EXPORT_FORMATS,
  findExportTemplate,
  isExportTemplateParameterError,
  type ExportFormat,
} from '../domain/export-templates.js';

export interface ExportActor {
  userId: string;
  actorProfile: string | null;
}

export interface ExportRequestContext {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface CreateExportInput {
  plantilla: string;
  formato: string;
  parametros: unknown;
  idempotencyKey: string | null;
  actor: ExportActor;
  context: ExportRequestContext;
}

export interface ExportView {
  archivoId: string;
  nombre: string;
  mime: string;
  tamano: number;
  formato: ExportFormat;
  hashSha256: string;
  descargaUrl: string;
}

/**
 * Servicio de exportaciones (C3 — RB1-24).
 *
 * Las plantillas viven en código y reciben JSON saneado. La salida se registra
 * como `archivo` y se descarga por la única puerta autorizada (RB1-22).
 */
@Injectable()
export class ExportsService {
  constructor(
    @Inject(ExportsUnitOfWork) private readonly unitOfWork: ExportsUnitOfWork,
    @Inject(ExportRenderer) private readonly renderer: ExportRenderer,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
  ) {}

  async create(input: CreateExportInput): Promise<ExportView> {
    const key = input.idempotencyKey?.trim();
    if (!key) {
      throw new ExportError(
        'IDEMPOTENCY_KEY_REQUIRED',
        HttpStatus.BAD_REQUEST,
        'La cabecera Idempotency-Key es obligatoria.',
      );
    }

    if (!isExportFormat(input.formato)) {
      throw ExportError.formatNotSupported(input.formato);
    }
    const formato = input.formato;

    const hashSolicitud = sha256Hex(
      canonicalJson({
        operacion: 'exports:create',
        plantilla: input.plantilla,
        formato,
        parametros: input.parametros,
      }),
    );

    const reservation = await this.idempotency.reserve({
      usuarioId: input.actor.userId,
      operacion: 'exports:create',
      clave: key,
      hashSolicitud,
      ttlSeconds: env.IDEMPOTENCY_TTL_SECONDS,
    });

    if (reservation.status === 'repetir') {
      return reservation.responseBody as ExportView;
    }
    if (reservation.status === 'conflicto') {
      throw new ExportError(
        'IDEMPOTENCY_KEY_REUSED',
        HttpStatus.CONFLICT,
        'La clave de idempotencia ya se usó con un cuerpo distinto.',
      );
    }
    if (reservation.status === 'en_proceso') {
      throw new ExportError(
        'IDEMPOTENCY_IN_PROGRESS',
        HttpStatus.CONFLICT,
        'La solicitud con esta clave sigue en proceso.',
      );
    }

    let storedObject: string | null = null;

    try {
      const template = findExportTemplate(input.plantilla);
      if (!template) {
        throw ExportError.templateNotFound(input.plantilla);
      }

      let rows;
      try {
        rows = template.build(input.parametros);
      } catch (error) {
        if (isExportTemplateParameterError(error)) {
          throw ExportError.parametersInvalid(error.message);
        }
        throw error;
      }

      if (rows.length > env.EXPORT_MAX_ROWS) {
        throw ExportError.parametersInvalid(
          `La exportación supera el máximo de ${env.EXPORT_MAX_ROWS} filas.`,
        );
      }

      const rendered = await this.renderer.render(
        formato,
        template.descripcion,
        template.columns,
        rows,
      );

      if (rendered.buffer.length > env.EXPORT_MAX_BYTES) {
        throw ExportError.tooLarge();
      }

      const archivoId = uuidv7();
      const nombre = `${template.codigo}-v${template.version}.${rendered.extension}`;
      const rutaObjeto = `exports/${archivoId}/${nombre}`;
      const hashSha256 = sha256Hex(rendered.buffer);

      await this.storage.put(rutaObjeto, rendered.buffer, rendered.mime);
      storedObject = rutaObjeto;

      await this.unitOfWork.run(async (tx) => {
        await tx.files.create({
          id: archivoId,
          nombreOriginal: nombre,
          mime: rendered.mime,
          tamano: rendered.buffer.length,
          hashSha256,
          rutaObjeto,
          subidoPor: input.actor.userId,
        });

        await tx.audit.record({
          accion: 'reporte.generado',
          recurso: 'archivo',
          recursoId: archivoId,
          actorId: input.actor.userId,
          actorPerfil: input.actor.actorProfile,
          ip: input.context.ip,
          dispositivo: input.context.userAgent,
          datosDespues: {
            plantilla: template.codigo,
            version: template.version,
            formato,
            filas: rows.length,
            tamano: rendered.buffer.length,
          },
          requestId: input.context.requestId,
        });

        await tx.outbox.enqueue({
          id: uuidv7(),
          tipo: 'reporte.generado',
          agregado: 'archivo',
          ocurridoEn: new Date(),
          payload: {
            archivoId,
            plantilla: template.codigo,
            formato,
            filas: rows.length,
          },
          usuarioIds: [input.actor.userId],
        });
      });

      const view: ExportView = {
        archivoId,
        nombre,
        mime: rendered.mime,
        tamano: rendered.buffer.length,
        formato,
        hashSha256,
        descargaUrl: `${env.API_PREFIX}/files/${archivoId}/download`,
      };

      await this.idempotency.complete(reservation.id, 201, view);
      return view;
    } catch (error) {
      await this.idempotency.abandon(reservation.id).catch(() => undefined);
      if (storedObject) {
        await this.storage.delete(storedObject).catch(() => undefined);
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
}

function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}
