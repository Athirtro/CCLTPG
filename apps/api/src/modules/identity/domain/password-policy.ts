/**
 * Política de contraseñas (AC-SEC-04 / AC-B-10).
 *
 * Reglas: 12–128 caracteres Unicode, sin reglas de composición, se rechazan
 * las contraseñas comunes y las que contienen la parte local del email.
 * No hay rotación periódica obligatoria.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Lista mínima de contraseñas comunes; se amplía con el catálogo de C5. */
const COMMON_PASSWORDS = new Set(
  [
    '123456789012',
    'password1234',
    'contrasena123',
    'contraseña123',
    'qwertyuiop12',
    'administrador',
    'administrator',
    'bienvenido123',
    'cambiar12345',
    'clave1234567',
    '123456789abc',
    'abcdefghijkl',
    'iloveyou1234',
    'princesa1234',
    'ccltpg123456',
    'plataforma123',
    'universidad123',
    'colegio123456',
  ].map((value) => value.toLowerCase()),
);

export type PasswordPolicyViolation =
  'PASSWORD_TOO_SHORT' | 'PASSWORD_TOO_LONG' | 'PASSWORD_TOO_COMMON' | 'PASSWORD_CONTAINS_EMAIL';

export function passwordLength(password: string): number {
  return [...password].length;
}

export function validatePassword(password: string, email: string): PasswordPolicyViolation[] {
  const violations: PasswordPolicyViolation[] = [];
  const length = passwordLength(password);

  if (length < PASSWORD_MIN_LENGTH) {
    violations.push('PASSWORD_TOO_SHORT');
  }

  if (length > PASSWORD_MAX_LENGTH) {
    violations.push('PASSWORD_TOO_LONG');
  }

  const normalized = password.normalize('NFKC').toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    violations.push('PASSWORD_TOO_COMMON');
  }

  const localPart = email.split('@')[0]?.trim().toLowerCase() ?? '';
  if (localPart.length >= 3 && normalized.includes(localPart)) {
    violations.push('PASSWORD_CONTAINS_EMAIL');
  }

  return violations;
}
