import { HttpCode, Header } from '@nestjs/common';

import type { AuthResponse } from '../application/auth-state.service.js';
import type { FullSession } from '../domain/identity.types.js';
import type { ProfileSummaryDto } from './dto/auth-response.dto.js';

/**
 * Respuestas de autenticación (`auth-v1` §6). Solo se devuelven tokens en el
 * cuerpo del login/refresh; el refresh vive además en cookie `__Host-`.
 */
export function toLoginBody(result: AuthResponse): {
  status: string;
  sessionToken?: string;
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
  csrfToken?: string;
  mustChangePassword: boolean;
  profiles: ProfileSummaryDto[];
} {
  if (result.session) {
    return {
      status: result.status,
      accessToken: result.session.accessToken,
      tokenType: 'Bearer',
      expiresIn: result.session.expiresIn,
      csrfToken: result.session.csrfToken,
      mustChangePassword: result.mustChangePassword,
      profiles: result.profiles,
    };
  }

  return {
    status: result.status,
    sessionToken: result.sessionToken,
    mustChangePassword: result.mustChangePassword,
    profiles: result.profiles,
  };
}

export function toTokenBody(
  session: FullSession,
  mustChangePassword: boolean,
  profiles: ProfileSummaryDto[],
): {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  csrfToken: string;
  mustChangePassword: boolean;
  profiles: ProfileSummaryDto[];
} {
  return {
    accessToken: session.accessToken,
    tokenType: 'Bearer',
    expiresIn: session.expiresIn,
    csrfToken: session.csrfToken,
    mustChangePassword,
    profiles,
  };
}

export const NoStore = (): MethodDecorator => Header('Cache-Control', 'no-store');
export const OkCode = (): MethodDecorator => HttpCode(200);
