import { timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AuthError } from '../application/auth-error.js';
import { CSRF_COOKIE, parseCookie } from './auth-cookies.js';

/**
 * CSRF de doble envío (`auth-v1` §7.2): la cookie `__Host-ccltpg_csrf` y la
 * cabecera `X-CSRF-Token` deben coincidir. Comparación en tiempo constante.
 */
@Injectable()
export class CsrfService {
  assert(request: Request): void {
    const cookie = parseCookie(request.headers.cookie, CSRF_COOKIE);
    const header = request.headers['x-csrf-token'];

    if (!cookie || typeof header !== 'string' || !this.matches(cookie, header)) {
      throw AuthError.csrfInvalid();
    }
  }

  private matches(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length || leftBuffer.length < 16) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
