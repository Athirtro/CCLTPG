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

// ===== Identidad administrativa (OP-06…OP-10) =====

export type UserEstado = 'activo' | 'inactivo' | 'bloqueado';

export type AdminUserDto = {
  id: string;
  email: string;
  nombre: string;
  estado: UserEstado;
  mfaHabilitado: boolean;
  debeCambiarPassword: boolean;
  creadoEn: string;
  actualizadoEn: string;
};

export type ListUsersResponseDto = {
  items: AdminUserDto[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateUserProfileDto = {
  codigo: string;
  validUntil?: string;
};

export type CreateUserDto = {
  email: string;
  nombre: string;
  password: string;
  estado?: UserEstado;
  profiles: CreateUserProfileDto[];
};

export type UpdateUserDto = {
  nombre?: string;
  password?: string;
  resetMfa?: boolean;
};

export type TransitionDto = {
  to: UserEstado;
  motivo?: string;
};

export type AssignProfileDto = {
  codigo: string;
  validUntil?: string;
};

export type AssignProfileResponseDto = {
  ok: boolean;
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

export type ScheduleSlotDto = {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
};

export type ReplaceScheduleDto = {
  franjas: ScheduleSlotDto[];
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

/** `/me/evaluations` devuelve la lista plana, no una página. */
export type MyEvaluacionesResponseDto = MyEvaluacionDto[];

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
  key: string;
  label: string;
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

// ===== Tipos emisora R.A.C. (E2) — DTOs reales del contrato =====

export type EmisoraConvocatoriaEstado = 'borrador' | 'abierta' | 'cerrada';
export type EmisoraRejillaEstado = 'borrador' | 'aprobada';
export type EmisoraProgramacionEstado = 'borrador' | 'aprobada';
export type EmisoraGrabacionEstado = 'programada' | 'realizada' | 'aprobada' | 'cancelada';
export type EmisoraIncentivoEstado = 'calificado' | 'asignado' | 'resuelto' | 'solicitud_cdp';
export type EmisoraFranjaTipo = 'programa' | 'promo' | 'mencion' | 'espacio';
export type EmisoraAudioTipo = 'programa' | 'entrevista' | 'promo' | 'cotidiano';
export type EmisoraAsistenciaEstado = 'presente' | 'ausente' | 'tarde' | 'excusa';

export type CreateEmisoraConvocatoriaDto = {
  anio: number;
  fechaApertura: string;
  basesArchivoId?: string;
};

export type EmisoraRealizadorDto = {
  usuarioId?: string;
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  contacto?: string;
  municipio?: string;
  fechaNacimiento?: string;
  consentimientoAceptado: boolean;
};

export type CreateEmisoraProyectoDto = {
  convocatoriaId: string;
  titulo: string;
  archivoId: string;
  fechaRecepcion: string;
  observaciones?: string;
  programaId?: string;
  formadorId?: string;
  realizador: EmisoraRealizadorDto;
};

export type NotifyEmisoraRealizadorDto = {
  contacto?: string;
  municipio?: string;
};

export type CreateEmisoraComiteDto = {
  convocatoriaId: string;
  fecha: string;
  actaArchivoId: string;
  integrantes: string[];
  conclusiones?: string;
};

export type EmisoraRejillaTransitionDto = {
  to: EmisoraRejillaEstado;
};

export type CreateEmisoraInformeDto = {
  proyectoId: string;
  fechaInforme: string;
  archivoId: string;
  observaciones?: string;
};

export type UpdateEmisoraIncentivoDto = {
  to: EmisoraIncentivoEstado;
  calificacion?: number;
  referenciaCdp?: string;
};

export type EmisoraProgramacionItemDto = {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipo: EmisoraFranjaTipo;
  programaId?: string;
  titulo: string;
};

export type CreateEmisoraProgramacionDto = {
  rejillaAnualId: string;
  fecha: string;
  items: EmisoraProgramacionItemDto[];
};

export type EmisoraProgramacionTransitionDto = {
  to: EmisoraProgramacionEstado;
};

export type CreateEmisoraGrabacionDto = {
  programacionItemId?: string;
  fecha: string;
  responsableId?: string;
};

export type EmisoraGrabacionTransitionDto = {
  to: EmisoraGrabacionEstado;
};

export type EmisoraAsistenciaEntryDto = {
  usuarioId: string;
  estado: EmisoraAsistenciaEstado;
};

export type RegistrarEmisoraAsistenciaDto = {
  entries: EmisoraAsistenciaEntryDto[];
};

export type EmisoraConvocatoriaView = {
  id: string;
  anio: number;
  fechaApertura: string;
  fechaCierre: string;
  estado: EmisoraConvocatoriaEstado;
};

export type EmisoraRejillaItemView = {
  id: string;
  rejillaAnualId: string;
  fecha: string | null;
  diaSemana: number | null;
  horaInicio: string;
  horaFin: string;
  tipo: EmisoraFranjaTipo;
  programaId: string | null;
  nombre: string;
};

export type EmisoraRejillaView = {
  id: string;
  anio: number;
  estado: EmisoraRejillaEstado;
  aprobadaEn: string | null;
  items: EmisoraRejillaItemView[];
};

export type EmisoraProgramacionItemView = {
  id: string;
  programacionDiariaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipo: EmisoraFranjaTipo;
  programaId: string | null;
  titulo: string;
};

export type EmisoraProgramacionView = {
  id: string;
  rejillaAnualId: string;
  fecha: string;
  estado: EmisoraProgramacionEstado;
  concuerda: boolean | null;
  desviaciones: string[];
  items: EmisoraProgramacionItemView[];
};

export type EmisoraGrabacionView = {
  id: string;
  programacionItemId: string | null;
  fecha: string;
  estado: EmisoraGrabacionEstado;
  responsableId: string | null;
};

export type EmisoraAsistenciaView = {
  sesionId: string;
  usuarioId: string;
  estado: EmisoraAsistenciaEstado;
  registradoEn: string;
};

export type EmisoraAudioView = {
  id: string;
  sesionGrabacionId: string;
  tipo: EmisoraAudioTipo;
  duracionSegundos: number;
  fecha: string;
  archivoId: string;
  hashSha256: string | null;
  archivo: {
    nombreOriginal: string;
    mime: string;
    tamano: number;
    estadoEscaneo: string;
  };
};

export type EmisoraIncentivoView = {
  id: string;
  informeId: string;
  realizadorId: string;
  estado: EmisoraIncentivoEstado;
  calificacion: number | null;
  referenciaCdp: string | null;
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
            sessionToken?: string;
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
      requestBody: {
        content: {
          'application/json': {
            sessionToken?: string;
          };
        };
      };
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
      parameters?: {
        query?: {
          page?: number;
          pageSize?: number;
        };
      };

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
            'application/json': MyEvaluacionesResponseDto;
          };
        };
      };
    };
  };

  // --- Identidad: administración de usuarios (OP-06…OP-10) ---
  '/identity/users': {
    get: {
      parameters?: {
        query?: {
          search?: string;
          estado?: UserEstado;
          limit?: number;
          offset?: number;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': ListUsersResponseDto;
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
    post: {
      requestBody: {
        content: {
          'application/json': CreateUserDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': AdminUserDto;
          };
        };
        403: {
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
  '/identity/users/{id}': {
    patch: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': UpdateUserDto;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': AdminUserDto;
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
  '/identity/users/{id}/transitions': {
    post: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': TransitionDto;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': AdminUserDto;
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
  '/identity/users/{id}/profiles': {
    post: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': AssignProfileDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': AssignProfileResponseDto;
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
      parameters?: {
        query?: {
          soloNoLeidas?: boolean;
          limit?: number;
          offset?: number;
        };
      };

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
          'application/json': { preferencias: ActualizarPreferenciaDto[] };
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
      parameters?: {
        query?: {
          page?: number;
          pageSize?: number;
        };
      };

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
      parameters?: {
        query?: {
          page?: number;
          pageSize?: number;
        };
      };

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
        query?: {
          page?: number;
          pageSize?: number;
        };
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
    put: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': ReplaceScheduleDto;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': ScheduleResponseDto;
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
      };
    };
  };

  // --- Académico: Estudiantes ---
  '/academic/students': {
    get: {
      parameters?: {
        query?: {
          page?: number;
          pageSize?: number;
        };
      };

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

  // --- Académico: Matrículas ---
  '/academic/enrollments': {
    get: {
      parameters?: {
        query?: {
          page?: number;
          pageSize?: number;
        };
      };

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
      parameters?: {
        query?: {
          page?: number;
          pageSize?: number;
        };
      };

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
      parameters?: {
        query?: {
          periodo: string;
          programaId?: string;
          grupoId?: string;
          kpi?: string;
        };
      };
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
      requestBody: {
        content: {
          'application/json': {
            periodo: string;
            formato: 'pdf' | 'xlsx' | 'csv';
            programaId?: string;
            grupoId?: string;
          };
        };
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
  // --- Emisora R.A.C. (E2) ---
  '/emisora/convocatorias': {
    post: {
      requestBody: {
        content: {
          'application/json': CreateEmisoraConvocatoriaDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': EmisoraConvocatoriaView;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        403: {
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
            'application/json': EmisoraConvocatoriaView[];
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
  '/emisora/proyectos': {
    post: {
      requestBody: {
        content: {
          'application/json': CreateEmisoraProyectoDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': { id: string; titulo: string; estado: string };
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        403: {
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
  '/emisora/realizadores/{id}': {
    patch: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': NotifyEmisoraRealizadorDto;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': { id: string; municipio: string | null };
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
  '/emisora/comites': {
    post: {
      requestBody: {
        content: {
          'application/json': CreateEmisoraComiteDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': { id: string; convocatoriaId: string };
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
  '/emisora/rejilla-anual': {
    get: {
      parameters: {
        query: { anio: number };
      };
      responses: {
        200: {
          content: {
            'application/json': EmisoraRejillaView | null;
          };
        };
        400: {
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
  '/emisora/rejilla-anual/{id}/transitions': {
    patch: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': EmisoraRejillaTransitionDto;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': EmisoraRejillaView;
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
  '/emisora/informes': {
    post: {
      requestBody: {
        content: {
          'application/json': CreateEmisoraInformeDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': { id: string; proyectoId: string; estado: string };
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
  '/emisora/incentivos': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': EmisoraIncentivoView[];
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
  '/emisora/incentivos/{id}': {
    patch: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': UpdateEmisoraIncentivoDto;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': EmisoraIncentivoView;
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
  '/emisora/programacion-diaria': {
    post: {
      requestBody: {
        content: {
          'application/json': CreateEmisoraProgramacionDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': EmisoraProgramacionView;
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
      parameters: {
        query: { fecha: string };
      };
      responses: {
        200: {
          content: {
            'application/json': EmisoraProgramacionView | null;
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
  '/emisora/programacion-diaria/{id}/transitions': {
    post: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': EmisoraProgramacionTransitionDto;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': EmisoraProgramacionView;
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
  '/emisora/grabaciones': {
    post: {
      requestBody: {
        content: {
          'application/json': CreateEmisoraGrabacionDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': EmisoraGrabacionView;
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
            'application/json': EmisoraGrabacionView[];
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
  '/emisora/grabaciones/{id}/asistencia-cabina': {
    put: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': RegistrarEmisoraAsistenciaDto;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': EmisoraAsistenciaView[];
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
  '/emisora/grabaciones/{id}/transitions': {
    post: {
      parameters: {
        path: { id: string };
      };
      requestBody: {
        content: {
          'application/json': EmisoraGrabacionTransitionDto;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': EmisoraGrabacionView;
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
  '/emisora/audios': {
    post: {
      requestBody: {
        content: {
          'multipart/form-data': FormData;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': EmisoraAudioView;
          };
        };
        400: {
          content: {
            'application/json': ProblemDetailsDto;
          };
        };
        413: {
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
      parameters: {
        query: { sesionId?: string };
      };
      responses: {
        200: {
          content: {
            'application/json': EmisoraAudioView[];
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
};

// ===== Cliente =====

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

// Credenciales de la sesión en memoria (ADR-0002): nunca localStorage.
// El refresh viaja en cookie httpOnly; el CSRF se replica como cabecera.
// El token *parcial* NO se usa como Bearer: los flujos de MFA lo leen del cuerpo
// y el guard prioriza la cabecera, así que enviarlo en ambas posiciones los rompe.
let bearerToken: string | null = null;
let csrfToken: string | null = null;

/**
 * Marca legible por JS de que este navegador inició una sesión completa.
 * No es credencial: solo evita llamar a `/auth/refresh` cuando no hay sesión
 * (la cookie httpOnly de refresh no se puede inspeccionar desde el cliente).
 */
const SESSION_MARKER = 'ccltpg_session';
const SESSION_MARKER_MAX_AGE = 604_800; // REFRESH_TOKEN_TTL_SECONDS por defecto.

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  const value = entry.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

function setSessionMarker(): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_MARKER}=1; Path=/; Max-Age=${SESSION_MARKER_MAX_AGE}; SameSite=Strict${secure}`;
}

function clearSessionMarker(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_MARKER}=; Path=/; Max-Age=0; SameSite=Strict`;
}

export function hasSessionMarker(): boolean {
  return readCookie(SESSION_MARKER) === '1';
}

export function setSessionCredentials(
  credentials: {
    accessToken?: string;
    csrfToken?: string;
  } | null,
): void {
  bearerToken = credentials?.accessToken ?? null;
  csrfToken = credentials?.csrfToken ?? null;
  if (credentials?.accessToken) setSessionMarker();
  else clearSessionMarker();
}

/**
 * Prepara la cabecera CSRF del refresh sin tocar el marcador: así se conserva
 * hasta que sepamos si la sesión sigue siendo válida.
 */
export function setSessionCsrf(csrf: string | null): void {
  csrfToken = csrf;
}

/**
 * El CSRF viaja en cookie legible por JS (doble envío). Junto con el marcador
 * de sesión, indica si vale la pena intentar `/auth/refresh`; si falta alguno,
 * el cliente no llama al backend y no produce 401 al cargar.
 */
export function getCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('__Host-ccltpg_csrf='));
  if (!entry) return null;
  const value = entry.slice('__Host-ccltpg_csrf='.length);
  return value ? decodeURIComponent(value) : null;
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
