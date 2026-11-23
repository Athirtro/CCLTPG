import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../../shared/errors/app-error.js';
import {
  findReport,
  REPORT_DEFINITIONS,
  type AnalyticsFormat,
} from '../../../shared/analytics/analytics-catalog.js';
import {
  REPORT_DATA_PORT,
  type AnalyticsReportFilter,
  type ReportDataPort,
} from '../../../shared/analytics/report-data.port.js';
import { ExportsService, type ExportRequestContext, type ExportView } from './exports.service.js';

const PERIOD_PATTERN = /^[0-9]{4}-[0-9]+$/u;
const FORMATS = new Set(['pdf', 'xlsx', 'csv']);

export interface ReportActor {
  userId: string;
  actorProfile: string | null;
  permissions: readonly string[];
}

export interface GenerateReportInput {
  code: string;
  periodo: string;
  formato: string;
  programaId: string | null;
  grupoId: string | null;
  idempotencyKey: string | null;
  actor: ReportActor;
  context: ExportRequestContext;
}

/** Genera reportes académicos reutilizando el servicio de exportaciones (D81). */
@Injectable()
export class ReportGenerationService {
  constructor(
    @Inject(REPORT_DATA_PORT) private readonly data: ReportDataPort,
    @Inject(ExportsService) private readonly exports: ExportsService,
  ) {}

  catalog(): Promise<
    ReadonlyArray<{
      code: string;
      nombre: string;
      descripcion: string;
      formatos: readonly AnalyticsFormat[];
      columnas: readonly { key: string; label: string }[];
    }>
  > {
    return Promise.resolve(
      REPORT_DEFINITIONS.map((definition) => ({
        code: definition.code,
        nombre: definition.nombre,
        descripcion: definition.descripcion,
        formatos: definition.formatos,
        columnas: definition.columnas,
      })),
    );
  }

  async generate(input: GenerateReportInput): Promise<ExportView> {
    const definition = findReport(input.code);
    if (!definition) {
      throw new AppError(
        'REPORT_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        `El reporte "${input.code}" no existe en el catálogo.`,
      );
    }
    if (!PERIOD_PATTERN.test(input.periodo)) {
      throw new AppError(
        'INVALID_PERIOD',
        HttpStatus.BAD_REQUEST,
        'El periodo debe tener el formato YYYY-P.',
      );
    }
    if (!FORMATS.has(input.formato)) {
      throw new AppError(
        'EXPORT_FORMAT_NOT_SUPPORTED',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        `El formato "${input.formato}" no está soportado.`,
      );
    }

    const vistoTodo = input.actor.permissions.includes('academic:group:manage');
    const educadorId = vistoTodo ? null : input.actor.userId;
    if (input.grupoId && educadorId) {
      const propio = await this.data.groupBelongsToEducador(input.grupoId, educadorId);
      if (!propio) {
        throw new AppError(
          'RESOURCE_NOT_FOUND',
          HttpStatus.NOT_FOUND,
          'El grupo solicitado no pertenece al educador autenticado.',
        );
      }
    }

    const filter: AnalyticsReportFilter = {
      periodo: input.periodo,
      programaId: input.programaId,
      grupoId: input.grupoId,
      educadorId,
    };
    const filas = await this.data.rowsFor(input.code, filter);

    return this.exports.create({
      plantilla: `reporte-${input.code}`,
      formato: input.formato,
      parametros: { periodo: input.periodo, reporte: input.code, filas },
      idempotencyKey: input.idempotencyKey,
      actor: { userId: input.actor.userId, actorProfile: input.actor.actorProfile },
      context: input.context,
    });
  }
}
