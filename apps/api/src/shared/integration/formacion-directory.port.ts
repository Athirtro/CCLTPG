/**
 * Puerto público de formación para contextos vecinos (plan §2.2).
 *
 * Emisora consulta programas, formadores e inscripciones del contexto académico
 * sin importar clases internas ni escribir SQL contra su esquema. El proveedor
 * se implementa dentro de `academic` y se publica como aditivo.
 */

export const FORMACION_DIRECTORY = Symbol('CCLTPG_FORMACION_DIRECTORY');

export type FormacionProgramaEstado = 'borrador' | 'publicado' | 'archivado';

export interface FormacionProgramaRef {
  id: string;
  nombre: string;
  area: string;
  estado: FormacionProgramaEstado;
}

export interface FormacionFormadorRef {
  id: string;
  nombre: string;
  email: string | null;
}

export interface FormacionInscripcionRef {
  id: string;
  programaId: string;
  estudianteId: string;
  estado: string;
  periodo: string;
}

export interface FormacionDirectory {
  listProgramas(): Promise<readonly FormacionProgramaRef[]>;
  listFormadores(programaId: string): Promise<readonly FormacionFormadorRef[]>;
  listInscripciones(programaId: string): Promise<readonly FormacionInscripcionRef[]>;
}
