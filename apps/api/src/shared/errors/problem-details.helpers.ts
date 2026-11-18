import type { ProblemFieldError } from './problem-details.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFieldError(value: unknown): value is ProblemFieldError {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.field === 'string' &&
    typeof value.code === 'string' &&
    typeof value.detail === 'string'
  );
}

export function extractFieldErrors(value: unknown): ProblemFieldError[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const errors = value.filter(isFieldError);
  return errors.length > 0 ? errors : undefined;
}

export function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const messages = value.filter((item): item is string => typeof item === 'string');
    return messages.length > 0 ? messages.join(' ') : undefined;
  }

  return undefined;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}
