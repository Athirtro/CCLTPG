import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { AcademicError } from './academic-error.js';
import type { ActorContext, AsistenciaRecord, NewAsistenciaRecord } from './academic.types.js';
import type { AsistenciaView } from './academic.views.js';
import {
  VIGENT_MATRICULA_STATES,
  type AsistenciaEstado,
  type MatriculaEstado,
} from '../domain/academic-states.js';
import { AttendanceRepository } from './ports/attendance.repository.js';
import { EnrollmentRepository } from './ports/enrollment.repository.js';
import { GroupRepository } from './ports/group.repository.js';
import { SessionRepository } from './ports/session.repository.js';
import { AcademicUnitOfWork } from './ports/unit-of-work.js';

export interface AttendanceEntryInput {
  matriculaId: string;
  estado: AsistenciaEstado;
}

const ATTENDANCE_MATRICULA_STATES: readonly MatriculaEstado[] = [
  ...VIGENT_MATRICULA_STATES,
  'finalizada',
];
const MAX_REGISTROS = 200;

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(AttendanceRepository) private readonly repository: AttendanceRepository,
    @Inject(SessionRepository) private readonly sessions: SessionRepository,
    @Inject(EnrollmentRepository) private readonly enrollments: EnrollmentRepository,
    @Inject(GroupRepository) private readonly groups: GroupRepository,
    @Inject(AcademicUnitOfWork) private readonly unitOfWork: AcademicUnitOfWork,
  ) {}

  private async loadSessionForScope(sesionId: string, actor: ActorContext) {
    const sesion = await this.sessions.findById(sesionId);
    if (!sesion) {
      throw AcademicError.notFound('Sesión');
    }
    const grupo = await this.groups.findById(sesion.grupoId);
    if (
      !grupo ||
      (!actor.permissions.includes('academic:group:manage') && grupo.educadorId !== actor.userId)
    ) {
      throw AcademicError.notFound('Sesión');
    }
    return sesion;
  }

  async listBySession(sesionId: string, actor: ActorContext): Promise<AsistenciaView[]> {
    await this.loadSessionForScope(sesionId, actor);
    const rows = await this.repository.listBySession(sesionId);
    return rows.map(toAsistenciaView);
  }

  /** R-010/D72: idempotente por estado resultante, no por clave de solicitud. */
  async replace(
    sesionId: string,
    registros: readonly AttendanceEntryInput[],
    actor: ActorContext,
  ): Promise<AsistenciaView[]> {
    const sesion = await this.loadSessionForScope(sesionId, actor);
    if (sesion.estado !== 'realizada') {
      throw AcademicError.sessionNotReady(sesion.estado);
    }
    if (registros.length > MAX_REGISTROS) {
      throw AcademicError.invalidInput(`El máximo es ${MAX_REGISTROS} registros por sesión.`);
    }

    const matriculas = new Set(registros.map((entry) => entry.matriculaId));
    if (matriculas.size !== registros.length) {
      throw AcademicError.invalidInput('La matrícula aparece más de una vez en la solicitud.');
    }

    const permitidas = await this.enrollments.listByGrupo(sesion.grupoId);
    const validas = new Set(
      permitidas
        .filter((matricula) => ATTENDANCE_MATRICULA_STATES.includes(matricula.estado))
        .map((matricula) => matricula.id),
    );
    if (registros.some((entry) => !validas.has(entry.matriculaId))) {
      throw AcademicError.attendanceInvalidEnrollment();
    }

    const actuales = await this.repository.listBySession(sesionId);
    if (sameState(actuales, registros)) {
      return actuales.map(toAsistenciaView);
    }

    const registrados = await this.unitOfWork.run(async (tx) => {
      const filas = await tx.attendance.replace(
        sesionId,
        registros.map<NewAsistenciaRecord>((entry) => ({
          id: uuidv7(),
          sesionId,
          matriculaId: entry.matriculaId,
          estado: entry.estado,
          registradoPor: actor.userId,
        })),
      );
      await tx.audit.record({
        accion: 'asistencia.registrada',
        recurso: 'clase',
        recursoId: sesionId,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: actor.ip,
        dispositivo: actor.userAgent,
        datosDespues: {
          registros: filas.length,
          presentes: filas.filter((fila) => fila.estado === 'presente').length,
          ausentes: filas.filter((fila) => fila.estado === 'ausente').length,
        },
        requestId: actor.requestId,
      });
      return filas;
    });

    return registrados.map(toAsistenciaView);
  }
}

function sameState(
  actuales: readonly AsistenciaRecord[],
  deseados: readonly AttendanceEntryInput[],
): boolean {
  if (actuales.length !== deseados.length) {
    return false;
  }
  const mapa = new Map(actuales.map((fila) => [fila.matriculaId, fila.estado]));
  return deseados.every((entry) => mapa.get(entry.matriculaId) === entry.estado);
}

export function toAsistenciaView(record: AsistenciaRecord): AsistenciaView {
  return {
    id: record.id,
    sesionId: record.sesionId,
    matriculaId: record.matriculaId,
    estado: record.estado,
    registradoEn: record.registradoEn.toISOString(),
  };
}
