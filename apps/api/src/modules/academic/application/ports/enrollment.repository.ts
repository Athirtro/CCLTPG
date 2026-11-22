import type { MatriculaEstado } from '../../domain/academic-states.js';
import type {
  MatriculaListRecord,
  MatriculaRecord,
  NewMatriculaRecord,
  PageInput,
  PageResult,
} from '../academic.types.js';

export abstract class EnrollmentRepository {
  abstract create(input: NewMatriculaRecord): Promise<MatriculaRecord>;
  abstract findById(id: string): Promise<MatriculaRecord | null>;
  abstract findVigente(
    estudianteId: string,
    grupoId: string,
    periodo: string,
  ): Promise<MatriculaRecord | null>;
  abstract updateState(id: string, estado: MatriculaEstado): Promise<MatriculaRecord>;
  abstract countCapacity(grupoId: string): Promise<number>;
  abstract listByGrupo(grupoId: string): Promise<MatriculaRecord[]>;
  abstract listByEstudiante(
    estudianteId: string,
    page: PageInput,
  ): Promise<PageResult<MatriculaListRecord>>;
  abstract listForScope(
    educadorId: string | null,
    page: PageInput,
  ): Promise<PageResult<MatriculaListRecord>>;
}
