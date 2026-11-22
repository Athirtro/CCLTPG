import { fileTypeFromBuffer } from 'file-type';

import { FileError } from '../application/file-error.js';
import type { FileInspector, InspectedFile } from '../application/ports/file-inspector.js';
import { extensionMatches, isAllowedMime, isOfficeMime, ZIP_MIME } from '../domain/file-policy.js';

/**
 * Verificación por bytes mágicos además del MIME declarado (D50).
 *
 * PDF/PNG/JPEG exigen coincidencia exacta. DOCX/XLSX son contenedores ZIP:
 * `file-type` puede devolver `application/zip`; en ese caso se exige la firma
 * ZIP y la extensión declarada. La inspección profunda del ZIP queda para el
 * proveedor antimalware de C5/C8 (riesgo de zip bomb acotado por el límite de
 * tamaño).
 */
export class FileTypeInspector implements FileInspector {
  async inspect(
    buffer: Buffer,
    declaredMime: string,
    nombreOriginal: string,
  ): Promise<InspectedFile> {
    if (buffer.length === 0) {
      throw FileError.empty();
    }

    if (!isAllowedMime(declaredMime)) {
      throw FileError.mimeNotAllowed();
    }

    if (!extensionMatches(declaredMime, nombreOriginal)) {
      throw FileError.mimeMismatch();
    }

    const detected = await fileTypeFromBuffer(buffer);
    const detectedMime = detected?.mime ?? null;

    if (isOfficeMime(declaredMime)) {
      const acceptable =
        detectedMime === declaredMime || detectedMime === ZIP_MIME || isZip(buffer);
      if (!acceptable) {
        throw FileError.mimeMismatch();
      }
      return { detectedMime, mime: declaredMime };
    }

    if (detectedMime !== declaredMime) {
      throw FileError.mimeMismatch();
    }

    return { detectedMime, mime: declaredMime };
  }
}

/** Firma local de archivo ZIP: `PK\x03\x04`. */
function isZip(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}
