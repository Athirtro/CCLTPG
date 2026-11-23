import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../../shared/errors/app-error.js';

/** Códigos estables del contrato de analítica (C6). */
export const ANALYTICS_ERRORS = {
  resourceNotFound: 'RESOURCE_NOT_FOUND',
  validationFailed: 'VALIDATION_FAILED',
  invalidPeriod: 'INVALID_PERIOD',
  reportNotFound: 'REPORT_NOT_FOUND',
  kpiNotFound: 'KPI_NOT_FOUND',
} as const;

export type AnalyticsErrorCode = (typeof ANALYTICS_ERRORS)[keyof typeof ANALYTICS_ERRORS];

export class AnalyticsError extends AppError {
  constructor(code: AnalyticsErrorCode, status: HttpStatus, detail: string) {
    super(code, status, detail);
  }

  static notFound(recurso: string): AnalyticsError {
    return new AnalyticsError(
      ANALYTICS_ERRORS.resourceNotFound,
      HttpStatus.NOT_FOUND,
      `${recurso} inexistente.`,
    );
  }

  static invalidInput(detail: string): AnalyticsError {
    return new AnalyticsError(ANALYTICS_ERRORS.validationFailed, HttpStatus.BAD_REQUEST, detail);
  }

  static invalidPeriod(periodo: string): AnalyticsError {
    return new AnalyticsError(
      ANALYTICS_ERRORS.invalidPeriod,
      HttpStatus.BAD_REQUEST,
      `El periodo "${periodo}" no es válido.`,
    );
  }

  static reportNotFound(code: string): AnalyticsError {
    return new AnalyticsError(
      ANALYTICS_ERRORS.reportNotFound,
      HttpStatus.NOT_FOUND,
      `El reporte "${code}" no existe en el catálogo.`,
    );
  }

  static kpiNotFound(code: string): AnalyticsError {
    return new AnalyticsError(
      ANALYTICS_ERRORS.kpiNotFound,
      HttpStatus.NOT_FOUND,
      `El KPI "${code}" no existe en el catálogo.`,
    );
  }
}
