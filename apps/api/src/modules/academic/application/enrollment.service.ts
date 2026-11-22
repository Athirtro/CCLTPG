import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import { AcademicError } from './academic-error.js';
import type {
  ActorContext,
  GrupoRecord,
  MatriculaListRecord,
  MatriculaRecord,
  PageInput,
  PageResult,
  ProgramaRecord,
  EstudianteRecord,
} from './academic.types.js';
import type { MatriculaView } from './academic.views.js';
import { runIdempotentCreate } from './idempotent-create.js';
import { EnrollmentRepository } from './ports/enrollment.repository.js';
import { GroupRepository } from './ports/group.repository.js';
import { ProgramRepository } from './ports/program.repository.js';
import { StudentRepository } from './ports/student.repository.js';
import { AcademicUnitOfWork } from './ports/unit-of-work.js';
import {
  canTransitionMatricula,
  isValidPeriod,
  matriculaEventCode,
  type MatriculaEstado,
} from '../domain/academic-states.js';

export interface CreateMatriculaInput {
  estudianteId: string;
  grupoId: string;
  periodo: string | null;
}

const OPERACION = 'academic:enrollment:create';

@Injectable()
export class EnrollmentService {
  constructor(
    @Inject(EnrollmentRepository) private readonly repository: EnrollmentRepository,
    @Inject(GroupRepository) private readonly groups: GroupRepository,
    @Inject(StudentRepository) private readonly students: StudentRepository,
    @Inject(ProgramRepository) private readonly programs: ProgramRepository,
    @Inject(AcademicUnitOfWork) private readonly unitOfWork: AcademicUnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
  ) {}

  async create(
    input: CreateMatriculaInput,
    actor: ActorContext,
    idempotencyKey: string | null,
  ): Promise<MatriculaView> {
    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: OPERACION,
        clave: idempotencyKey,
        cuerpo: input,
      },
      async () => {
        const grupo = await this.groups.findById(input.grupoId);
        if (!grupo) {
          throw AcademicError.notFound('Grupo');
        }
        if (grupo.estado === 'cerrado') {
          throw AcademicError.groupClosed();
        }

        const periodo = input.periodo ?? grupo.periodo;
        if (!isValidPeriod(periodo) || periodo !== grupo.periodo) {
          throw AcademicError.invalidPeriod();
        }

        const estudiante = await this.students.findById(input.estudianteId);
        if (!estudiante) {
          throw AcademicError.notFound('Estudiante');
        }

        const duplicate = await this.repository.findVigente(
          input.estudianteId,
          input.grupoId,
          periodo,
        );
        if (duplicate) {
          throw AcademicError.enrollmentDuplicate();
        }

        const programa = await this.programs.findById(grupo.programaId);

        const record = await this.unitOfWork.run(async (tx) => {
          const created = await tx.enrollments.create({
            id: uuidv7(),
            estudianteId: input.estudianteId,
            grupoId: input.grupoId,
            periodo,
            fechaMatricula: new Date(),
          });

          await tx.audit.record({
            accion: 'matricula.creada',
            recurso: 'matricula',
            recursoId: created.id,
            actorId: actor.userId,
            actorPerfil: actor.actorProfile,
            ip: actor.ip,
            dispositivo: actor.userAgent,
            datosDespues: { estado: created.estado, periodo: created.periodo },
            requestId: actor.requestId,
          });

          await enqueueEnrollmentEvent(tx.outbox, created, estudiante.usuarioId);
          return created;
        });

        return toMatriculaView(record, estudiante, grupo, programa);
      },
    );
  }

  async transition(id: string, to: MatriculaEstado, actor: ActorContext): Promise<MatriculaView> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw AcademicError.notFound('Matrícula');
    }

    const grupo = await this.groups.findById(current.grupoId);
    if (!grupo) {
      throw AcademicError.notFound('Grupo');
    }
    const estudiante = await this.students.findById(current.estudianteId);
    if (!estudiante) {
      throw AcademicError.notFound('Estudiante');
    }
    const programa = await this.programs.findById(grupo.programaId);

    if (current.estado === to) {
      return toMatriculaView(current, estudiante, grupo, programa);
    }

    if (!canTransitionMatricula(current.estado, to)) {
      throw AcademicError.invalidTransition(current.estado, to);
    }

    const updated = await this.unitOfWork.run(async (tx) => {
      const locked = await tx.groups.lockById(current.grupoId);
      if (!locked) {
        throw AcademicError.notFound('Grupo');
      }

      if (to === 'confirmada') {
        if (locked.estado === 'cerrado') {
          throw AcademicError.groupClosed();
        }
        const ocupados = await tx.enrollments.countCapacity(locked.id);
        if (ocupados >= locked.cupoMaximo) {
          throw AcademicError.capacityExceeded();
        }
      }

      const record = await tx.enrollments.updateState(id, to);

      await tx.audit.record({
        accion: matriculaEventCode(to),
        recurso: 'matricula',
        recursoId: id,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: actor.ip,
        dispositivo: actor.userAgent,
        datosAntes: { estado: current.estado },
        datosDespues: { estado: to, periodo: record.periodo },
        requestId: actor.requestId,
      });

      await enqueueEnrollmentEvent(tx.outbox, record, estudiante.usuarioId);
      return record;
    });

    return toMatriculaView(updated, estudiante, grupo, programa);
  }

  async listMine(actor: ActorContext, page: PageInput): Promise<PageResult<MatriculaView>> {
    const estudiante = await this.students.findByUsuarioId(actor.userId);
    if (!estudiante) {
      // A-14: colección propia vacía, no 404.
      return { page: page.page, pageSize: page.pageSize, total: 0, data: [] };
    }

    const result = await this.repository.listByEstudiante(estudiante.id, page);
    return { ...result, data: result.data.map(toMatriculaViewFromList) };
  }

  async list(actor: ActorContext, page: PageInput): Promise<PageResult<MatriculaView>> {
    // El administrador (con update) ve todo; el educador solo sus grupos.
    const educadorId = actor.permissions.includes('academic:enrollment:update')
      ? null
      : actor.userId;
    const result = await this.repository.listForScope(educadorId, page);
    return { ...result, data: result.data.map(toMatriculaViewFromList) };
  }
}

