import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ALLOWED_MIME_LIST,
  extensionMatches,
  isAllowedMime,
  isOfficeMime,
  objectKeyFor,
  sanitizeOriginalName,
  ZIP_MIME,
} from './file-policy.js';

/**
 * AC-SEC-27: lista blanca cerrada, extensión coherente y nombres saneados antes
 * de persistir o responder.
 */

describe('política de archivos', () => {
  it('solo admite la lista blanca cerrada', () => {
    expect(ALLOWED_MIME_LIST.sort()).toEqual(
      [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
      ].sort(),
    );

    for (const mime of ['text/plain', 'application/zip', 'image/svg+xml', '']) {
      expect(isAllowedMime(mime), mime).toBe(false);
    }
    expect(isAllowedMime('application/pdf')).toBe(true);
  });

  it('exige que la extensión coincida con el MIME declarado', () => {
    expect(extensionMatches('application/pdf', 'reporte.PDF')).toBe(true);
    expect(extensionMatches('image/jpeg', 'foto.jpeg')).toBe(true);
    expect(extensionMatches('image/jpeg', 'foto.jpg')).toBe(true);
    expect(extensionMatches('application/pdf', 'reporte.png')).toBe(false);
    expect(extensionMatches('application/pdf', 'reporte')).toBe(false);
  });

  it('reconoce los contenedores de oficina', () => {
    expect(
      isOfficeMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe(true);
    expect(isOfficeMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(
      true,
    );
    expect(isOfficeMime('application/pdf')).toBe(false);
    expect(ZIP_MIME).toBe('application/zip');
  });

  it('sanea rutas, controles y puntos iniciales sin dejar el nombre vacío', () => {
    expect(sanitizeOriginalName('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(sanitizeOriginalName('..\\..\\windows\\system32')).toBe('_.._windows_system32');
    expect(sanitizeOriginalName('  acta\u0000\u001f  final.pdf  ')).toBe('acta final.pdf');
    expect(sanitizeOriginalName('.../oculto.pdf')).toBe('_oculto.pdf');
    expect(sanitizeOriginalName('')).toBe('archivo');
    expect(sanitizeOriginalName('   ')).toBe('archivo');
  });

  it('recorta nombres largos sin partir la extensión lógica de forma silenciosa', () => {
    const nombre = `${'a'.repeat(350)}.pdf`;
    expect(sanitizeOriginalName(nombre)).toHaveLength(200);
  });

  it('deriva la clave del hash y separa la cuarentena', () => {
    const hash = 'a'.repeat(64);
    expect(objectKeyFor(hash, 'limpio')).toBe(`objects/sha256/${hash}`);
    expect(objectKeyFor(hash, 'infectado')).toBe(`quarantine/sha256/${hash}`);
    expect(path.isAbsolute(objectKeyFor(hash, 'limpio'))).toBe(false);
  });
});
