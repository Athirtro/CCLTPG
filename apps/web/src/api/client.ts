import createClient from 'openapi-fetch';

// ===== Tipos auth/identity (contrato actual C0-C2) =====

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

// ===== Tipos archivos (Iteración 3) — DTOs reales del contrato =====

export type FileResponseDto = {
  id: string;
  nombreOriginal: string;
  mime: string;
  tamano: number;
  hashSha256: string;
  estadoEscaneo: 'pendiente' | 'limpio' | 'infectado';
  creadoEn: string;
};

export type SubirArchivoResponseDto = {
  archivo: FileResponseDto;
  advertencia?: string;
};

// ===== Tipos notificaciones (Iteración 3) — DTOs reales del contrato =====

export type NotificacionDto = {
  id: string;
  evento: string;
  canal: 'app' | 'email';
  asunto?: string | null;
  cuerpo?: string | null;
  payload: Record<string, unknown>;
  estado: 'pendiente' | 'enviada' | 'leida' | 'fallida';
  leidaEn: string | null;
  creadoEn: string;
};

export type NotificacionListResponseDto = {
  items: NotificacionDto[];
  total: number;
  limit: number;
  offset: number;
};

export type PreferenciaNotificacionDto = {
  evento: string;
  canal: 'app' | 'email';
  habilitado: boolean;
};

export type PreferencesResponseDto = {
  preferencias: PreferenciaNotificacionDto[];
  criticos: string[];
};

export type ActualizarPreferenciaDto = {
  evento: string;
  canal: 'app' | 'email';
  habilitado: boolean;
};

export type MarkReadResponseDto = {
  id: string;
  leida: boolean;
};

// ===== Tipos exportaciones (Iteración 3) — DTOs reales del contrato =====

export type ExportacionDto = {
  archivoId: string;
  nombre: string;
  mime: string;
  tamano: number;
  formato: 'pdf' | 'xlsx' | 'csv';
  hashSha256: string;
  descargaUrl: string;
};

export type CrearExportacionDto = {
  plantilla: string;
  formato: 'pdf' | 'xlsx' | 'csv';
  parametros: Record<string, unknown>;
};

// ===== Tipos académicos (Iteración 4) — DTOs reales del contrato =====

export type ProgramaDto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  area: 'danza' | 'musica' | 'teatro' | 'artes_plasticas';
  cupoMaximo: number;
  estado: 'borrador' | 'publicado' | 'archivado';
  creadoEn: string;
};

export type PaginatedProgramasDto = {
  page: number;
  pageSize: number;
  total: number;
  data: ProgramaDto[];
};

export type CrearProgramaDto = {
  nombre: string;
  descripcion?: string | null;
  area: 'danza' | 'musica' | 'teatro' | 'artes_plasticas';
  cupoMaximo: number;
};

export type GrupoDto = {
  id: string;
  programaId: string;
  codigo: string;
  educadorId: string;
  salon: string | null;
  periodo: string;
  cupoMaximo: number;
  estado: 'abierto' | 'cerrado';
  creadoEn: string;
};

export type PaginatedGruposDto = {
  page: number;
  pageSize: number;
  total: number;
  data: GrupoDto[];
};

export type CrearGrupoDto = {
  programaId: string;
  codigo: string;
  educadorId: string;
  salon?: string | null;
  periodo: string;
  cupoMaximo: number;
};

export type EstudianteDto = {
  id: string;
  usuarioId: string | null;
  tipoDocumento: string;
  nombres: string;
  apellidos: string;
  municipio: string | null;
  barrio: string | null;
  consentimientoAceptado: boolean;
  creadoEn: string;
  numeroDocumento: string;
  fechaNacimiento: string | null;
  direccion: string | null;
  telefono: string | null;
  consentimientoDatos: Record<string, unknown>;
  actualizadoEn: string;
};

export type EstudianteSummaryDto = {
  id: string;
  usuarioId: string | null;
  tipoDocumento: string;
  nombres: string;
  apellidos: string;
  municipio: string | null;
  barrio: string | null;
  consentimientoAceptado: boolean;
  creadoEn: string;
};

export type PaginatedEstudiantesDto = {
  page: number;
  pageSize: number;
  total: number;
  data: EstudianteSummaryDto[];
};

