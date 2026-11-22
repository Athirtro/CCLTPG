import type {
  EvaluacionConIndicadorRecord,
  EvaluacionListFilter,
  EvaluacionRecord,
  MiEvaluacionRecord,
  NewEvaluacionRecord,
  PageResult,
} from '../academic.types.js';

/** Persistencia de evaluación cualitativa (C5 — RB1-41). */
export abstract class EvaluationRepository {
  abstract create(input: NewEvaluacionRecord): Promise<EvaluacionRecord>;
  abstract findById(id: string): Promise<EvaluacionRecord | null>;
  abstract findDuplicate(input: {
    matriculaId: string;
    indicadorId: string;
    periodo: string;
  }): Promise<EvaluacionRecord | null>;
  abstract list(filter: EvaluacionListFilter): Promise<PageResult<EvaluacionConIndicadorRecord>>;
  abstract listForStudent(usuarioId: string): Promise<MiEvaluacionRecord[]>;
  abstract update(
    id: string,
    changes: { valor: EvaluacionRecord['valor']; observacion: string | null },
  ): Promise<EvaluacionRecord>;
}
