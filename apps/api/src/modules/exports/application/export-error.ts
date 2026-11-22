import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../../shared/errors/app-error.js';

export const EXPORT_ERRORS = {
  templateNotFound: 'EXPORT_TEMPLATE_NOT_FOUND',
  formatNotSupported: 'EXPORT_FORMAT_NOT_SUPPORTED',
  parametersInvalid: 'EXPORT_PARAMETERS_INVALID',
  tooLarge: 'EXPORT_TOO_LARGE',
  generationFailed: 'EXPORT_GENERATION_FAILED',
  idempotencyKeyRequired: 'IDEMPOTENCY_KEY_REQUIRED',
  idempotencyKeyReused: 'IDEMPOTENCY_KEY_REUSED',
  idempotencyInProgress: 'IDEMPOTENCY_IN_PROGRESS',
} as const;

export type ExportErrorCode = (typeof EXPORT_ERRORS)[keyof typeof EXPORT_ERRORS];

export class ExportError extends AppError {
  constructor(code: ExportErrorCode, status: HttpStatus, detail: string) {
    super(code, status, detail);
  }

  static templateNotFound(codigo: string): ExportError {
    return new ExportError(
      EXPORT_ERRORS.templateNotFound,
      HttpStatus.NOT_FOUND,
      `La plantilla de exportación "${codigo}" no existe.`,
    );
  }

  static formatNotSupported(formato: string): ExportError {
    return new ExportError(
      EXPORT_ERRORS.formatNotSupported,
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      `El formato "${formato}" no está soportado.`,
    );
  }

  static parametersInvalid(detail: string): ExportError {
    return new ExportError(EXPORT_ERRORS.parametersInvalid, HttpStatus.BAD_REQUEST, detail);
  }

  static tooLarge(): ExportError {
    return new ExportError(
      EXPORT_ERRORS.tooLarge,
      HttpStatus.PAYLOAD_TOO_LARGE,
      'La exportación supera el tamaño máximo permitido.',
    );
  }
}
