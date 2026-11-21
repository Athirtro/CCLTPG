/** Extrae un mensaje legible de errores de red sin usar `any`. */
type ApiErrorLike = {
  message?: unknown;
  response?: {
    data?: {
      detail?: unknown;
      message?: unknown;
    };
  };
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error !== 'object' || error === null) {
    return '';
  }

  const candidate = error as ApiErrorLike;
  const detail = candidate.response?.data?.detail ?? candidate.response?.data?.message;

  if (typeof detail === 'string') {
    return detail;
  }

  return typeof candidate.message === 'string' ? candidate.message : '';
}
