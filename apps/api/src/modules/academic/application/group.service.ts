import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import { AcademicError } from './academic-error.js';
import type { ActorContext, PageInput, PageResult } from './academic.types.js';
import type { GrupoView, HorarioView } from './academic.views.js';
import { runIdempotentCreate } from './idempotent-create.js';
import { GroupRepository } from './ports/group.repository.js';
import { ProgramRepository } from './ports/program.repository.js';
import { AcademicUnitOfWork } from './ports/unit-of-work.js';
import { UserDirectory } from './ports/user-directory.js';
import {
  canTransitionGrupo,
  isValidPeriod,
  isValidScheduleRange,
  rangesOverlap,
  type GrupoEstado,
} from '../domain/academic-states.js';

export interface CreateGrupoInput {
  programaId: string;
  codigo: string;
  educadorId: string;
  salon: string | null;
  periodo: string;
  cupoMaximo: number;
}

export interface HorarioSlotInput {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

const OPERACION = 'academic:group:create';
const MAX_SLOTS = 20;

@Injectable()
export class GroupService {
  constructor(
    @Inject(GroupRepository) private readonly repository: GroupRepository,
    @Inject(ProgramRepository) private readonly programs: ProgramRepository,
    @Inject(AcademicUnitOfWork) private readonly unitOfWork: AcademicUnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    @Inject(UserDirectory) private readonly users: UserDirectory,
  ) {}

  async list(page: PageInput, actor: ActorContext): Promise<PageResult<GrupoView>> {
    const puedeVerTodos = actor.permissions.includes('academic:group:manage');
    const result = await this.repository.list({
      ...page,
      educadorId: puedeVerTodos ? null : actor.userId,
    });
    return { ...result, data: result.data.map(toGrupoView) };
  }