export type CrearEstudianteDto = {
  usuarioId?: string | null;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento?: string | null;
  municipio?: string | null;
  barrio?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  consentimientoDatos: Record<string, unknown>;
};

export type MatriculaDto = {
  id: string;
  estudianteId: string;
  estudianteNombres: string;
  estudianteApellidos: string;
  grupoId: string;
  grupoCodigo: string;
  programaId: string;
  programaNombre: string;
  periodo: string;
  estado: 'preinscrita' | 'confirmada' | 'activa' | 'finalizada' | 'cancelada' | 'retirada';
  fechaMatricula: string;
};

export type PaginatedMatriculasDto = {
  page: number;
  pageSize: number;
  total: number;
  data: MatriculaDto[];
};

export type CrearMatriculaDto = {
  estudianteId: string;
  grupoId: string;
  periodo?: string | null;
};

export type SesionHorarioDto = {
  id: string;
  grupoId: string;
  grupoCodigo: string | null;
  programaNombre: string | null;
  salon: string | null;
  periodo: string | null;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
};

export type ScheduleResponseDto = {
  items: SesionHorarioDto[];
};

export type SesionDto = {
  id: string;
  grupoId: string;
  fecha: string;
  tema: string | null;
  estado: 'programada' | 'realizada' | 'cancelada';
  creadoEn: string;
};

export type PaginatedSesionesDto = {
  page: number;
  pageSize: number;
  total: number;
  data: SesionDto[];
};

export type CrearSesionDto = {
  grupoId: string;
  fecha: string;
  tema?: string | null;
};

export type RegistroAsistenciaDto = {
  matriculaId: string;
  estado: 'presente' | 'ausente' | 'tarde' | 'excusa';
};

export type AsistenciaListResponseDto = {
  registros: Array<{
    id: string;
    sesionId: string;
    matriculaId: string;
    estado: 'presente' | 'ausente' | 'tarde' | 'excusa';
    registradoEn: string;
  }>;
  total: number;
};

export type EvaluacionDto = {
  id: string;
  matriculaId: string;
  indicadorId: string;
  indicadorNombre: string;
  periodo: string;
  valor: 'excelente' | 'bueno' | 'regular' | 'deficiente';
  observacion: string | null;
  evaluadoEn: string;
};

export type MyEvaluacionDto = EvaluacionDto & {
  grupoCodigo: string;
  programaNombre: string;
};

export type PaginatedEvaluacionesDto = {
  page: number;
  pageSize: number;
  total: number;
  data: EvaluacionDto[];
};

export type CrearEvaluacionDto = {
  matriculaId: string;
  indicadorId: string;
  periodo: string;
  valor: 'excelente' | 'bueno' | 'regular' | 'deficiente';
  observacion?: string | null;
};

// ===== Tipos analytics (Iteración 6) =====

export type KpiBreakdownItemDto = {
  clave: string;
  total: number;
};

export type KpiResultDto = {
  code:
    | 'matricula_activa'
    | 'asistencia'
    | 'evaluacion'
    | 'programas'
    | 'desercion'
    | 'distribucion_geografica';
  nombre: string;
  valor: number | null;
  unidad: 'conteo' | 'porcentaje' | 'distribucion';
  desglose: KpiBreakdownItemDto[];
  calculadoEn: string;
};

export type KpisResponseDto = {
  kpis: KpiResultDto[];
};

// ===== Tipos reportes (Iteración 6) =====

export type ReportColumnDto = {
  nombre: string;
  tipo: string;
};

export type ReportCatalogItemDto = {
  code: 'asistencia' | 'desempeno' | 'matricula' | 'desercion';
  nombre: string;
  descripcion: string;
  formatos: Array<'pdf' | 'xlsx' | 'csv'>;
  columnas: ReportColumnDto[];
};

export type ReportCatalogResponseDto = {
  items: ReportCatalogItemDto[];
};

// ===== Tipos health y error =====

export type ReadinessReport = {
  status: 'ok' | 'unavailable';
  checks: Record<string, { status: 'up' | 'down'; latencyMs: number }>;
  checkedAt: string;
};

export type ProblemDetails = ProblemDetailsDto;

// ===== Paths del contrato OpenAPI actual =====

