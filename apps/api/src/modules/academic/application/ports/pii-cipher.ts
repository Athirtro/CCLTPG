import type { PiiField } from '../../../../shared/security/pii.js';

/** Cifrado e índice ciego de PII (D61). Se inyecta para poder probar el dominio. */
export abstract class PiiCipher {
  abstract encrypt(estudianteId: string, field: PiiField, value: string): string;
  abstract decrypt(estudianteId: string, field: PiiField, value: string): string;
  abstract documentHash(tipoDocumento: string, numeroDocumento: string): string;
}
