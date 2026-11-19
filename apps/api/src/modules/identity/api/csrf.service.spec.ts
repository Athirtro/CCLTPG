import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { CSRF_COOKIE } from './auth-cookies.js';
import { CsrfService } from './csrf.service.js';

const csrf = new CsrfService();
const CSRF_TEST_VALUE = '0123456789abcdef0123456789abcdef';

function request(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe('CSRF de doble envío (AC-SEC-13)', () => {
  it('acepta cookie y cabecera iguales', () => {
    expect(() =>
      csrf.assert(
        request({ cookie: `${CSRF_COOKIE}=${CSRF_TEST_VALUE}`, 'x-csrf-token': CSRF_TEST_VALUE }),
      ),
    ).not.toThrow();
  });

  it('rechaza cabecera ausente, cookie ausente o valores distintos', () => {
    const cases: Array<Record<string, string>> = [
      { cookie: `${CSRF_COOKIE}=${CSRF_TEST_VALUE}` },
      { 'x-csrf-token': CSRF_TEST_VALUE },
      { cookie: `${CSRF_COOKIE}=${CSRF_TEST_VALUE}`, 'x-csrf-token': `${CSRF_TEST_VALUE}x` },
    ];

    for (const headers of cases) {
      expect(() => csrf.assert(request(headers))).toThrowError(
        expect.objectContaining({ code: 'AUTH_CSRF_INVALID' }),
      );
    }
  });

  it('rechaza valores demasiado cortos aunque coincidan', () => {
    expect(() =>
      csrf.assert(request({ cookie: `${CSRF_COOKIE}=corto`, 'x-csrf-token': 'corto' })),
    ).toThrowError(expect.objectContaining({ code: 'AUTH_CSRF_INVALID' }));
  });
});
