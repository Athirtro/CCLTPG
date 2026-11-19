import type { CookieOptions, Response } from 'express';

import type { FullSession } from '../domain/identity.types.js';

export const REFRESH_COOKIE = '__Host-ccltpg_rt';
export const CSRF_COOKIE = '__Host-ccltpg_csrf';

/**
 * Atributos exigidos por AC-SEC-12: prefijo `__Host-`, `Secure`,
 * `SameSite=Strict`, `Path=/` y sin `Domain`. El refresh es `HttpOnly`; el
 * CSRF debe ser legible por el cliente para el doble envío.
 */
const BASE_OPTIONS: CookieOptions = {
  secure: true,
  sameSite: 'strict',
  path: '/',
};

export function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return null;
}

export function setSessionCookies(response: Response, session: FullSession): void {
  response.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...BASE_OPTIONS,
    httpOnly: true,
    expires: session.refreshExpiresAt,
  });

  response.cookie(CSRF_COOKIE, session.csrfToken, {
    ...BASE_OPTIONS,
    httpOnly: false,
    expires: session.refreshExpiresAt,
  });
}

export function clearSessionCookies(response: Response): void {
  response.clearCookie(REFRESH_COOKIE, { ...BASE_OPTIONS, httpOnly: true });
  response.clearCookie(CSRF_COOKIE, { ...BASE_OPTIONS, httpOnly: false });
}
