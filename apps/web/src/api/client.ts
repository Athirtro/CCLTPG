import createClient from 'openapi-fetch';

// Tipos derivados de packages/contracts/openapi.json (contrato aprobado en C0/C1/C2)
export type ProfileSummaryDto = {
  codigo: string;
  validUntil: string | null;
};

export type MfaEnrollResponseDto = {
  secret: string;
  otpauthUri: string;
};

export type MfaEnrollConfirmResponseDto = LoginResponseDto & {
  recoveryCodes: string[];
};

export type LoginResponseDto = {
  status: 'authenticated' | 'password_change_required' | 'mfa_required' | 'mfa_enrollment_required';
  sessionToken?: string;
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
  csrfToken?: string;
  mustChangePassword: boolean;
  profiles: ProfileSummaryDto[];
};

export type MeResponseDto = {
  userId: string;
  email: string;
  nombre: string;
  estado: string;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  profiles: ProfileSummaryDto[];
  activeProfile: string | null;
  permissions: string[];
};

export type ProblemDetailsDto = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  errors: unknown[];
  requestId: string;
};

// ===== Tipos Iteración 3 — Archivos, Notificaciones, Exportaciones (plan C3) =====

export type ArchivoDto = {
  id: string;
  nombreOriginal: string;
  mime: string;
  tamano: number;
  hashSha256: string;
  rutaObjeto: string;
  subidoPor: string;
  estadoEscaneo: 'pendiente' | 'limpio' | 'infectado' | 'cuarentena';
  creadoEn: string;
};

export type SubirArchivoResponseDto = {
  archivo: ArchivoDto;
  advertencia?: string;
};

export type NotificacionDto = {
  id: string;
  evento: string;
  canal: 'app' | 'email';
  plantillaId?: string;
  payload: Record<string, unknown>;
  estado: 'pendiente' | 'enviada' | 'leida' | 'fallida';
  leidaEn: string | null;
  enviadaEn: string | null;
  creadoEn: string;
};

export type PreferenciaNotificacionDto = {
  evento: string;
  canal: 'app' | 'email';
  habilitado: boolean;
};

export type ActualizarPreferenciaDto = {
  evento: string;
  canal: 'app' | 'email';
  habilitado: boolean;
};

export type ExportacionDto = {
  id: string;
  plantilla: string;
  formato: 'pdf' | 'xlsx' | 'csv';
  estado: 'pendiente' | 'generada' | 'fallida';
  archivoId?: string;
  filas: number;
  tamanoBytes: number;
  creadoEn: string;
  expiraEn: string;
};

export type CrearExportacionDto = {
  plantilla: string;
  formato: 'pdf' | 'xlsx' | 'csv';
  entrada: Record<string, unknown>;
};

// Tipos para health (traídos del pull, endpoint /health/ready)
export type ReadinessReport = {
  status: 'ok' | 'unavailable';
  checks: Record<string, { status: 'up' | 'down'; latencyMs: number }>;
  checkedAt: string;
};

export type ProblemDetails = ProblemDetailsDto;

