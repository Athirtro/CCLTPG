import * as path from 'node:path';

import type { FileUploadPolicy } from './file-policy.js';

/**
 * Política opt-in `emisora-audio` (ADR-0005, EM-PA-10; plan §14).
 *
 * No sustituye a `file-policy.ts`: amplía Archivos con una lista blanca propia
 * para el audio de la emisora y un límite explícito `EMISORA_MAX_AUDIO_BYTES`.
 * `POST /api/v1/files` sigue usando `default`, `MAX_FILE_BYTES` y la lista
 * histórica, así que su contrato y su comportamiento no cambian.
 */
export const EMISORA_AUDIO_MIME_TYPES = {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg'],
} as const;

export type EmisoraAudioMime = keyof typeof EMISORA_AUDIO_MIME_TYPES;

export const EMISORA_AUDIO_MIME_LIST = Object.keys(EMISORA_AUDIO_MIME_TYPES) as EmisoraAudioMime[];

/** Alias que `file-type` puede informar para el mismo formato. */
export const EMISORA_AUDIO_DETECTED_ALIASES: Readonly<Record<EmisoraAudioMime, readonly string[]>> =
  {
    'audio/mpeg': ['audio/mpeg', 'audio/mp3'],
    'audio/wav': ['audio/wav', 'audio/x-wav', 'audio/wave'],
    'audio/ogg': ['audio/ogg', 'application/ogg'],
  };

export function isEmisoraAudioMime(mime: string): mime is EmisoraAudioMime {
  return Object.hasOwn(EMISORA_AUDIO_MIME_TYPES, mime);
}

export function emisoraAudioExtensionMatches(
  mime: EmisoraAudioMime,
  nombreOriginal: string,
): boolean {
  const extension = path.extname(nombreOriginal).toLowerCase();
  return (EMISORA_AUDIO_MIME_TYPES[mime] as readonly string[]).includes(extension);
}

/** True solo para la política opt-in; `default` (o ausente) queda intacta. */
export function isEmisoraAudioPolicy(politica: FileUploadPolicy | undefined): boolean {
  return politica === 'emisora-audio';
}
