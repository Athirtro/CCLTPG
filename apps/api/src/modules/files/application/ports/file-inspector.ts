export interface InspectedFile {
  /** MIME real detectado por bytes mágicos, o `null` si no se pudo detectar. */
  detectedMime: string | null;
  /** MIME efectivo que se persistirá (declarado si la verificación lo admite). */
  mime: string;
}

export abstract class FileInspector {
  abstract inspect(
    buffer: Buffer,
    declaredMime: string,
    nombreOriginal: string,
  ): Promise<InspectedFile>;
}
