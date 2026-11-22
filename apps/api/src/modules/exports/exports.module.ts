import { Module } from '@nestjs/common';

import { ExportsController } from './api/exports.controller.js';
import { ExportsService } from './application/exports.service.js';
import { ExportRenderer } from './application/ports/export-renderer.js';
import { ExportsUnitOfWork } from './application/ports/unit-of-work.js';
import { DefaultExportRenderer } from './infrastructure/default-export-renderer.js';
import { KyselyExportsUnitOfWork } from './infrastructure/persistence/kysely-unit-of-work.js';

@Module({
  controllers: [ExportsController],
  providers: [
    { provide: ExportsUnitOfWork, useClass: KyselyExportsUnitOfWork },
    { provide: ExportRenderer, useClass: DefaultExportRenderer },
    ExportsService,
  ],
})
export class ExportsModule {}