function toMatriculaView(
  record: MatriculaRecord,
  estudiante: EstudianteRecord,
  grupo: GrupoRecord,
  programa: ProgramaRecord | null,
): MatriculaView {
  return {
    id: record.id,
    estudianteId: record.estudianteId,
    estudianteNombres: estudiante.nombres,
    estudianteApellidos: estudiante.apellidos,
    grupoId: record.grupoId,
    grupoCodigo: grupo.codigo,
    programaId: grupo.programaId,
    programaNombre: programa?.nombre ?? '',
    periodo: record.periodo,
    estado: record.estado,
    fechaMatricula: record.fechaMatricula.toISOString(),
  };
}

function toMatriculaViewFromList(record: MatriculaListRecord): MatriculaView {
  return {
    id: record.id,
    estudianteId: record.estudianteId,
    estudianteNombres: record.estudianteNombres,
    estudianteApellidos: record.estudianteApellidos,
    grupoId: record.grupoId,
    grupoCodigo: record.grupoCodigo,
    programaId: record.programaId,
    programaNombre: record.programaNombre,
    periodo: record.periodo,
    estado: record.estado,
    fechaMatricula: record.fechaMatricula.toISOString(),
  };
}

async function enqueueEnrollmentEvent(
  outbox: {
    enqueue: (event: {
      id: string;
      tipo: string;
      agregado: string;
      ocurridoEn: Date;
      payload: Record<string, unknown>;
      usuarioIds?: string[];
    }) => Promise<void>;
  },
  record: MatriculaRecord,
  usuarioId: string | null,
): Promise<void> {
  const usuarioIds = usuarioId ? [usuarioId] : [];
  await outbox.enqueue({
    id: uuidv7(),
    tipo: matriculaEventCode(record.estado),
    agregado: 'matricula',
    ocurridoEn: new Date(),
    payload: {
      matriculaId: record.id,
      estudianteId: record.estudianteId,
      grupoId: record.grupoId,
      periodo: record.periodo,
      estado: record.estado,
      usuarioIds,
    },
    usuarioIds,
  });
}
