import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../../shared/errors/app-error.js';

/**
 * Códigos estables del contrato académico (C4). Se congelan al cierre de la
 * iteración: el frontend los usa como clave de traducción.
 */
export const ACADEMIC_ERRORS = {
  resourceNotFound: 'RESOURCE_NOT_FOUND',
  validationFailed: 'VALIDATION_FAILED',
  invalidStateTransition: 'INVALID_STATE_TRANSITION',
  groupClosed: 'GROUP_CLOSED',
  groupCapacityExceeded: 'GROUP_CAPACITY_EXCEEDED',
  enrollmentDuplicate: 'ENROLLMENT_DUPLICATE',
  studentDuplicate: 'STUDENT_DUPLICATE',
  consentRequired: 'CONSENT_REQUIRED',
  scheduleOverlap: 'SCHEDULE_OVERLAP',
  scheduleInvalidRange: 'SCHEDULE_INVALID_RANGE',
  invalidPeriod: 'INVALID_PERIOD',
  educatorInvalid: 'EDUCATOR_INVALID',
  idempotencyKeyRequired: 'IDEMPOTENCY_KEY_REQUIRED',
  idempotencyKeyReused: 'IDEMPOTENCY_KEY_REUSED',
  idempotencyInProgress: 'IDEMPOTENCY_IN_PROGRESS',
} as const;

export type AcademicErrorCode = (typeof ACADEMIC_ERRORS)[keyof typeof ACADEMIC_ERRORS];

export class AcademicError extends AppError {
  constructor(code: AcademicErrorCode, status: HttpStatus, detail: string) {
    super(code, status, detail);
  }

  static notFound(recurso: string): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.resourceNotFound,
      HttpStatus.NOT_FOUND,
      `${recurso} inexistente.`,
    );
  }

  static invalidInput(detail: string): AcademicError {
    return new AcademicError(ACADEMIC_ERRORS.validationFailed, HttpStatus.BAD_REQUEST, detail);
  }

  static invalidTransition(from: string, to: string): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.invalidStateTransition,
      HttpStatus.CONFLICT,
      `Transición no permitida de "${from}" a "${to}".`,
    );
  }

  static groupClosed(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.groupClosed,
      HttpStatus.CONFLICT,
      'El grupo está cerrado y no admite matrículas.',
    );
  }

  static capacityExceeded(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.groupCapacityExceeded,
      HttpStatus.CONFLICT,
      'El grupo alcanzó su cupo máximo.',
    );
  }

  static enrollmentDuplicate(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.enrollmentDuplicate,
      HttpStatus.CONFLICT,
      'Ya existe una matrícula vigente para ese estudiante, grupo y periodo.',
    );
  }

  static studentDuplicate(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.studentDuplicate,
      HttpStatus.CONFLICT,
      'Ya existe un estudiante con ese documento.',
    );
  }

  static consentRequired(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.consentRequired,
      HttpStatus.BAD_REQUEST,
      'El consentimiento de datos es obligatorio y debe estar aceptado.',
    );
  }

  static scheduleOverlap(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.scheduleOverlap,
      HttpStatus.CONFLICT,
      'El horario se solapa con otro grupo del mismo educador o salón.',
    );
  }

  static scheduleInvalidRange(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.scheduleInvalidRange,
      HttpStatus.BAD_REQUEST,
      'Cada franja debe tener un rango horario válido (horaFin > horaInicio).',
    );
  }

  static invalidPeriod(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.invalidPeriod,
      HttpStatus.BAD_REQUEST,
      'El periodo debe tener el formato YYYY-P.',
    );
  }

  static educatorInvalid(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.educatorInvalid,
      HttpStatus.BAD_REQUEST,
      'El educador indicado no existe o no está activo.',
    );
  }

  static idempotencyKeyRequired(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.idempotencyKeyRequired,
      HttpStatus.BAD_REQUEST,
      'La cabecera Idempotency-Key es obligatoria.',
    );
  }

  static idempotencyKeyReused(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.idempotencyKeyReused,
      HttpStatus.CONFLICT,
      'La Idempotency-Key ya se usó con un cuerpo distinto.',
    );
  }

  static idempotencyInProgress(): AcademicError {
    return new AcademicError(
      ACADEMIC_ERRORS.idempotencyInProgress,
      HttpStatus.CONFLICT,
      'Hay una solicitud en curso con la misma Idempotency-Key.',
    );
  }
}
