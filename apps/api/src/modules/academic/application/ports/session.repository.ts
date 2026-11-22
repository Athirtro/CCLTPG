import type { SesionEstado } from '../../domain/academic-states.js';
import type {
  NewSesionRecord,
  PageResult,
  SesionListFilter,
  SesionRecord,
} from '../academic.types.js';

/** Persistencia de sesiones de clase (C5 — RB1-38). */
export abstract class SessionRepository {
  abstract create(input: NewSesionRecord): Promise<SesionRecord>;
  abstract findById(id: string): Promise<SesionRecord | null>;
  abstract lockById(id: string): Promise<SesionRecord | null>;
  abstract updateState(id: string, estado: SesionEstado): Promise<SesionRecord>;
  abstract list(filter: SesionListFilter): Promise<PageResult<SesionRecord>>;
}
