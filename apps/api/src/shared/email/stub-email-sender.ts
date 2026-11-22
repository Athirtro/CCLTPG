import { Logger } from '@nestjs/common';

import type { EmailMessage, EmailSender } from './email-sender.port.js';

/**
 * Stub de correo (D54). Registra solo el dominio del destinatario: ni la
 * dirección completa ni el cuerpo se escriben en logs.
 */
export class StubEmailSender implements EmailSender {
  private readonly logger = new Logger('EmailStub');

  send(message: EmailMessage): Promise<void> {
    this.logger.log(`Correo simulado (stub) a dominio=${domainOf(message.to)}`);
    return Promise.resolve();
  }
}

function domainOf(address: string): string {
  const at = address.lastIndexOf('@');
  return at >= 0 ? address.slice(at + 1) : 'desconocido';
}
