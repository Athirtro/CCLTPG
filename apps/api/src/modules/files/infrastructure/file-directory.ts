import { Inject, Injectable } from '@nestjs/common';

import type { FileDirectory, FileRef } from '../../../shared/integration/file-directory.port.js';
import { FileRepository } from '../application/ports/file.repository.js';

/** Implementación aditiva del directorio público de archivos. */
@Injectable()
export class SharedFileDirectory implements FileDirectory {
  constructor(@Inject(FileRepository) private readonly repository: FileRepository) {}

  async findById(id: string): Promise<FileRef | null> {
    const record = await this.repository.findById(id);
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      nombreOriginal: record.nombreOriginal,
      mime: record.mime,
      tamano: record.tamano,
      estadoEscaneo: record.estadoEscaneo,
      hashSha256: record.hashSha256,
    };
  }
}
