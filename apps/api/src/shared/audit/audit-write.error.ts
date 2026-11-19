import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * La auditoría es obligatoria (AC-AUD-10): si el evento no se puede escribir,
 * la transacción del cambio se revierte y la API responde 503 con un código
 * estable. El error interno se conserva como `cause` para los logs.
 */
export class AuditWriteError extends HttpException {
  constructor(cause?: unknown) {
    super(
      {
        code: 'SERVICE_UNAVAILABLE',
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        detail: 'La auditoría no está disponible; la operación se revirtió.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
      cause === undefined ? undefined : { cause },
    );
  }
}
