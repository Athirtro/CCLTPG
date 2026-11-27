import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../database/database.module.js';
import type { Database } from '../../database/schema.js';
import { KyselyReportDataProvider } from '../../database/analytics/kysely-report-data.provider.js';
import { REPORT_DATA_PORT } from '../../shared/analytics/report-data.port.js';
import { ExportsController } from './api/exports.controller.js';
import { ReportsController } from './api/reports.controller.js';
import { ExportsService } from './application/exports.service.js';
import { ReportGenerationService } from './application/report-generation.service.js';
import { ExportRenderer } from './application/ports/export-renderer.js';
import { ExportsUnitOfWork } from './application/ports/unit-of-work.js';
import { DefaultExportRenderer } from './infrastructure/default-export-renderer.js';
import { KyselyExportsUnitOfWork } from './infrastructure/persistence/kysely-unit-of-work.js';

@Module({
  controllers: [ExportsController, ReportsController],
  providers: [
    {
      provide: REPORT_DATA_PORT,
      useFactory: (db: Kysely<Database>) => new KyselyReportDataProvider(db),
      inject: [DATABASE],
    },
    { provide: ExportsUnitOfWork, useClass: KyselyExportsUnitOfWork },
    { provide: ExportRenderer, useClass: DefaultExportRenderer },
    ExportsService,
    ReportGenerationService,
  ],
  // Aditivo: permite que el puente de integración reutilice la generación de
  // PDF sin que Exportaciones conozca al contexto Emisora.
  exports: [ExportsService],
})
export class ExportsModule {}
