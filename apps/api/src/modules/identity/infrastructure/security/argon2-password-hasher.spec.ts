import argon2 from 'argon2';
import { describe, expect, it } from 'vitest';

import { ARGON2_OPTIONS, Argon2PasswordHasher } from './argon2-password-hasher.js';

describe('Argon2id (AC-SEC-03)', () => {
  const hasher = new Argon2PasswordHasher();

  it('produce PHC versionado con m=19456, t=2, p=1', async () => {
    const hash = await hasher.hash('frase larga y facil de recordar');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/u);
    expect(ARGON2_OPTIONS.type).toBe(argon2.argon2id);
    await expect(hasher.verify(hash, 'frase larga y facil de recordar')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'otra frase distinta')).resolves.toBe(false);
  });

  it('marca para rehash un hash con parámetros inferiores', async () => {
    const weak = await argon2.hash('clave de prueba', {
      type: argon2.argon2id,
      memoryCost: 8_192,
      timeCost: 1,
      parallelism: 1,
    });

    expect(hasher.needsRehash(weak)).toBe(true);
    expect(hasher.needsRehash('no-es-un-hash')).toBe(true);
    expect(hasher.needsRehash(await hasher.hash('clave de prueba'))).toBe(false);
  });

  it('verifica un hash corrupto sin lanzar', async () => {
    await expect(hasher.verify('$argon2id$roto', 'x')).resolves.toBe(false);
  });
});