export type Paths = {
  // --- Auth ---
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

  // --- Me ---
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
            'application/json': PaginatedMatriculasDto;
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
            'application/json': ScheduleResponseDto;
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
            'application/json': PaginatedEvaluacionesDto;
          };
        };
      };
    };
  };

  // --- Health ---
  '/health/live': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': { status: string };
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

  // --- Archivos ---
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

  // --- Notificaciones ---
  '/notifications': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': NotificacionListResponseDto;
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
          'application/json': { leida: boolean };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': MarkReadResponseDto;
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
            'application/json': PreferencesResponseDto;
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
            'application/json': PreferencesResponseDto;
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

  // --- Exportaciones ---
  '/exports': {
    post: {
      requestBody: {
        content: {
          'application/json': CrearExportacionDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': ExportacionDto;
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

  // --- Académico: Programas ---
  '/academic/programs': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': PaginatedProgramasDto;
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
            to: 'publicado' | 'archivado';
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

  // --- Académico: Grupos ---
  '/academic/groups': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': PaginatedGruposDto;
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
  '/academic/groups/{groupId}/sessions': {
    get: {
      parameters: {
        path: { groupId: string };
      };
      responses: {
        200: {
          content: {
            'application/json': PaginatedSesionesDto;
          };
        };
      };
    };
  };
  '/academic/groups/{id}/schedule': {
    get: {
      parameters: {
        path: { id: string };
      };
      responses: {
        200: {
          content: {
            'application/json': ScheduleResponseDto;
          };
        };
      };
    };
  };

  // --- Académico: Estudiantes ---
  '/academic/students': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': PaginatedEstudiantesDto;
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
  '/academic/students/{id}': {
    get: {
      parameters: {
        path: { id: string };
      };
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

  // --- Académico: Matrículas ---
  '/academic/enrollments': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': PaginatedMatriculasDto;
          };
        };
      };
    };
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

  // --- Académico: Sesiones ---
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
  '/academic/sessions/{id}': {
    get: {
      parameters: {
        path: { id: string };
      };
      responses: {
        200: {
          content: {
            'application/json': SesionDto;
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
  '/academic/sessions/{sessionId}/attendance': {
    get: {
      parameters: {
        path: { sessionId: string };
      };
      responses: {
        200: {
          content: {
            'application/json': AsistenciaListResponseDto;
          };
        };
      };
    };
    put: {
      parameters: {
        path: { sessionId: string };
      };
      requestBody: {
        content: {
          'application/json': {
            registros: RegistroAsistenciaDto[];
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

  // --- Académico: Evaluaciones ---
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
    get: {
      responses: {
        200: {
          content: {
            'application/json': PaginatedEvaluacionesDto;
          };
        };
      };
    };
  };

  // --- Analytics ---
  '/analytics/kpis': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': KpisResponseDto;
          };
        };
      };
    };
  };

  // --- Reportes ---
  '/reports/catalog': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': ReportCatalogResponseDto;
          };
        };
      };
    };
  };
  '/reports/{code}/generate': {
    post: {
      parameters: {
        path: { code: string };
      };
      responses: {
        201: {
          content: {
            'application/json': ExportacionDto;
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
};

// ===== Cliente =====

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

// Credenciales de la sesión en memoria (ADR-0002): nunca localStorage.
// El refresh viaja en cookie httpOnly; el CSRF se replica como cabecera.
// El token *parcial* NO se usa como Bearer: los flujos de MFA lo leen del cuerpo
// y el guard prioriza la cabecera, así que enviarlo en ambas posiciones los rompe.
let bearerToken: string | null = null;
let csrfToken: string | null = null;

export function setSessionCredentials(
  credentials: {
    accessToken?: string;
    csrfToken?: string;
  } | null,
): void {
  bearerToken = credentials?.accessToken ?? null;
  csrfToken = credentials?.csrfToken ?? null;
}

export const apiClient = createClient<Paths>({
  baseUrl: API_BASE_URL,
  credentials: 'include',
});

apiClient.use({
  onRequest({ request }) {
    if (bearerToken) {
      request.headers.set('Authorization', `Bearer ${bearerToken}`);
    }
    if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
      request.headers.set('x-csrf-token', csrfToken);
    }
    return request;
  },
});
