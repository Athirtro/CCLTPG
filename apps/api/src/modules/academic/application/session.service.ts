import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import { AcademicError } from './academic-error.js';
import type { ActorContext, PageInput, PageResult, SesionRecord } from './academic.types.js';
import type { SesionView } from './academic.views.js';
import { runIdempotentCreate } from './idempotent-create.js';
import { GroupRepository } from './ports/group.repository.js';
import { SessionRepository } from './ports/session.repository.js';
import { AcademicUnitOfWork } from './ports/unit-of-work.js';
import {
  canTransitionSesion,
  sesionEventCode,
  type SesionEstado,
} from '../domain/academic-states.js';

export interface CreateSesionInput {
  grupoId: string;
  fecha: string;
  tema: string | null;
}

const OPERACION = 'academic:session:create';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/** Fecha civil: `date` de PostgreSQL se lee en hora local, igual que en C4. */
function parseFecha(value: string): Date {
  if (!DATE_PATTERN.test(value)) {
    throw AcademicError.invalidInput('La fecha debe tener formato YYYY-MM-DD.');
  }
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const fecha = new Date(year, month - 1, day);
  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.getFullYear() !== year ||
    fecha.getMonth() !== month - 1 ||
    fecha.getDate() !== day
  ) {
    throw AcademicError.invalidInput('La fecha no es válida.');
  }
  return fecha;
}

function formatFecha(value: Date): string {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(SessionRepository) private readonly repository: SessionRepository,
    @Inject(GroupRepository) private readonly groups: GroupRepository,
    @Inject(AcademicUnitOfWork) private readonly unitOfWork: AcademicUnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
  ) {}

  private esGlobal(actor: ActorContext): boolean {
    return actor.permissions.includes('academic:group:manage');
  }

  /** D75: un grupo ajeno se oculta como 404, nunca como 403. */
  private async assertGroupScope(grupoId: string, actor: ActorContext): Promise<void> {
    const grupo = await this.groups.findById(grupoId);
    if (
      !grupo ||
      (!this.esGlobal(actor) &&
        grupo.educadorId !== actor.userId &&
        !(await this.groups.isStudentEnrolled(grupoId, actor.userId)))
    ) {
      throw AcademicError.notFound('Grupo');
    }
  }

  async create(
    input: CreateSesionInput,
    actor: ActorContext,
    idempotencyKey: string | null,
  ): Promise<SesionView> {
    const fecha = parseFecha(input.fecha);
    await this.assertGroupScope(input.grupoId, actor);

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: OPERACION,
        clave: idempotencyKey,
        cuerpo: input,
      },
      async () => {
        const record = await this.unitOfWork.run(async (tx) => {
          const created = await tx.sessions.create({
            id: uuidv7(),
            grupoId: input.grupoId,
            fecha,
            tema: input.tema?.trim() || null,
          });
          await tx.audit.record({
            accion: 'clase.creada',
            recurso: 'clase',
            recursoId: created.id,
            actorId: actor.userId,
            actorPerfil: actor.actorProfile,
            ip: actor.ip,
            dispositivo: actor.userAgent,
            datosDespues: {
              grupo_id: created.grupoId,
              fecha: created.fecha.toISOString().slice(0, 10),
              tema: created.tema,
              estado: created.estado,
            },
            requestId: actor.requestId,
          });

          // C6/D85: el recordatorio de fechas sale por la outbox en la misma
          // transacción que la sesión. El despachador aplica las preferencias
          // del destinatario (no es un evento crítico).
          const usuarioIds = await tx.groups.listEnrolledUsuarioIds(created.grupoId);
          if (usuarioIds.length > 0) {
            await tx.outbox.enqueue({
              id: uuidv7(),
              tipo: 'recordatorio.fechas',
              agregado: 'clase',
              ocurridoEn: new Date(),
              payload: {
                sesionId: created.id,
                grupoId: created.grupoId,
                fecha: formatFecha(created.fecha),
              },
              usuarioIds,
            });
          }
          return created;
        });
        return toSesionView(record);
      },
    );
  }

  async transition(id: string, to: SesionEstado, actor: ActorContext): Promise<SesionView> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw AcademicError.notFound('Sesión');
    }
    await this.assertGroupScope(current.grupoId, actor);

    if (current.estado === to) {
      return toSesionView(current);
    }
    if (!canTransitionSesion(current.estado, to)) {
      throw AcademicError.invalidTransition(current.estado, to);
    }

    const accion = sesionEventCode(to);
    if (!accion) {
      throw AcademicError.invalidTransition(current.estado, to);
    }

    const updated = await this.unitOfWork.run(async (tx) => {
      const record = await tx.sessions.updateState(id, to);
      await tx.audit.record({
        accion,
        recurso: 'clase',
        recursoId: id,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: actor.ip,
        dispositivo: actor.userAgent,
        datosAntes: { estado: current.estado },
        datosDespues: { estado: to },
        requestId: actor.requestId,
      });
      return record;
    });

    return toSesionView(updated);
  }

  async listByGroup(
    grupoId: string,
    page: PageInput,
    actor: ActorContext,
  ): Promise<PageResult<SesionView>> {
    await this.assertGroupScope(grupoId, actor);
    const result = await this.repository.list({ ...page, grupoId });
    return { ...result, data: result.data.map(toSesionView) };
  }

  async get(id: string, actor: ActorContext): Promise<SesionView> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw AcademicError.notFound('Sesión');
    }
    await this.assertGroupScope(record.grupoId, actor);
    return toSesionView(record);
  }
}

export function toSesionView(record: SesionRecord): SesionView {
  return {
    id: record.id,
    grupoId: record.grupoId,
    fecha: formatFecha(record.fecha),
    tema: record.tema,
    estado: record.estado,
    creadoEn: record.creadoEn.toISOString(),
  };
}
