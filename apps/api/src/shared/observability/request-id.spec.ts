import { describe, expect, it } from 'vitest';

import { resolveRequestId } from './request-id.js';

const UUID_V4 = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('resolveRequestId', () => {
  it('conserva un UUID válido del cliente', () => {
    expect(resolveRequestId(UUID_V4)).toBe(UUID_V4);
  });

  it('toma el primer valor cuando la cabecera llega como arreglo', () => {
    expect(resolveRequestId([UUID_V4, 'otro'])).toBe(UUID_V4);
  });

  it('genera un UUIDv7 cuando la cabecera no es un UUID', () => {
    expect(resolveRequestId('../../etc/passwd')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('genera un UUIDv7 cuando la cabecera está ausente', () => {
    const id = resolveRequestId(undefined);
    expect(id).toHaveLength(36);
    expect(id).not.toBe(UUID_V4);
  });
});
