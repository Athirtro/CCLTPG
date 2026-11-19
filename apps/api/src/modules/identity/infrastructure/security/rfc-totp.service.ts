import { randomBytes } from 'node:crypto';

import { env } from '../../../../shared/config/env.js';
import { base32Encode } from '../../../../shared/security/base32.js';
import { generateTotp, verifyTotp } from '../../../../shared/security/totp.js';
import type { TotpService } from '../../application/ports/totp.service.js';

export class RfcTotpService implements TotpService {
  generateSecret(): string {
    return base32Encode(randomBytes(20));
  }

  otpauthUri(secret: string, email: string): string {
    const label = encodeURIComponent(`${env.MFA_ISSUER}:${email}`);
    const params = new URLSearchParams({
      secret,
      issuer: env.MFA_ISSUER,
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  verify(secret: string, code: string, at: Date = new Date()): boolean {
    return verifyTotp(secret, code, at);
  }

  currentCode(secret: string, at: Date = new Date()): string {
    return generateTotp(secret, at);
  }
}
