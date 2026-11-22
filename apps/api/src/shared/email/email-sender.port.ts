/**
 * Puerto de envío de correo (D54).
 *
 * C3 usa un stub que nunca registra la dirección completa. El proveedor SMTP
 * real se integra en C5/C8; `EMAIL_DRIVER=smtp` falla al arrancar para no
 * simular entregas.
 */

export const EMAIL_SENDER = Symbol('CCLTPG_EMAIL_SENDER');

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
