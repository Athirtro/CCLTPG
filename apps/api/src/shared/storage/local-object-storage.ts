import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import {
  ObjectNotFoundError,
  ObjectStorageError,
  type ObjectStorage,
} from './object-storage.port.js';

/**
 * Adaptador de sistema de archivos local (D49).
 *
 * Se usa en desarrollo y en la evidencia de C3 cuando MinIO no está
 * disponible. La clave se valida para impedir traversal; el contenido nunca se
 * ejecuta ni se sirve directamente desde el sistema de archivos.
 */
export class LocalObjectStorage implements ObjectStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const target = this.resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
  }

  async get(key: string): Promise<Buffer> {
    const target = this.resolveKey(key);
    try {
      return await fs.readFile(target);
    } catch (error) {
      if (isNotFound(error)) {
        throw new ObjectNotFoundError(key);
      }
      throw new ObjectStorageError('No se pudo leer el objeto.', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    const target = this.resolveKey(key);
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    try {
      await fs.unlink(target);
    } catch (error) {
      if (!isNotFound(error)) {
        throw new ObjectStorageError('No se pudo eliminar el objeto.', error);
      }
    }
  }

  private resolveKey(key: string): string {
    if (
      key.length === 0 ||
      key.includes('\0') ||
      key.includes('\\') ||
      key.startsWith('/') ||
      key.split('/').some((segment) => segment === '..' || segment === '')
    ) {
      throw new ObjectStorageError('Clave de objeto inválida.');
    }

    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(`${this.root}${path.sep}`)) {
      throw new ObjectStorageError('Clave de objeto fuera de la raíz.');
    }

    return target;
  }
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: string }).code === 'ENOENT';
}
