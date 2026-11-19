import { HttpException, Inject, Injectable } from '@nestjs/common';

import type { AuditEvent, AuditPort } from '../../../shared/audit/audit.port.js';
import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import type { RequestContext } from '../../../shared/http/request-context.js';
import type { AuditFilter, AuditPage } from './audit.types.js';
import { AuditRepository } from './ports/audit.repository.js';
import { AuditWriterFactory } from './ports/audit-writer.factory.js';

@Injectable()
export class AuditService implements AuditPort {
  constructor(
    @Inject(AuditRepository) private readonly repository: AuditRepository,
    @Inject(AuditWriterFactory) private readonly writerFactory: AuditWriterFactory,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    await this.writerFactory.create().record(event);
  }

  /** Consulta con meta-auditoría (AC-AUD-12). */
  async query(
    filter: AuditFilter,
    actor: AuthPrincipal,
    context: RequestContext,
  ): Promise<AuditPage> {
    const page = await this.repository.list(filter);

    await this.record({
      accion: 'auditoria.consultada',
      recurso: 'evento_auditoria',
      recursoId: null,
      actorId: actor.userId,
      actorPerfil: actor.actorProfile,
      ip: context.ip,
      dispositivo: context.userAgent,
      datosDespues: {
        filtros: {
          from: filter.from?.toISOString() ?? null,
          to: filter.to?.toISOString() ?? null,
          actor_id: filter.actorId ?? null,
          recurso: filter.recurso ?? null,
          recurso_id: filter.recursoId ?? null,
          accion: filter.accion ?? null,
          limit: filter.limit,
          offset: filter.offset,
        },
        resultados: page.total,
      },
      requestId: context.requestId,
    });

    return page;
  }

  /**
   * Compensación: el pasado no se edita; se añade `auditoria.correccion` con
   * la justificación y la referencia al evento original (AC-AUD-07).
   */
  async correct(
    eventId: string,
    justificacion: string,
    actor: AuthPrincipal,
    context: RequestContext,
  ): Promise<void> {
    const original = await this.repository.findById(eventId);
    if (!original) {
      throw new HttpException(
        {
          code: 'RESOURCE_NOT_FOUND',
          statusCode: 404,
          detail: 'Evento de auditoría inexistente.',
        },
        404,
      );
    }

    await this.record({
      accion: 'auditoria.correccion',
      recurso: 'evento_auditoria',
      recursoId: eventId,
      actorId: actor.userId,
      actorPerfil: actor.actorProfile,
      ip: context.ip,
      dispositivo: context.userAgent,
      datosDespues: { justificacion },
      requestId: context.requestId,
    });
  }
}
