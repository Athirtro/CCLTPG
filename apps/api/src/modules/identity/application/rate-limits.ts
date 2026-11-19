/**
 * Límites de tasa por operación (PA-009, `auth-v1` §8.1).
 * Valores por defecto; se ajustan tras la prueba de carga de C5.
 */
export const RATE_LIMITS = {
  loginIp: { limit: 10, windowSeconds: 900 },
  loginEmail: { limit: 5, windowSeconds: 900 },
  mfaToken: { limit: 5, windowSeconds: 300 },
  mfaUser: { limit: 10, windowSeconds: 900 },
  refreshIp: { limit: 60, windowSeconds: 60 },
  passwordUser: { limit: 5, windowSeconds: 3600 },
  recoveryUser: { limit: 3, windowSeconds: 3600 },
  apiUser: { limit: 300, windowSeconds: 60 },
} as const;

/** Fallos de contraseña que bloquean la cuenta en la ventana de 15 min. */
export const MAX_PASSWORD_FAILURES = 5;
