import { decryptField, encryptField } from '../../../../shared/security/encryption.js';
import type { FieldEncryption } from '../../application/ports/field-encryption.js';

export class AesFieldEncryption implements FieldEncryption {
  encrypt(plain: string, aad: string): string {
    return encryptField(plain, aad);
  }

  decrypt(payload: string, aad: string): string {
    return decryptField(payload, aad);
  }
}
