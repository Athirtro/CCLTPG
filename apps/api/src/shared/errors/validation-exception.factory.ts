import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import type { ProblemFieldError } from './problem-details.js';

function flatten(errors: ValidationError[], parent = ''): ProblemFieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([code, detail]) => ({
      field,
      code,
      detail,
    }));
    const children = error.children?.length ? flatten(error.children, field) : [];
    return [...own, ...children];
  });
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_FAILED',
    detail: 'La solicitud contiene campos inválidos.',
    errors: flatten(errors),
  });
}
