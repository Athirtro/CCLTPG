import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { FullSession } from '../domain/identity.types.js';
import {
  clearSessionCookies,
  CSRF_COOKIE,
  parseCookie,
  REFRESH_COOKIE,
  setSessionCookies,
} from './auth-cookies.js';

function fakeResponse(): {
  response: Response;
  cookie: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
} {
  const cookie = vi.fn();
  const clearCookie = vi.fn();

  return {
    response: { cookie, clearCookie } as unknown as Response,
    cookie,
    clearCookie,
  };
}

function session(): FullSession {
  return {
    accessToken: 'acceso',
    refreshToken: 'refresco-opaco',
    csrfToken: 'csrf-opaco-de-32-bytes-o-mas',
    expiresIn: 900,
    sid: 'sid-cookie',
    jti: 'jti-cookie',
    refreshExpiresAt: new Date('2026-11-25T00:00:00.000Z'),
  };
}

describe('cookies de sesión (AC-SEC-12)', () => {
  it('usa prefijo __Host-, Secure, SameSite=Strict, Path=/ y sin Domain', () => {
    const { response, cookie } = fakeResponse();
    setSessionCookies(response, session());

    expect(cookie).toHaveBeenCalledTimes(2);
    const names = cookie.mock.calls.map((call) => call[0] as string);
    expect(names).toEqual([REFRESH_COOKIE, CSRF_COOKIE]);
    expect(names.every((name) => String(name).startsWith('__Host-'))).toBe(true);

    for (const [, , options] of cookie.mock.calls) {
      expect(options).toMatchObject({ secure: true, sameSite: 'strict', path: '/' });
      expect(options).not.toHaveProperty('domain');
    }

    expect(cookie.mock.calls[0]?.[2]).toMatchObject({ httpOnly: true });
    expect(cookie.mock.calls[1]?.[2]).toMatchObject({ httpOnly: false });
  });

  it('borra ambas cookies con los mismos atributos', () => {
    const { response, clearCookie } = fakeResponse();
    clearSessionCookies(response);

    expect(clearCookie.mock.calls.map((call) => call[0] as string)).toEqual([
      REFRESH_COOKIE,
      CSRF_COOKIE,
    ]);
    for (const [, options] of clearCookie.mock.calls) {
      expect(options).toMatchObject({ secure: true, sameSite: 'strict', path: '/' });
      expect(options).not.toHaveProperty('domain');
    }
  });

  it('parsea la cookie exacta sin confundir nombres parecidos', () => {
    const header = `otra=1; ${REFRESH_COOKIE}=abc%3D; ${CSRF_COOKIE}=xyz`;
    expect(parseCookie(header, REFRESH_COOKIE)).toBe('abc=');
    expect(parseCookie(header, CSRF_COOKIE)).toBe('xyz');
    expect(parseCookie(header, '__Host-otra')).toBeNull();
    expect(parseCookie(undefined, REFRESH_COOKIE)).toBeNull();
  });
});
