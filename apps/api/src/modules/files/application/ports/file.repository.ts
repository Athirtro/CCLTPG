import type { ArchivoEstadoEscaneo } from '../../../../database/schema.js';

export interface FileRecord {
  id: string;
  nombreOriginal: string;
  mime: string;
  tamano: number;
  hashSha256: string;
  rutaObjeto: string;
  subidoPor: string;
  estadoEscaneo: ArchivoEstadoEscaneo;
  creadoEn: Date;
}

export interface NewFileRecord {
  id: string;
  nombreOriginal: string;
  mime: string;
  tamano: number;
  hashSha256: string;
  rutaObjeto: string;
  subidoPor: string;
  estadoEscaneo: ArchivoEstadoEscaneo;
}

export abstract class FileRepository {
  abstract create(input: NewFileRecord): Promise<FileRecord>;
  abstract findById(id: string): Promise<FileRecord | null>;
  abstract findByHash(hashSha256: string): Promise<FileRecord[]>;
}
