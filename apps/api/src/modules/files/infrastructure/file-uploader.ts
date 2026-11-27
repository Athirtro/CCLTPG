import { Injectable } from '@nestjs/common';

import type {
  ArchivoSubido,
  FileUploader,
  SubirArchivoInput,
} from '../../../shared/integration/file-uploader.port.js';
import { FileService } from '../application/file.service.js';

/** Adaptador aditivo: publica `FileService` sin acoplar a emisora al contexto. */
@Injectable()
export class SharedFileUploader implements FileUploader {
  constructor(private readonly service: FileService) {}

  async upload(input: SubirArchivoInput): Promise<ArchivoSubido> {
    const archivo = await this.service.upload({
      buffer: input.archivo.buffer,
      nombreOriginal: input.archivo.nombreOriginal,
      mime: input.archivo.mime,
      politica: input.politica,
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      context: input.context,
    });
    return { id: archivo.id, hashSha256: archivo.hashSha256 };
  }
}
