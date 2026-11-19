import argon2 from 'argon2';

import type { PasswordHasher } from '../../application/ports/password-hasher.js';

/** Parámetros fijados por AC-SEC-03 (mínimo OWASP). */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
} as const;

export class Argon2PasswordHasher implements PasswordHasher {
  private readonly dummyHash: Promise<string>;

  constructor() {
    this.dummyHash = argon2.hash('ccltpg-dummy-password-for-timing', ARGON2_OPTIONS);
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, ARGON2_OPTIONS);
    } catch {
      return true;
    }
  }

  async verifyDummy(plain: string): Promise<void> {
    await this.verify(await this.dummyHash, plain);
  }
}
