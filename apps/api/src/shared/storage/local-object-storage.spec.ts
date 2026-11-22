import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalObjectStorage } from './local-object-storage.js';
import { ObjectNotFoundError, ObjectStorageError } from './object-storage.port.js';

/**
 * D49: el adaptador local se usa como evidencia de C3 sin MinIO. Debe impedir
 * traversal y no ocultar errores distintos de "no existe".
 */

describe('almacenamiento local de objetos', () => {
  let root: string;
  let storage: LocalObjectStorage;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'ccltpg-objects-'));
    storage = new LocalObjectStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('guarda, lee, comprueba y elimina un objeto', async () => {
    const key = 'objects/sha256/abc';
    const body = Buffer.from('contenido', 'utf8');

    await storage.put(key, body);
    await expect(storage.exists(key)).resolves.toBe(true);
    await expect(storage.get(key)).resolves.toEqual(body);

    await storage.delete(key);
    await expect(storage.exists(key)).resolves.toBe(false);
    await expect(storage.get(key)).rejects.toBeInstanceOf(ObjectNotFoundError);
  });

  it('eliminar un objeto inexistente es idempotente', async () => {
    await expect(storage.delete('objects/sha256/no-existe')).resolves.toBeUndefined();
  });

  it('rechaza claves con traversal o segmentos vacíos', async () => {
    for (const key of ['../fuera', 'objects/../../fuera', '/absoluta', 'objects//x', 'a\\b', '']) {
      await expect(storage.put(key, Buffer.from('x')), key).rejects.toBeInstanceOf(
        ObjectStorageError,
      );
    }
  });

  it('no permite escapar de la raíz resolviendo la ruta', async () => {
    const outside = path.resolve(root, '..', 'archivo-ajeno');
    await expect(storage.get(path.relative(root, outside))).rejects.toBeInstanceOf(
      ObjectStorageError,
    );
  });
});
