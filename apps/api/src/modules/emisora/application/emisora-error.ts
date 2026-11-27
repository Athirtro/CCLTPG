import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../../shared/errors/app-error.js';

/** Códigos estables de la API emisora (plan §9 y matriz de autorización). */
export const EMISORA_ERRORS = {
  resourceNotFound: 'RESOURCE_NOT_FOUND',
  validationFailed: 'VALIDATION_FAILED',
  invalidStateTransition: 'INVALID_STATE_TRANSITION',
  convocatoriaDuplicate: 'CONVOCATORIA_DUPLICADA',
  convocatoriaClosed: 'CONVOCATORIA_CERRADA',
  rejillaSinActa: 'REJILLA_SIN_ACTA',
  scheduleOverlap: 'SCHEDULE_OVERLAP',
  fueraVentanaInforme: 'EMISORA_FUERA_VENTANA_INFORME',
  idempotencyKeyRequired: 'IDEMPOTENCY_KEY_REQUIRED',
  idempotencyKeyReused: 'IDEMPOTENCY_KEY_REUSED',
  idempotencyInProgress: 'IDEMPOTENCY_IN_PROGRESS',
} as const;

export type EmisoraErrorCode = (typeof EMISORA_ERRORS)[keyof typeof EMISORA_ERRORS];

export class EmisoraError extends AppError {
  constructor(code: EmisoraErrorCode, status: HttpStatus, detail: string) {
    super(code, status, detail);
  }

  static notFound(recurso: string): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.resourceNotFound,
      HttpStatus.NOT_FOUND,
      `${recurso} inexistente o fuera de tu ámbito.`,
    );
  }

  static invalidInput(detail: string): EmisoraError {
    return new EmisoraError(EMISORA_ERRORS.validationFailed, HttpStatus.BAD_REQUEST, detail);
  }

  static conflict(code: EmisoraErrorCode, detail: string): EmisoraError {
    return new EmisoraError(code, HttpStatus.CONFLICT, detail);
  }

  static invalidTransition(from: string, to: string): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.invalidStateTransition,
      HttpStatus.CONFLICT,
      `Transición no permitida de "${from}" a "${to}".`,
    );
  }

  static fueraVentanaInforme(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.fueraVentanaInforme,
      HttpStatus.BAD_REQUEST,
      'El informe debe fecharse en octubre o noviembre.',
    );
  }

  static idempotencyKeyRequired(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.idempotencyKeyRequired,
      HttpStatus.BAD_REQUEST,
      'La cabecera Idempotency-Key es obligatoria.',
    );
  }

  static idempotencyKeyReused(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.idempotencyKeyReused,
      HttpStatus.CONFLICT,
      'La clave de idempotencia ya se usó con otro cuerpo.',
    );
  }

  static idempotencyInProgress(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.idempotencyInProgress,
      HttpStatus.CONFLICT,
      'La operación con esta clave está en curso.',
    );
  }
}
