import type {
  AttendanceTotals,
  AnalyticsFilter,
  DropoutTotals,
  EvaluationTotals,
  MunicipioCount,
  ProgramTotals,
} from '../analytics.types.js';

/**
 * Consultas agregadas de analítica (C6 — RB1-51 a RB1-55).
 *
 * El puerto no expone registros individuales: todas las consultas devuelven
 * conteos o totales, con el ámbito ya aplicado por el repositorio.
 */
export abstract class KpiRepository {
  abstract countEnrollments(filter: AnalyticsFilter): Promise<number>;
  abstract attendanceTotals(filter: AnalyticsFilter): Promise<AttendanceTotals>;
  abstract evaluationTotals(filter: AnalyticsFilter): Promise<EvaluationTotals>;
  abstract programTotals(filter: AnalyticsFilter): Promise<ProgramTotals>;
  abstract dropoutTotals(filter: AnalyticsFilter): Promise<DropoutTotals>;
  abstract countByMunicipio(filter: AnalyticsFilter): Promise<MunicipioCount[]>;
  abstract groupBelongsToEducador(grupoId: string, educadorId: string): Promise<boolean>;
}
