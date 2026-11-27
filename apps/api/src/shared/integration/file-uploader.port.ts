/**
 * Subida de archivos para contextos vecinos (plan §2.2, ADR-0005).
 *
 * Emisora usa la política opt-in `emisora-audio` sin importar el contexto
 * `files`: el proveedor se publica de forma aditiva desde ese contexto. La
 * política histórica de `POST /api/v1/files` sigue intacta.
 */

export const FILE_UPLOADER = Symbol('CCLTPG_FILE_UPLOADER');

export type FileUploadPolicy = 'default' | 'emisora-audio';

export interface ArchivoParaSubir {
  buffer: Buffer;
  nombreOriginal: string;
  mime: string;
}

export interface SubirArchivoInput {
  archivo: ArchivoParaSubir;
  politica: FileUploadPolicy;
  idempotencyKey: string | null;
  actor: {
    userId: string;
    actorProfile: string | null;
    permissions: readonly string[];
  };
  context: {
    ip: string | null;
    userAgent: string | null;
    requestId: string | null;
  };
}

export interface ArchivoSubido {
  id: string;
  hashSha256: string;
}

export interface FileUploader {
  upload(input: SubirArchivoInput): Promise<ArchivoSubido>;
}
