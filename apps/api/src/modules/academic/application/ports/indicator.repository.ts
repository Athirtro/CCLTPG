import type { IndicadorRecord } from '../academic.types.js';

/** Catálogo de indicadores sembrado por migración; sin CRUD en v1.0 (D73). */
export abstract class IndicatorRepository {
  abstract findById(id: string): Promise<IndicadorRecord | null>;
  abstract listByPrograma(programaId: string): Promise<IndicadorRecord[]>;
}