export type Paths = {
  '/auth/login': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            email: string;
            password: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': LoginResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        429: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/mfa/verify': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            sessionToken: string;
            code: string;
            method?: 'totp' | 'recovery';
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': LoginResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        429: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/refresh': {
    post: {
      responses: {
        200: {
          content: {
            'application/json': LoginResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        403: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/logout': {
    post: {
      responses: {
        204: {
          description: 'Sesión cerrada';
        };
        403: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/password': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            currentPassword: string;
            newPassword: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': LoginResponseDto;
          };
        };
        204: {
          description: 'Contraseña cambiada';
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/mfa/enroll': {
    post: {
      responses: {
        200: {
          content: {
            'application/json': MfaEnrollResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/auth/mfa/enroll/confirm': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            sessionToken?: string;
            code: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': MfaEnrollConfirmResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/me': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': MeResponseDto;
          };
        };
        401: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/health/ready': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': ReadinessReport;
          };
        };
      };
    };
  };
  // --- Archivos (Iteración 3) ---
  '/files': {
    post: {
      requestBody: {
        content: {
          'multipart/form-data': FormData;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': SubirArchivoResponseDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        413: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        415: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/files/{id}/download': {
    get: {
      parameters: {
        path: { id: string };
      };
      responses: {
        200: {
          content: {
            'application/octet-stream': Blob;
          };
        };
        404: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  // --- Notificaciones (Iteración 3) ---
  '/notifications': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': NotificacionDto[];
          };
        };
      };
    };
  };
  '/notifications/{id}': {
    patch: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': {
            leida: boolean;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': NotificacionDto;
          };
        };
        403: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        404: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/notifications/preferences': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': PreferenciaNotificacionDto[];
          };
        };
      };
    };
    put: {
      requestBody: {
        content: {
          'application/json': ActualizarPreferenciaDto[];
        };
      };
      responses: {
        200: {
          content: {
            'application/json': PreferenciaNotificacionDto[];
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  // --- Exportaciones (Iteración 3) ---
  '/exports': {
    post: {
      requestBody: {
        content: {
          'application/json': CrearExportacionDto;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': ExportacionDto;
          };
        };
        202: {
          content: {
            'application/json': ExportacionDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        404: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  // --- Académico (Iteración 4) ---
  '/academic/programs': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': ProgramaDto[];
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          'application/json': CrearProgramaDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': ProgramaDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/academic/programs/{id}/transitions': {
    post: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': {
            to: 'publicado' | 'cerrado';
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': ProgramaDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        404: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/academic/groups': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': GrupoDto[];
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          'application/json': CrearGrupoDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': GrupoDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/academic/groups/{id}/transitions': {
    post: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': {
            to: 'abierto' | 'cerrado';
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': GrupoDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        404: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/academic/students': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': EstudianteDto[];
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          'application/json': CrearEstudianteDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': EstudianteDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/me/student': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': EstudianteDto;
          };
        };
        404: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/me/enrollments': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': MatriculaDto[];
          };
        };
      };
    };
  };
  '/academic/enrollments': {
    post: {
      requestBody: {
        content: {
          'application/json': CrearMatriculaDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': MatriculaDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/academic/enrollments/{id}/transitions': {
    post: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': {
            to: 'confirmada' | 'cancelada';
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': MatriculaDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        404: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/me/schedule': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': SesionHorarioDto[];
          };
        };
      };
    };
  };
  '/academic/sessions': {
    post: {
      requestBody: {
        content: {
          'application/json': CrearSesionDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': SesionDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/academic/sessions/{id}/transitions': {
    post: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': {
            to: 'programada' | 'realizada' | 'cancelada';
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': SesionDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        404: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/academic/sessions/{id}/attendance': {
    put: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': {
            registros: Array<{ matriculaId: string; presente: boolean }>;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': { registros: number };
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        404: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/academic/evaluations': {
    post: {
      requestBody: {
        content: {
          'application/json': CrearEvaluacionDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': EvaluacionDto;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        409: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
      };
    };
  };
  '/me/evaluations': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': EvaluacionDto[];
          };
        };
      };
    };
  };
};

// ===== Tipos Académicos (Iteración 4) =====

export type ProgramaDto = {
  id: string;
  nombre: string;
  cupo: number;
  inscritos: number;
  estado: 'borrador' | 'publicado' | 'cerrado';
};

export type CrearProgramaDto = {
  nombre: string;
  cupo: number;
};

export type GrupoDto = {
  id: string;
  nombre: string;
  programaId: string;
  programaNombre: string;
  horario: string;
  cupo: number;
  inscritos: number;
  estado: 'abierto' | 'cerrado';
};

export type CrearGrupoDto = {
  nombre: string;
  programaId: string;
  horario: string;
  cupo: number;
};

export type EstudianteDto = {
  id: string;
  nombre: string;
  email: string;
  programaId?: string;
  programaNombre?: string;
  estado: 'activo' | 'inactivo' | 'bloqueado';
};

export type CrearEstudianteDto = {
  nombre: string;
  email: string;
  programaId?: string;
};

export type MatriculaDto = {
  id: string;
  estudianteId: string;
  estudianteNombre: string;
  programaId: string;
  programaNombre: string;
  grupoId: string;
  grupoNombre: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  creadoEn: string;
};

export type CrearMatriculaDto = {
  estudianteId: string;
  grupoId: string;
};

export type SesionHorarioDto = {
  id: string;
  grupoId: string;
  grupoNombre: string;
  programaNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  salon: string;
  estado: 'programada' | 'realizada' | 'cancelada';
};

export type SesionDto = {
  id: string;
  grupoId: string;
  grupoNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  salon: string;
  estado: 'programada' | 'realizada' | 'cancelada';
};

export type CrearSesionDto = {
  grupoId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  salon: string;
};

export type RegistroAsistenciaDto = {
  matriculaId: string;
  presente: boolean;
};

export type EvaluacionDto = {
  id: string;
  estudianteId: string;
  estudianteNombre: string;
  grupoId: string;
  grupoNombre: string;
  indicador: string;
  periodo: string;
  valor: number;
  fecha: string;
};

export type CrearEvaluacionDto = {
  estudianteId: string;
  grupoId: string;
  indicador: string;
  periodo: string;
  valor: number;
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiClient = createClient<Paths>({
  baseUrl: API_BASE_URL,
});
