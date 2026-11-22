import type { GrupoEstado } from '../../domain/academic-states.js';
import type {
  GrupoRecord,
  HorarioConGrupoRecord,
  HorarioInput,
  HorarioRecord,
  NewGrupoRecord,
  PageInput,
  PageResult,
} from '../academic.types.js';

export interface GroupListFilter extends PageInput {
  /** `null` = sin filtro (ámbito global). */
  educadorId: string | null;
}

export interface ScheduleOverlapInput {
  grupoId: string;
  periodo: string;
  educadorId: string;
  salon: string | null;
  slots: readonly HorarioInput[];
}

export abstract class GroupRepository {
  abstract create(input: NewGrupoRecord): Promise<GrupoRecord>;
  abstract findById(id: string): Promise<GrupoRecord | null>;
  abstract updateState(id: string, estado: GrupoEstado): Promise<GrupoRecord>;
  abstract list(filter: GroupListFilter): Promise<PageResult<GrupoRecord>>;
  abstract findSchedule(grupoId: string): Promise<HorarioRecord[]>;
  abstract replaceSchedule(
    grupoId: string,
    slots: readonly HorarioInput[],
  ): Promise<HorarioRecord[]>;
  abstract lockById(id: string): Promise<GrupoRecord | null>;
  abstract hasScheduleOverlap(input: ScheduleOverlapInput): Promise<boolean>;
  abstract acquireScheduleLocks(keys: readonly string[]): Promise<void>;
  abstract listEnrolledUsuarioIds(grupoId: string): Promise<string[]>;
  abstract isStudentEnrolled(grupoId: string, usuarioId: string): Promise<boolean>;
  abstract findScheduleForStudent(usuarioId: string): Promise<HorarioConGrupoRecord[]>;
}