  async create(
    input: CreateGrupoInput,
    actor: ActorContext,
    idempotencyKey: string | null,
  ): Promise<GrupoView> {
    if (!isValidPeriod(input.periodo)) {
      throw AcademicError.invalidPeriod();
    }

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: OPERACION,
        clave: idempotencyKey,
        cuerpo: input,
      },
      async () => {
        const programa = await this.programs.findById(input.programaId);
        if (!programa) {
          throw AcademicError.notFound('Programa');
        }
        if (!(await this.users.isActiveEducator(input.educadorId))) {
          throw AcademicError.educatorInvalid();
        }

        const record = await this.unitOfWork.run(async (tx) => {
          const created = await tx.groups.create({
            id: uuidv7(),
            programaId: input.programaId,
            codigo: input.codigo.trim(),
            educadorId: input.educadorId,
            salon: input.salon?.trim() || null,
            periodo: input.periodo,
            cupoMaximo: input.cupoMaximo,
          });

          await tx.audit.record({
            accion: 'grupo.creado',
            recurso: 'grupo',
            recursoId: created.id,
            actorId: actor.userId,
            actorPerfil: actor.actorProfile,
            ip: actor.ip,
            dispositivo: actor.userAgent,
            datosDespues: {
              programa_id: created.programaId,
              periodo: created.periodo,
              estado: created.estado,
            },
            requestId: actor.requestId,
          });

          return created;
        });

        return toGrupoView(record);
      },
    );
  }

  async transition(id: string, to: GrupoEstado, actor: ActorContext): Promise<GrupoView> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw AcademicError.notFound('Grupo');
    }

    if (current.estado === to) {
      return toGrupoView(current);
    }

    if (!canTransitionGrupo(current.estado, to)) {
      throw AcademicError.invalidTransition(current.estado, to);
    }

    const updated = await this.unitOfWork.run(async (tx) => {
      const record = await tx.groups.updateState(id, to);
      await tx.audit.record({
        accion: 'grupo.cerrado',
        recurso: 'grupo',
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

    return toGrupoView(updated);
  }

  async getSchedule(grupoId: string, actor: ActorContext): Promise<HorarioView[]> {
    const grupo = await this.repository.findById(grupoId);
    if (!grupo) {
      throw AcademicError.notFound('Grupo');
    }

    const puedeGestionar = actor.permissions.includes('academic:group:manage');
    const esEducador = grupo.educadorId === actor.userId;
    const puedeVerComoEstudiante =
      actor.permissions.includes('academic:schedule:read_own') &&
      (await this.repository.isStudentEnrolled(grupoId, actor.userId));

    if (!puedeGestionar && !esEducador && !puedeVerComoEstudiante) {
      // A-12/A-13: el acceso ajeno responde 404, no 403.
      throw AcademicError.notFound('Grupo');
    }

    const slots = await this.repository.findSchedule(grupoId);
    return slots.map((slot) => toHorarioView(slot, grupo));
  }

  async replaceSchedule(
    grupoId: string,
    slots: readonly HorarioSlotInput[],
    actor: ActorContext,
  ): Promise<HorarioView[]> {
    const grupo = await this.repository.findById(grupoId);
    if (!grupo) {
      throw AcademicError.notFound('Grupo');
    }

    if (slots.length > MAX_SLOTS) {
      throw AcademicError.invalidInput(`El horario admite como máximo ${MAX_SLOTS} franjas.`);
    }

    for (const slot of slots) {
      if (!isValidScheduleRange(slot.horaInicio, slot.horaFin)) {
        throw AcademicError.scheduleInvalidRange();
      }
    }

    for (let index = 0; index < slots.length; index += 1) {
      for (let other = index + 1; other < slots.length; other += 1) {
        if (rangesOverlap(slots[index], slots[other])) {
          throw AcademicError.scheduleOverlap();
        }
      }
    }

    const lockKeys = [`schedule:${grupo.periodo}:educador:${grupo.educadorId}`];
    if (grupo.salon) {
      lockKeys.push(`schedule:${grupo.periodo}:salon:${grupo.salon}`);
    }

    const updated = await this.unitOfWork.run(async (tx) => {
      await tx.groups.acquireScheduleLocks(lockKeys.sort());

      const overlap = await tx.groups.hasScheduleOverlap({
        grupoId,
        periodo: grupo.periodo,
        educadorId: grupo.educadorId,
        salon: grupo.salon,
        slots,
      });
      if (overlap) {
        throw AcademicError.scheduleOverlap();
      }

      const saved = await tx.groups.replaceSchedule(grupoId, slots);

      await tx.audit.record({
        accion: 'horario.modificado',
        recurso: 'grupo',
        recursoId: grupoId,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: actor.ip,
        dispositivo: actor.userAgent,
        datosDespues: { franjas: saved.length },
        requestId: actor.requestId,
      });

      const destinatarios = await tx.groups.listEnrolledUsuarioIds(grupoId);
      await tx.outbox.enqueue({
        id: uuidv7(),
        tipo: 'horario.modificado',
        agregado: 'grupo',
        ocurridoEn: new Date(),
        payload: {
          grupoId,
          periodo: grupo.periodo,
          franjas: saved.length,
          usuarioIds: destinatarios,
        },
        usuarioIds: destinatarios,
      });

      return saved;
    });

    return updated.map((slot) => toHorarioView(slot, grupo));
  }

  async mySchedule(actor: ActorContext): Promise<HorarioView[]> {
    const slots = await this.repository.findScheduleForStudent(actor.userId);
    return slots.map((slot) => ({
      id: slot.id,
      grupoId: slot.grupoId,
      grupoCodigo: slot.grupoCodigo,
      programaNombre: slot.programaNombre,
      salon: slot.salon,
      periodo: slot.periodo,
      diaSemana: slot.diaSemana,
      horaInicio: slot.horaInicio,
      horaFin: slot.horaFin,
    }));
  }
}

export function toGrupoView(record: {
  id: string;
  programaId: string;
  codigo: string;
  educadorId: string;
  salon: string | null;
  periodo: string;
  cupoMaximo: number;
  estado: GrupoEstado;
  creadoEn: Date;
}): GrupoView {
  return {
    id: record.id,
    programaId: record.programaId,
    codigo: record.codigo,
    educadorId: record.educadorId,
    salon: record.salon,
    periodo: record.periodo,
    cupoMaximo: record.cupoMaximo,
    estado: record.estado,
    creadoEn: record.creadoEn.toISOString(),
  };
}

function toHorarioView(
  slot: {
    id: string;
    grupoId: string;
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
  },
  grupo: { codigo: string; salon: string | null; periodo: string },
): HorarioView {
  return {
    id: slot.id,
    grupoId: slot.grupoId,
    grupoCodigo: grupo.codigo,
    programaNombre: null,
    salon: grupo.salon,
    periodo: grupo.periodo,
    diaSemana: slot.diaSemana,
    horaInicio: slot.horaInicio,
    horaFin: slot.horaFin,
  };
}
