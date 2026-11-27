import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import {
  ObjectNotFoundError,
  ObjectStorageError,
  type ObjectStorage,
} from './object-storage.port.js';

export interface S3ObjectStorageOptions {
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  serverSideEncryption?: 'AES256';
}

/**
 * Adaptador S3 compatible (MinIO en desarrollo, D49).
 *
 * No se añaden URLs prefirmadas: la lectura siempre pasa por la API. Si MinIO
 * no está disponible, el adaptador local cubre la evidencia de C3 y esta deuda
 * se registra en el paquete de revisión.
 */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly serverSideEncryption?: 'AES256';

  constructor(options: S3ObjectStorageOptions) {
    this.bucket = options.bucket;
    this.serverSideEncryption = options.serverSideEncryption;
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ...(this.serverSideEncryption
            ? { ServerSideEncryption: this.serverSideEncryption }
            : {}),
        }),
      );
    } catch (error) {
      throw new ObjectStorageError('No se pudo escribir el objeto en S3.', error);
    }
  }

  async get(key: string): Promise<Buffer> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) {
        throw new ObjectNotFoundError(key);
      }
      const bytes = await result.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error) {
      if (error instanceof ObjectNotFoundError || isNotFound(error)) {
        throw new ObjectNotFoundError(key);
      }
      throw new ObjectStorageError('No se pudo leer el objeto de S3.', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) {
        return false;
      }
      throw new ObjectStorageError('No se pudo verificar el objeto en S3.', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      throw new ObjectStorageError('No se pudo eliminar el objeto de S3.', error);
    }
  }
}

function isNotFound(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return status === 404 || (error as { name?: string }).name === 'NotFound';
}
