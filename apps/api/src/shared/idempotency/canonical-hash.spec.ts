import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { canonicalJson, sha256Hex } from './canonical-hash.js';

/**
 * D57: dos cuerpos semánticamente iguales deben producir el mismo hash para
 * que la idempotencia no dependa del orden de claves.
 */

describe('hash canónico de solicitudes', () => {
  it('produce el mismo JSON con distinto orden de claves', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      canonicalJson({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }),
    );
  });

  it('normaliza fechas, nulos y arreglos', () => {
    const date = new Date('2026-11-19T10:00:00.000Z');
    expect(
      canonicalJson({ fecha: date, nulo: null, indefinido: undefined, lista: [1, undefined] }),
    ).toBe('{"fecha":"2026-11-19T10:00:00.000Z","indefinido":null,"lista":[1,null],"nulo":null}');
  });

  it('calcula SHA-256 hexadecimal en minúsculas', () => {
    const expected = createHash('sha256').update('abc').digest('hex');
    expect(sha256Hex('abc')).toBe(expected);
    expect(sha256Hex(Buffer.from('abc'))).toBe(expected);
    expect(sha256Hex('abc')).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('distingue cuerpos distintos', () => {
    expect(sha256Hex(canonicalJson({ a: 1 }))).not.toBe(sha256Hex(canonicalJson({ a: 2 })));
  });
});
