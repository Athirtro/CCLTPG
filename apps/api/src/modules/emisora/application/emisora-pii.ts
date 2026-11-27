import { Injectable } from '@nestjs/common';

import { env } from '../../../shared/config/env.js';
import { encryptField } from '../../../shared/security/encryption.js';
import { hmacSha256Hex } from '../../../shared/security/hmac.js';
import type { PiiField } from '../../../shared/security/pii.js';

/**
 * Cifrado de PII de la emisora (ADR-0003 y §4.3 del plan).
 *
 * Usa exclusivamente primitivas de `shared/security`, con AAD propio del
 * contexto y de la fila. La identidad académica no se importa ni se reutiliza:
 * cambiar sus claves o su AAD no afecta a los realizadores.
 */
export interface RealizadorPii {
  numeroDocumentoCifrado: string;
  numeroDocumentoHash: string;
  contactoCifrado: string | null;
}

@Injectable()
export class EmisoraPii {
  private aad(realizadorId: string, campo: PiiField): string {
    return `emisora:realizador:${realizadorId}:${campo}`;
  }

  cifrarRealizador(
    realizadorId: string,
    tipoDocumento: string,
    numeroDocumento: string,
    contacto: string | null,
  ): RealizadorPii {
    const normalizado = `${tipoDocumento.trim().toLowerCase()}:${numeroDocumento.replace(/\s+/gu, '').toUpperCase()}`;
    return {
      numeroDocumentoCifrado: encryptField(
        numeroDocumento,
        this.aad(realizadorId, 'numero_documento'),
        env.PII_ENCRYPTION_KEY,
      ),
      numeroDocumentoHash: hmacSha256Hex(env.PII_HMAC_KEY, `documento:${normalizado}`),
      contactoCifrado: contacto
        ? encryptField(contacto, this.aad(realizadorId, 'telefono'), env.PII_ENCRYPTION_KEY)
        : null,
    };
  }

  cifrarContacto(realizadorId: string, contacto: string | null): string | null {
    return contacto
      ? encryptField(contacto, this.aad(realizadorId, 'telefono'), env.PII_ENCRYPTION_KEY)
      : null;
  }
}
