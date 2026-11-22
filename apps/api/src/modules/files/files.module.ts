import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../database/database.module.js';
import type { Database } from '../../database/schema.js';
import { FilesController } from './api/files.controller.js';
import { FileService } from './application/file.service.js';
import { FileInspector } from './application/ports/file-inspector.js';
import { FileRepository } from './application/ports/file.repository.js';
import { FilesUnitOfWork } from './application/ports/unit-of-work.js';
import { FileTypeInspector } from './infrastructure/file-type-inspector.js';
import { KyselyFileRepository } from './infrastructure/persistence/kysely-file.repository.js';
import { KyselyFilesUnitOfWork } from './infrastructure/persistence/kysely-unit-of-work.js';

@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: FileRepository,
      useFactory: (db: Kysely<Database>) => new KyselyFileRepository(db),
      inject: [DATABASE],
    },
    { provide: FilesUnitOfWork, useClass: KyselyFilesUnitOfWork },
    { provide: FileInspector, useClass: FileTypeInspector },
    FileService,
  ],
})
export class FilesModule {}
