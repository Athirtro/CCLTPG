import { HttpException, HttpStatus } from '@nestjs/common';

import { AUTH_ERRORS, type AuthErrorCode } from '../../../shared/auth/error-codes.js';

/**
 * Error de autenticación con código estable. El filtro global lo traduce a
 * Problem Details y añade `Retry-After` cuando corresponde.
 */
export class AuthError extends HttpException {
  readonly code: AuthErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: AuthErrorCode,
    status: HttpStatus,
    detail: string,
    options: { retryAfterSeconds?: number } = {},
  ) {
    super({ code, detail, statusCode: status }, status);
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  static invalidCredentials(): AuthError {
    return new AuthError(
      AUTH_ERRORS.invalidCredentials,
      HttpStatus.UNAUTHORIZED,
      'Credenciales inválidas.',
    );
  }

  static tokenInvalid(): AuthError {
    return new AuthError(
      AUTH_ERRORS.tokenInvalid,
      HttpStatus.UNAUTHORIZED,
      'La sesión no es válida. Inicie sesión de nuevo.',
    );
  }

  static tokenExpired(): AuthError {
    return new AuthError(
      AUTH_ERRORS.tokenExpired,
      HttpStatus.UNAUTHORIZED,
      'La sesión ha expirado. Inicie sesión de nuevo.',
    );
  }

  static tokenRevoked(): AuthError {
    return new AuthError(
      AUTH_ERRORS.tokenRevoked,
      HttpStatus.UNAUTHORIZED,
      'La sesión fue revocada. Inicie sesión de nuevo.',
    );
  }

  static tokenReused(): AuthError {
    return new AuthError(
      AUTH_ERRORS.tokenReused,
      HttpStatus.UNAUTHORIZED,
      'La sesión fue revocada por seguridad. Inicie sesión de nuevo.',
    );
  }

  static mfaSessionInvalid(): AuthError {
    return new AuthError(
      AUTH_ERRORS.mfaSessionInvalid,
      HttpStatus.UNAUTHORIZED,
      'La verificación MFA expiró. Inicie sesión de nuevo.',
    );
  }

  static mfaInvalidCode(): AuthError {
    return new AuthError(
      AUTH_ERRORS.mfaInvalidCode,
      HttpStatus.UNAUTHORIZED,
      'El código de verificación no es válido.',
    );
  }

  static mfaAttemptsExceeded(): AuthError {
    return new AuthError(
      AUTH_ERRORS.mfaAttemptsExceeded,
      HttpStatus.TOO_MANY_REQUESTS,
      'Se agotaron los intentos de verificación. Inicie sesión de nuevo.',
      { retryAfterSeconds: 300 },
    );
  }

  static csrfInvalid(): AuthError {
    return new AuthError(
      AUTH_ERRORS.csrfInvalid,
      HttpStatus.FORBIDDEN,
      'La solicitud no incluye un token CSRF válido.',
    );
  }

  static passwordChangeRequired(): AuthError {
    return new AuthError(
      AUTH_ERRORS.passwordChangeRequired,
      HttpStatus.FORBIDDEN,
      'Debe cambiar la contraseña antes de continuar.',
    );
  }

  static permissionDenied(): AuthError {
    return new AuthError(
      AUTH_ERRORS.permissionDenied,
      HttpStatus.FORBIDDEN,
      'No tiene permiso para realizar esta operación.',
    );
  }

  static activeProfileInvalid(): AuthError {
    return new AuthError(
      AUTH_ERRORS.activeProfileInvalid,
      HttpStatus.BAD_REQUEST,
      'El perfil activo no es válido para este usuario.',
    );
  }

  static rateLimited(retryAfterSeconds: number): AuthError {
    return new AuthError(
      AUTH_ERRORS.rateLimited,
      HttpStatus.TOO_MANY_REQUESTS,
      'Demasiadas solicitudes. Intente de nuevo más tarde.',
      { retryAfterSeconds },
    );
  }

  static generalRateLimited(retryAfterSeconds: number): AuthError {
    return new AuthError(
      AUTH_ERRORS.generalRateLimited,
      HttpStatus.TOO_MANY_REQUESTS,
      'Demasiadas solicitudes. Intente de nuevo más tarde.',
      { retryAfterSeconds },
    );
  }

  static currentPasswordInvalid(): AuthError {
    return new AuthError(
      AUTH_ERRORS.currentPasswordInvalid,
      HttpStatus.BAD_REQUEST,
      'La contraseña actual no es correcta.',
    );
  }

  static passwordPolicy(violations: string[]): AuthError {
    return new AuthError(
      AUTH_ERRORS.passwordPolicyViolation,
      HttpStatus.BAD_REQUEST,
      `La contraseña no cumple la política: ${violations.join(', ')}.`,
    );
  }

  static mfaAlreadyEnabled(): AuthError {
    return new AuthError(
      AUTH_ERRORS.mfaAlreadyEnabled,
      HttpStatus.CONFLICT,
      'La verificación en dos pasos ya está activada.',
    );
  }

  static mfaNotEnabled(): AuthError {
    return new AuthError(
      AUTH_ERRORS.mfaNotEnabled,
      HttpStatus.CONFLICT,
      'La verificación en dos pasos no está activada.',
    );
  }

  static serviceUnavailable(
    detail = 'El servicio de autenticación no está disponible.',
  ): AuthError {
    return new AuthError(AUTH_ERRORS.serviceUnavailable, HttpStatus.SERVICE_UNAVAILABLE, detail);
  }
}
