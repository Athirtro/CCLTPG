import type { ProgramaEstado } from '../../domain/academic-states.js';
import type {
  NewProgramaRecord,
  PageInput,
  PageResult,
  ProgramaRecord,
} from '../academic.types.js';

export abstract class ProgramRepository {
  abstract create(input: NewProgramaRecord): Promise<ProgramaRecord>;
  abstract findById(id: string): Promise<ProgramaRecord | null>;
  abstract updateState(id: string, estado: ProgramaEstado): Promise<ProgramaRecord>;
  abstract list(page: PageInput): Promise<PageResult<ProgramaRecord>>;
}
