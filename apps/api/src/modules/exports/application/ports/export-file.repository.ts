export interface ExportFileRecord {
  id: string;
  nombreOriginal: string;
  mime: string;
  tamano: number;
  hashSha256: string;
  rutaObjeto: string;
  creadoEn: Date;
}

export interface NewExportFileRecord {
  id: string;
  nombreOriginal: string;
  mime: string;
  tamano: number;
  hashSha256: string;
  rutaObjeto: string;
  subidoPor: string;
}

export abstract class ExportFileRepository {
  abstract create(input: NewExportFileRecord): Promise<ExportFileRecord>;
}
