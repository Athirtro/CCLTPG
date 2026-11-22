import type { FileRecord } from './ports/file.repository.js';

export interface FileView {
  id: string;
  nombreOriginal: string;
  mime: string;
  tamano: number;
  hashSha256: string;
  estadoEscaneo: FileRecord['estadoEscaneo'];
  creadoEn: string;
}

export interface UploadFileInput {
  buffer: Buffer;
  nombreOriginal: string;
  mime: string;
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

export interface DownloadFileInput {
  id: string;
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

export interface DownloadFileResult {
  record: FileRecord;
  body: Buffer;
}

export function toFileView(record: FileRecord): FileView {
  return {
    id: record.id,
    nombreOriginal: record.nombreOriginal,
    mime: record.mime,
    tamano: record.tamano,
    hashSha256: record.hashSha256,
    estadoEscaneo: record.estadoEscaneo,
    creadoEn: record.creadoEn.toISOString(),
  };
}
