/**
 * Formato de error único del sistema (RFC 9457 — Problem Details).
 * `code` es el discriminador estable que consume el frontend; `type` se mantiene
 * en `about:blank` hasta que exista un catálogo público de tipos.
 */
export interface ProblemFieldError {
  field: string;
  code: string;
  detail: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  errors?: ProblemFieldError[];
  requestId: string;
}

export const PROBLEM_DETAILS_CONTENT_TYPE = 'application/problem+json';

export const PROBLEM_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export const PROBLEM_CODES: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'AUTHENTICATION_REQUIRED',
  403: 'PERMISSION_DENIED',
  404: 'RESOURCE_NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  406: 'NOT_ACCEPTABLE',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'UPSTREAM_UNAVAILABLE',
  503: 'SERVICE_UNAVAILABLE',
  504: 'UPSTREAM_TIMEOUT',
};

export function titleForStatus(status: number): string {
  return PROBLEM_TITLES[status] ?? 'Error';
}

export function codeForStatus(status: number): string {
  return PROBLEM_CODES[status] ?? 'HTTP_ERROR';
}
