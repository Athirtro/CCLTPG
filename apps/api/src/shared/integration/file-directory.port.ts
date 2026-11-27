/**
 * Directorio público de archivos para contextos vecinos (plan §2.2).
 *
 * Emisora solo necesita saber que un soporte existe, está limpio y qué MIME
 * tiene. No lee tablas de `public` ni importa el módulo `files`: el proveedor
 * se publica de forma aditiva desde ese contexto.
 */

export const FILE_DIRECTORY = Symbol('CCLTPG_FILE_DIRECTORY');

export interface FileRef {
  id: string;
  nombreOriginal: string;
  mime: string;
  tamano: number;
  estadoEscaneo: 'limpio' | 'infectado' | 'pendiente';
}

export interface FileDirectory {
  findById(id: string): Promise<FileRef | null>;
}
