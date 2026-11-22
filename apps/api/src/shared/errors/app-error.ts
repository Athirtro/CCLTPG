import { HttpException, type HttpStatus } from '@nestjs/common';

/**
 * Error de dominio con código estable. El filtro global lo traduce a Problem
 * Details conservando `code` y `detail`.
 */
export class AppError extends HttpException {
  constructor(
    readonly code: string,
    status: HttpStatus,
    detail: string,
    options: { errors?: { field: string; code: string; detail: string }[] } = {},
  ) {
    super(
      { code, detail, statusCode: status, ...(options.errors ? { errors: options.errors } : {}) },
      status,
    );
  }
}
