import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../../shared/errors/app-error.js';

/**
 * Códigos estables de archivos (contrato C3, §9 de `controles-seguridad-v1`).
 * Se congelan al cierre de C3: el frontend los usa como clave de traducción.
 */
export const FILE_ERRORS = {
  notFound: 'FILE_NOT_FOUND',
  empty: 'FILE_EMPTY',
  tooLarge: 'FILE_TOO_LARGE',
  mimeNotAllowed: 'FILE_MIME_NOT_ALLOWED',
  mimeMismatch: 'FILE_MIME_MISMATCH',
  nameInvalid: 'FILE_NAME_INVALID',
  infected: 'FILE_INFECTED',
  unavailable: 'FILE_STORAGE_UNAVAILABLE',
  idempotencyKeyRequired: 'IDEMPOTENCY_KEY_REQUIRED',
  idempotencyKeyReused: 'IDEMPOTENCY_KEY_REUSED',
  idempotencyInProgress: 'IDEMPOTENCY_IN_PROGRESS',
} as const;

export type FileErrorCode = (typeof FILE_ERRORS)[keyof typeof FILE_ERRORS];

export class FileError extends AppError {
  constructor(code: FileErrorCode, status: HttpStatus, detail: string) {
    super(code, status, detail);
  }

  static notFound(): FileError {
    return new FileError(FILE_ERRORS.notFound, HttpStatus.NOT_FOUND, 'Archivo inexistente.');
  }

  static empty(): FileError {
    return new FileError(FILE_ERRORS.empty, HttpStatus.BAD_REQUEST, 'El archivo está vacío.');
  }

  static tooLarge(): FileError {
    return new FileError(
      FILE_ERRORS.tooLarge,
      HttpStatus.PAYLOAD_TOO_LARGE,
      'El archivo supera el límite permitido.',
    );
  }

  static mimeNotAllowed(): FileError {
    return new FileError(
      FILE_ERRORS.mimeNotAllowed,
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      'Tipo de archivo no permitido.',
    );
  }

  static mimeMismatch(): FileError {
    return new FileError(
      FILE_ERRORS.mimeMismatch,
      HttpStatus.UNPROCESSABLE_ENTITY,
      'El contenido no coincide con el tipo declarado.',
    );
  }

  static nameInvalid(): FileError {
    return new FileError(
      FILE_ERRORS.nameInvalid,
      HttpStatus.BAD_REQUEST,
      'El nombre del archivo no es válido.',
    );
  }

  static idempotencyKeyRequired(): FileError {
    return new FileError(
      FILE_ERRORS.idempotencyKeyRequired,
      HttpStatus.BAD_REQUEST,
      'La cabecera Idempotency-Key es obligatoria.',
    );
  }

  static idempotencyKeyReused(): FileError {
    return new FileError(
      FILE_ERRORS.idempotencyKeyReused,
      HttpStatus.CONFLICT,
      'La clave de idempotencia ya se usó con un cuerpo distinto.',
    );
  }

  static idempotencyInProgress(): FileError {
    return new FileError(
      FILE_ERRORS.idempotencyInProgress,
      HttpStatus.CONFLICT,
      'La solicitud con esta clave sigue en proceso.',
    );
  }
}
