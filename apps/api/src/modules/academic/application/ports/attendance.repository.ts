import type { AsistenciaRecord, NewAsistenciaRecord } from '../academic.types.js';

/** Persistencia de asistencia por sesión y matrícula (C5 — RB1-39). */
export abstract class AttendanceRepository {
  abstract listBySession(sesionId: string): Promise<AsistenciaRecord[]>;
  abstract listByMatricula(matriculaId: string): Promise<AsistenciaRecord[]>;
  abstract findBySessionAndMatricula(
    sesionId: string,
    matriculaId: string,
  ): Promise<AsistenciaRecord | null>;
  /** Reemplaza el conjunto completo declarado para la sesión (R-010). */
  abstract replace(
    sesionId: string,
    rows: readonly NewAsistenciaRecord[],
  ): Promise<AsistenciaRecord[]>;
}
