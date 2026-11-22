/**
 * Puerto de almacenamiento de objetos (D49).
 *
 * La API es la única puerta de descarga: no se emiten URLs prefirmadas ni se
 * expone el bucket. Los adaptadores concretos (local o S3) viven en
 * infraestructura compartida y nunca son visibles para los dominios.
 */

export const OBJECT_STORAGE = Symbol('CCLTPG_OBJECT_STORAGE');

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export class ObjectNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`Objeto inexistente: ${key}`);
    this.name = 'ObjectNotFoundError';
  }
}

export class ObjectStorageError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ObjectStorageError';
  }
}
