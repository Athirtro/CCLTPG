import { Module } from '@nestjs/common';

import { AcademicModule } from '../modules/academic/academic.module.js';
import { ExportsModule } from '../modules/exports/exports.module.js';
import { ExportsService } from '../modules/exports/application/exports.service.js';
import { FilesModule } from '../modules/files/files.module.js';
import { IdentityModule } from '../modules/identity/identity.module.js';
import { EMISORA_REPORT_EXPORTER } from '../modules/emisora/application/ports/report-exporter.port.js';
import { EmisoraReportExporterAdapter } from './emisora-report-exporter.js';
/**
 * Puente de composición del contexto Emisora R.A.C. (ADR-0005, decisión 3).
 *
 * Vive en `src/integration/`, fuera de `src/shared/` y de `src/modules/`: es la
 * única pieza que conoce a los contextos dueños de los puertos y los conecta
 * sin que emisora importe `identity`, `academic` ni `exports`. Así `arch:check`
 * sigue prohibiendo las importaciones cruzadas entre contextos y `shared` sigue
 * sin depender de ellos. Reexportar los módulos (no los tokens sueltos) es lo
 * que permite a `EmisoraModule` inyectar los proveedores exportados por ellos.
 * No registra controladores ni casos de uso nuevos.
 */
@Module({
  imports: [IdentityModule, AcademicModule, FilesModule, ExportsModule],
  providers: [
    {
      provide: EMISORA_REPORT_EXPORTER,
      useFactory: (exportsService: ExportsService) =>
        new EmisoraReportExporterAdapter(exportsService),
      inject: [ExportsService],
    },
  ],
  exports: [IdentityModule, AcademicModule, FilesModule, ExportsModule, EMISORA_REPORT_EXPORTER],
})
export class EmisoraIntegrationModule {}
