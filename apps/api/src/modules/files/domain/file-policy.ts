import * as path from 'node:path';

/**
 * Política de archivos (D50, AC-SEC-27).
 *
 * Lista blanca cerrada, extensión coherente con el MIME declarado, nombre
 * saneado y clave de objeto derivada del hash (nunca del nombre original).
 */

export const ALLOWED_MIME_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
} as const;

export type AllowedMime = keyof typeof ALLOWED_MIME_TYPES;

export const ALLOWED_MIME_LIST = Object.keys(ALLOWED_MIME_TYPES) as AllowedMime[];

export const ZIP_MIME = 'application/zip';

/**
 * Política de carga. `default` es la única que usa la ruta `POST /files` y la
 * lista blanca histórica; `emisora-audio` es opt-in y solo la invocarán casos
 * de uso nuevos del contexto Emisora (ADR-0005, EM-PA-10).
 */
export type FileUploadPolicy = 'default' | 'emisora-audio';

export function isAllowedMime(mime: string): mime is AllowedMime {
  return Object.hasOwn(ALLOWED_MIME_TYPES, mime);
}

export function extensionMatches(mime: AllowedMime, nombreOriginal: string): boolean {
  const extension = path.extname(nombreOriginal).toLowerCase();
  return (ALLOWED_MIME_TYPES[mime] as readonly string[]).includes(extension);
}

export function isOfficeMime(mime: string): boolean {
  return (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

/**
 * Sanea el nombre para usarlo en cabeceras y en la bandeja. No se usa para
 * construir rutas: la clave del objeto depende solo del hash.
 */
export function sanitizeOriginalName(input: string): string {
  const withoutPaths = input.normalize('NFKC').replace(/[/\\]+/gu, '_');
  // eslint-disable-next-line no-control-regex -- eliminar controles es parte del saneamiento.
  const withoutControls = withoutPaths.replace(/[\u0000-\u001f\u007f]/gu, '');
  const collapsed = withoutControls.replace(/\s+/gu, ' ').trim();
  const safe = collapsed.replace(/^\.+/u, '').slice(0, 200);
  return safe.length > 0 ? safe : 'archivo';
}

export function objectKeyFor(hashSha256: string, estado: 'limpio' | 'infectado'): string {
  const prefix = estado === 'limpio' ? 'objects' : 'quarantine';
  return `${prefix}/sha256/${hashSha256}`;
}
