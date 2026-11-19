import type { Kysely, Transaction } from 'kysely';
import { v7 as uuidv7 } from 'uuid';

import type { AuditEvent, AuditPort } from '../../shared/audit/audit.port.js';
import { AuditRedactor } from '../../shared/audit/audit-redactor.js';
import { AuditWriteError } from '../../shared/audit/audit-write.error.js';
import type { Database } from '../schema.js';

type Executor = Kysely<Database> | Transaction<Database>;

/**
 * Escritor de auditoría ligado a un ejecutor de base de datos. Al construirse
 * con una transacción, el evento se confirma o revierte junto con el cambio
 * auditado (AC-AUD-10).
 */
export class KyselyAuditWriter implements AuditPort {
  private readonly redactor: AuditRedactor;

  constructor(
    private readonly db: Executor,
    redactor = new AuditRedactor(),
  ) {
    this.redactor = redactor;
  }

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.db
        .insertInto('evento_auditoria')
        .values({
          id: uuidv7(),
          actor_id: event.actorId ?? null,
          actor_perfil: event.actorPerfil ?? null,
          ip: event.ip ?? null,
          dispositivo: event.dispositivo ? event.dispositivo.slice(0, 512) : null,
          recurso: event.recurso,
          recurso_id: event.recursoId ?? null,
          accion: event.accion,
          datos_antes:
            event.datosAntes === undefined ? null : this.redactor.redact(event.datosAntes),
          datos_despues:
            event.datosDespues === undefined ? null : this.redactor.redact(event.datosDespues),
          ocurrido_en: event.ocurridoEn ?? new Date(),
          request_id: event.requestId ?? null,
        })
        .execute();
    } catch (error) {
      // El fallo se propaga dentro de la transacción: el cambio auditado se
      // revierte y el filtro global responde 503 SERVICE_UNAVAILABLE.
      throw new AuditWriteError(error);
    }
  }
}
