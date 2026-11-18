import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  PROBLEM_DETAILS_CONTENT_TYPE,
  type ProblemDetails,
  type ProblemFieldError,
  codeForStatus,
  titleForStatus,
} from './problem-details.js';
import { asRecord, extractFieldErrors, firstMessage } from './problem-details.helpers.js';
import { getRequestId } from '../http/request-id.js';

interface NormalizedProblem {
  status: number;
  code: string;
  detail: string;
  errors?: ProblemFieldError[];
}

/**
 * Traduce cualquier excepción al contrato Problem Details.
 * Nunca expone trazas, SQL, tokens ni PII: los errores 5xx se registran y se
 * responden con un mensaje genérico correlacionado por `requestId`.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger(ProblemDetailsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const problem = this.normalize(exception);
    const requestId = getRequestId(request) ?? 'unknown';

    if (problem.status >= 500) {
      this.logger.error(
        {
          code: problem.code,
          requestId,
          method: request.method,
          path: request.originalUrl,
          exception,
        },
        'Error no controlado',
      );
    }

    const body: ProblemDetails = {
      type: 'about:blank',
      title: titleForStatus(problem.status),
      status: problem.status,
      detail: problem.detail,
      instance: request.originalUrl,
      code: problem.code,
      requestId,
    };

    if (problem.errors) {
      body.errors = problem.errors;
    }

    response
      .status(problem.status)
      .type(PROBLEM_DETAILS_CONTENT_TYPE)
      .json(body satisfies ProblemDetails);
  }

  private normalize(exception: unknown): NormalizedProblem {
    if (!(exception instanceof HttpException)) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: codeForStatus(HttpStatus.INTERNAL_SERVER_ERROR),
        detail: 'Se produjo un error inesperado. Contacte al administrador con el requestId.',
      };
    }

    const status = exception.getStatus();
    const payload = exception.getResponse();
    const fallbackCode = codeForStatus(status);
    const fallbackDetail = titleForStatus(status);

    if (typeof payload === 'string') {
      return {
        status,
        code: fallbackCode,
        detail: payload,
      };
    }

    const record = asRecord(payload);
    if (!record) {
      return { status, code: fallbackCode, detail: fallbackDetail };
    }

    const code = typeof record.code === 'string' ? record.code : fallbackCode;
    const detail = firstMessage(record.detail) ?? firstMessage(record.message) ?? fallbackDetail;
    const errors = extractFieldErrors(record.errors);

    return errors ? { status, code, detail, errors } : { status, code, detail };
  }
}
