import type {
  EstudianteRecord,
  NewEstudianteRecord,
  PageInput,
  PageResult,
  UpdateEstudianteRecord,
} from '../academic.types.js';

export abstract class StudentRepository {
  abstract create(input: NewEstudianteRecord): Promise<EstudianteRecord>;
  abstract findById(id: string): Promise<EstudianteRecord | null>;
  abstract findByUsuarioId(usuarioId: string): Promise<EstudianteRecord | null>;
  abstract findByDocumentHash(hash: string): Promise<EstudianteRecord | null>;
  abstract update(id: string, input: UpdateEstudianteRecord): Promise<EstudianteRecord>;
  abstract list(page: PageInput): Promise<PageResult<EstudianteRecord>>;
}
