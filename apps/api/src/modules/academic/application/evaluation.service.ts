import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { AcademicError } from './academic-error.js';
import type { ActorContext, EvaluacionRecord, PageInput, PageResult } from './academic.types.js';
import type { EvaluacionView, MiEvaluacionView } from './academic.views.js';
import {
  isValidEvaluacionValor,
  isValidPeriod,
  type EvaluacionValor,
} from '../domain/academic-states.js';
import { EnrollmentRepository } from './ports/enrollment.repository.js';
import { EvaluationRepository } from './ports/evaluation.repository.js';
import { GroupRepository } from './ports/group.repository.js';
import { IndicatorRepository } from './ports/indicator.repository.js';
import { AcademicUnitOfWork } from './ports/unit-of-work.js';

export interface CreateEvaluacionInput {
  matriculaId: string;
  indicadorId: string;
  periodo: string;
  valor: EvaluacionValor;
  observacion: string | null;
}

/** AC-AUD-08: la observación nunca se copia literal a la auditoría. */
function redactarObservacion(observacion: string | null): unknown {
  return observacion === null ? null : { cambiado: true };
}

@Injectable()
export class EvaluationService {
  constructor(
    @Inject(EvaluationRepository) private readonly repository: EvaluationRepository,
    @Inject(EnrollmentRepository) private readonly enrollments: EnrollmentRepository,
    @Inject(GroupRepository) private readonly groups: GroupRepository,
    @Inject(IndicatorRepository) private readonly indicators: IndicatorRepository,
    @Inject(AcademicUnitOfWork) private readonly unitOfWork: AcademicUnitOfWork,
  ) {}

  private async loadScope(matriculaId: string, actor: ActorContext) {
    const matricula = await this.enrollments.findById(matriculaId);
    if (!matricula) {
      throw AcademicError.notFound('Matrícula');
    }
    const grupo = await this.groups.findById(matricula.grupoId);
    if (
      !grupo ||
      (!actor.permissions.includes('academic:group:manage') && grupo.educadorId !== actor.userId)
    ) {
      throw AcademicError.notFound('Matrícula');
    }
    return grupo;
  }

  private assertValor(indicadorEscala: string, valor: string): EvaluacionValor {
    const permitidos = indicadorEscala.split(',');
    if (!isValidEvaluacionValor(valor) || !permitidos.includes(valor)) {
      throw AcademicError.evaluationScaleInvalid();
    }
    return valor;
  }

  async create(input: CreateEvaluacionInput, actor: ActorContext): Promise<EvaluacionView> {
    const grupo = await this.loadScope(input.matriculaId, actor);
    if (!isValidPeriod(input.periodo) || input.periodo !== grupo.periodo) {
      throw AcademicError.invalidPeriod();
    }

    const indicador = await this.indicators.findById(input.indicadorId);
    if (
      !indicador ||
      (indicador.programaId !== null && indicador.programaId !== grupo.programaId)
    ) {
      throw AcademicError.notFound('Indicador');
    }
    const valor = this.assertValor(indicador.escala, input.valor);

    const duplicada = await this.repository.findDuplicate({
      matriculaId: input.matriculaId,
      indicadorId: input.indicadorId,
      periodo: input.periodo,
    });
    if (duplicada) {
      throw AcademicError.evaluationDuplicate();
    }

    const record = await this.unitOfWork.run(async (tx) => {
      const created = await tx.evaluations.create({
        id: uuidv7(),
        matriculaId: input.matriculaId,
        indicadorId: input.indicadorId,
        periodo: input.periodo,
        valor,
        observacion: input.observacion?.trim() || null,
        evaluadoPor: actor.userId,
      });
      await tx.audit.record({
        accion: 'evaluacion.registrada',
        recurso: 'evaluacion',
        recursoId: created.id,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: actor.ip,
        dispositivo: actor.userAgent,
        datosDespues: {
          matricula_id: created.matriculaId,
          indicador_id: created.indicadorId,
          periodo: created.periodo,
          valor: created.valor,
          observacion: redactarObservacion(created.observacion),
        },
        requestId: actor.requestId,
      });

      // C6/D85: la publicación al estudiante viaja por la outbox en la misma
      // transacción. El payload excluye la observación (AC-AUD-08) y los datos
      // personales; el despachador resuelve canal y preferencias.
      const usuarioId = await tx.students.findUsuarioIdByMatricula(created.matriculaId);
      if (usuarioId) {
        await tx.outbox.enqueue({
          id: uuidv7(),
          tipo: 'evaluacion.publicada',
          agregado: 'evaluacion',
          ocurridoEn: new Date(),
          payload: {
            matriculaId: created.matriculaId,
            indicadorId: created.indicadorId,
            periodo: created.periodo,
            valor: created.valor,
          },
          usuarioIds: [usuarioId],
        });
      }
      return created;
    });

    return toEvaluacionView(record, indicador.nombre);
  }

  async update(
    id: string,
    changes: { valor: EvaluacionValor; observacion: string | null },
    actor: ActorContext,
  ): Promise<EvaluacionView> {
    const anterior = await this.repository.findById(id);
    if (!anterior) {
      throw AcademicError.notFound('Evaluación');
    }
    await this.loadScope(anterior.matriculaId, actor);

    const indicador = await this.indicators.findById(anterior.indicadorId);
    const valor = this.assertValor(indicador?.escala ?? '', changes.valor);

    const actualizada = await this.unitOfWork.run(async (tx) => {
      const record = await tx.evaluations.update(id, {
        valor,
        observacion: changes.observacion?.trim() || null,
      });
      await tx.audit.record({
        accion: 'evaluacion.actualizada',
        recurso: 'evaluacion',
        recursoId: id,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: actor.ip,
        dispositivo: actor.userAgent,
        datosAntes: {
          valor: anterior.valor,
          observacion: redactarObservacion(anterior.observacion),
        },
        datosDespues: {
          valor: record.valor,
          observacion: redactarObservacion(record.observacion),
        },
        requestId: actor.requestId,
      });
      return record;
    });

    return toEvaluacionView(actualizada, indicador?.nombre ?? '');
  }

  async list(page: PageInput, actor: ActorContext): Promise<PageResult<EvaluacionView>> {
    const esGlobal = actor.permissions.includes('academic:group:manage');
    const result = await this.repository.list({
      ...page,
      grupoId: null,
      educadorId: esGlobal ? null : actor.userId,
      estudianteUsuarioId: null,
    });
    return {
      ...result,
      data: result.data.map((row) => toEvaluacionView(row, row.indicadorNombre)),
    };
  }

  async listMine(actor: ActorContext): Promise<MiEvaluacionView[]> {
    const rows = await this.repository.listForStudent(actor.userId);
    return rows.map((row) => ({
      ...toEvaluacionView(row, row.indicadorNombre),
      grupoCodigo: row.grupoCodigo,
      programaNombre: row.programaNombre,
    }));
  }
}

export function toEvaluacionView(
  record: EvaluacionRecord,
  indicadorNombre: string,
): EvaluacionView {
  return {
    id: record.id,
    matriculaId: record.matriculaId,
    indicadorId: record.indicadorId,
    indicadorNombre,
    periodo: record.periodo,
    valor: record.valor,
    observacion: record.observacion,
    evaluadoEn: record.evaluadoEn.toISOString(),
  };
}
