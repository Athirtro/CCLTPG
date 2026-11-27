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
  mifiAntelacionInsuficiente: 'EMISORA_MIFI_ANTELACION_INSUFICIENTE',
  viaticoNoFueraCiudad: 'EMISORA_VIATICO_NO_FUERA_CIUDAD',
  transmisionSinSoportes: 'EMISORA_TRANSMISION_SIN_SOPORTES',
  patrocinioSinContrato: 'EMISORA_PATROCINIO_SIN_CONTRATO',
  promoSinAudio: 'EMISORA_PROMO_SIN_AUDIO',
  resolucionYaExistente: 'EMISORA_RESOLUCION_YA_EXISTENTE',
  incentivoNoResuelto: 'EMISORA_INCENTIVO_NO_RESUELTO',
  lecturaDuplicada: 'EMISORA_LECTURA_DUPLICADA',
  planillaDuplicada: 'EMISORA_PLANILLA_DUPLICADA',
  proyeccionDuplicada: 'EMISORA_PROYECCION_DUPLICADA',
  equipoDuplicado: 'EMISORA_EQUIPO_DUPLICADO',
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

  /** RF-03.7: solo un incentivo resuelto puede derivar en resolución PDF. */
  static incentivoNoResuelto(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.incentivoNoResuelto,
      HttpStatus.CONFLICT,
      'El incentivo debe estar resuelto para generar la resolución.',
    );
  }

  static resolucionYaExistente(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.resolucionYaExistente,
      HttpStatus.CONFLICT,
      'Ya existe una resolución para este incentivo.',
    );
  }

  static patrocinioSinContrato(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.patrocinioSinContrato,
      HttpStatus.BAD_REQUEST,
      'Aprobar un patrocinio exige un contrato PDF limpio.',
    );
  }

  static promoSinAudio(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.promoSinAudio,
      HttpStatus.BAD_REQUEST,
      'Producir una promo exige un archivo de audio limpio.',
    );
  }

  static transmisionSinSoportes(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.transmisionSinSoportes,
      HttpStatus.CONFLICT,
      'La transmisión exige salida de equipo y reporte de desplazamiento.',
    );
  }

  static mifiAntelacionInsuficiente(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.mifiAntelacionInsuficiente,
      HttpStatus.BAD_REQUEST,
      'El préstamo de mifi debe solicitarse al menos dos días antes de la transmisión.',
    );
  }

  static viaticoNoFueraCiudad(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.viaticoNoFueraCiudad,
      HttpStatus.BAD_REQUEST,
      'Los viáticos solo aplican a transmisiones fuera de la ciudad.',
    );
  }

  static lecturaDuplicada(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.lecturaDuplicada,
      HttpStatus.CONFLICT,
      'Ya existe una lectura para este transmisor en la fecha indicada.',
    );
  }

  static planillaDuplicada(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.planillaDuplicada,
      HttpStatus.CONFLICT,
      'Ya existe una planilla para esta fecha.',
    );
  }

  static proyeccionDuplicada(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.proyeccionDuplicada,
      HttpStatus.CONFLICT,
      'Ya existe una proyección para este año.',
    );
  }

  static equipoDuplicado(): EmisoraError {
    return new EmisoraError(
      EMISORA_ERRORS.equipoDuplicado,
      HttpStatus.CONFLICT,
      'Ya existe un equipo con este número de serie.',
    );
  }
}
