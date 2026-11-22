import { Injectable } from '@nestjs/common';

import {
  decryptPii,
  documentHmac,
  encryptPii,
  type PiiField,
} from '../../../shared/security/pii.js';
import { PiiCipher } from '../application/ports/pii-cipher.js';

@Injectable()
export class SharedPiiCipher implements PiiCipher {
  encrypt(estudianteId: string, field: PiiField, value: string): string {
    return encryptPii(estudianteId, field, value);
  }

  decrypt(estudianteId: string, field: PiiField, value: string): string {
    return decryptPii(estudianteId, field, value);
  }

  documentHash(tipoDocumento: string, numeroDocumento: string): string {
    return documentHmac(tipoDocumento, numeroDocumento);
  }
}
