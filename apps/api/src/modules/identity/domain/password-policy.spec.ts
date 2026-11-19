import { describe, expect, it } from 'vitest';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordLength,
  validatePassword,
} from './password-policy.js';

describe('política de contraseñas', () => {
  const email = 'persona@ccltpg.org';

  it('acepta una contraseña larga sin reglas de composición', () => {
    expect(validatePassword('frase larga y facil de recordar', email)).toEqual([]);
  });

  it('rechaza menos de 12 caracteres contando puntos de código', () => {
    expect(validatePassword('corta12345', email)).toContain('PASSWORD_TOO_SHORT');
    expect(passwordLength('🔐🔐🔐🔐🔐🔐')).toBe(6);
  });

  it('rechaza más de 128 caracteres', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH + 1), email)).toContain(
      'PASSWORD_TOO_LONG',
    );
    expect(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH), email)).not.toContain(
      'PASSWORD_TOO_SHORT',
    );
  });

  it('rechaza contraseñas comunes ignorando mayúsculas y unicode', () => {
    expect(validatePassword('Contraseña123', email)).toContain('PASSWORD_TOO_COMMON');
  });

  it('rechaza la parte local del correo dentro de la contraseña', () => {
    expect(validatePassword('persona-mas-larga-2026', email)).toContain('PASSWORD_CONTAINS_EMAIL');
  });
});
