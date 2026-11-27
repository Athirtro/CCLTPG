/** Extrae un mensaje legible de errores de red sin usar `any`. */
type ApiFieldErrorLike = {
  field?: unknown;
  detail?: unknown;
};

type ApiProblemLike = {
  detail?: unknown;
  message?: unknown;
  errors?: unknown;
};

type ApiErrorLike = ApiProblemLike & {
  response?: { data?: ApiProblemLike };
};

function firstFieldDetail(errors: unknown): string | undefined {
  if (!Array.isArray(errors)) return undefined;
  for (const item of errors) {
    if (typeof item !== 'object' || item === null) continue;
    const detail = (item as ApiFieldErrorLike).detail;
    if (typeof detail === 'string' && detail.length > 0) return detail;
  }
  return undefined;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error !== 'object' || error === null) return '';

  const candidate = error as ApiErrorLike;
  const problem = candidate.response?.data ?? candidate;
  const detail =
    firstFieldDetail(problem.errors) ?? problem.detail ?? problem.message ?? candidate.message;

  return typeof detail === 'string' ? detail : '';
}
