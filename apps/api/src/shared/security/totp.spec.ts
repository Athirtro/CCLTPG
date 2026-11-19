import { describe, expect, it } from 'vitest';

import { base32Decode, base32Encode } from './base32.js';
import { generateTotp, verifyTotp } from './totp.js';

/** Vector RFC 6238: semilla ASCII "12345678901234567890". */
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

describe('TOTP RFC 6238', () => {
  it('codifica y decodifica base32 sin pérdida', () => {
    const bytes = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);
    expect([...base32Decode(base32Encode(bytes))]).toEqual([...bytes]);
  });

  it('reproduce los vectores de 6 dígitos del RFC', () => {
    expect(generateTotp(RFC_SECRET, new Date(59_000))).toBe('287082');
    expect(generateTotp(RFC_SECRET, new Date(1_111_111_109_000))).toBe('081804');
    expect(generateTotp(RFC_SECRET, new Date(1_234_567_890_000))).toBe('005924');
  });

  it('acepta el paso actual y ±1, y rechaza fuera de ventana', () => {
    const at = new Date(1_111_111_109_000);
    const code = generateTotp(RFC_SECRET, at);

    expect(verifyTotp(RFC_SECRET, code, at)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, new Date(at.getTime() + 30_000))).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, new Date(at.getTime() - 30_000))).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, new Date(at.getTime() + 120_000))).toBe(false);
  });

  it('rechaza códigos con formato inválido sin lanzar', () => {
    expect(verifyTotp(RFC_SECRET, '12345', new Date())).toBe(false);
    expect(verifyTotp(RFC_SECRET, 'abcdef', new Date())).toBe(false);
  });
});
