import type { Generated } from 'kysely';

/**
 * Tipos de las tablas del esquema `public` (C2–C3).
 *
 * Se declaran a mano junto a las migraciones porque Kysely no genera tipos en
 * este proyecto (D28 code-first). Cualquier cambio de migración debe reflejarse
 * aquí; la prueba de integración de migraciones actúa como red de seguridad.
 */

export type UsuarioEstado = 'activo' | 'inactivo' | 'bloqueado';

export interface UsuarioTable {
  id: string;
  email: string;
  password_hash: string;
  nombre: string;
  estado: UsuarioEstado;
  mfa_habilitado: boolean;
  mfa_secret_cifrado: string | null;
  debe_cambiar_password: Generated<boolean>;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface PerfilTable {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

export interface PermisoTable {
  id: string;
  codigo: string;
  descripcion: string | null;
}

export interface PerfilPermisoTable {
  perfil_id: string;
  permiso_id: string;
}

export interface UsuarioPerfilTable {
  id: string;
  usuario_id: string;
  perfil_id: string;
  valid_until: Date | null;
  asignado_por: string | null;
  creado_en: Generated<Date>;
}

export interface RefreshTokenTable {
  id: string;
  usuario_id: string;
  token_hash: string;
  familia_id: string;
  expira_en: Date;
  revocado_en: Date | null;
  reemplazado_por: string | null;
  ip: string | null;
  user_agent: string | null;
}

export interface CodigoRecuperacionMfaTable {
  id: string;
  usuario_id: string;
  codigo_hash: string;
  usado_en: Date | null;
  creado_en: Generated<Date>;
}

export interface EventoAuditoriaTable {
  id: string;
  actor_id: string | null;
  actor_perfil: string | null;
  ip: string | null;
  dispositivo: string | null;
  recurso: string;
  recurso_id: string | null;
  accion: string;
  datos_antes: unknown;
  datos_despues: unknown;
  ocurrido_en: Generated<Date>;
  request_id: string | null;
}

export type ArchivoEstadoEscaneo = 'pendiente' | 'limpio' | 'infectado';

export interface ArchivoTable {
  id: string;
  nombre_original: string;
  mime: string;
  tamano: number;
  hash_sha256: string;
  ruta_objeto: string;
  subido_por: string;
  estado_escaneo: Generated<ArchivoEstadoEscaneo>;
  creado_en: Generated<Date>;
}

export type NotificacionCanal = 'app' | 'email';
export type NotificacionEstado = 'pendiente' | 'enviada' | 'leida' | 'fallida';

export interface PlantillaNotificacionTable {
  id: string;
  codigo: string;
  canal: NotificacionCanal;
  asunto: string;
  cuerpo: string;
  version: Generated<number>;
  creado_en: Generated<Date>;
}

export interface NotificacionTable {
  id: string;
  usuario_id: string;
  evento: string;
  evento_id: string | null;
  canal: NotificacionCanal;
  plantilla_id: string | null;
  payload: unknown;
  estado: Generated<NotificacionEstado>;
  leida_en: Date | null;
  enviada_en: Date | null;
  creado_en: Generated<Date>;
}

export interface PreferenciaNotificacionTable {
  id: string;
  usuario_id: string;
  evento: string;
  canal: NotificacionCanal;
  habilitado: Generated<boolean>;
  actualizado_en: Generated<Date>;
}

export type IdempotencyEstado = 'en_proceso' | 'completada';

export interface IdempotencyKeyTable {
  id: string;
  usuario_id: string;
  operacion: string;
  clave: string;
  hash_solicitud: string;
  estado: Generated<IdempotencyEstado>;
  respuesta_status: number | null;
  respuesta_cuerpo: unknown;
  creado_en: Generated<Date>;
  expira_en: Date;
}

export type OutboxEstado = 'pendiente' | 'procesando' | 'procesada' | 'fallida';

export interface EventoOutboxTable {
  id: string;
  agregado: string;
  tipo: string;
  payload: unknown;
  estado: Generated<OutboxEstado>;
  intentos: Generated<number>;
  disponible_en: Generated<Date>;
  creado_en: Generated<Date>;
  procesado_en: Date | null;
  ultimo_error: string | null;
}

export type ProgramaArea = 'danza' | 'musica' | 'teatro' | 'artes_plasticas';
export type ProgramaEstado = 'borrador' | 'publicado' | 'archivado';
export type GrupoEstado = 'abierto' | 'cerrado';
export type MatriculaEstado =
  'preinscrita' | 'confirmada' | 'activa' | 'finalizada' | 'cancelada' | 'retirada';
export type SesionEstado = 'programada' | 'realizada' | 'cancelada';
export type AsistenciaEstado = 'presente' | 'ausente' | 'tarde' | 'excusa';
export type EvaluacionValor = 'excelente' | 'bueno' | 'regular' | 'deficiente';

export interface ProgramaFormativoTable {
  id: string;
  nombre: string;
  descripcion: string | null;
  area: ProgramaArea;
  cupo_maximo: number;
  estado: Generated<ProgramaEstado>;
  creado_en: Generated<Date>;
}

export interface GrupoTable {
  id: string;
  programa_id: string;
  codigo: string;
  educador_id: string;
  salon: string | null;
  periodo: string;
  cupo_maximo: number;
  estado: Generated<GrupoEstado>;
  creado_en: Generated<Date>;
}

export interface HorarioGrupoTable {
  id: string;
  grupo_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface EstudianteTable {
  id: string;
  usuario_id: string | null;
  tipo_documento: string;
  numero_documento: string;
  numero_documento_hash: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: Date | null;
  municipio: string | null;
  barrio: string | null;
  direccion: string | null;
  telefono: string | null;
  acudiente: unknown;
  consentimiento_datos: unknown;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface MatriculaTable {
  id: string;
  estudiante_id: string;
  grupo_id: string;
  estado: Generated<MatriculaEstado>;
  fecha_matricula: Generated<Date>;
  periodo: string;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface SesionClaseTable {
  id: string;
  grupo_id: string;
  fecha: Date;
  tema: string | null;
  estado: Generated<SesionEstado>;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface AsistenciaTable {
  id: string;
  sesion_id: string;
  matricula_id: string;
  estado: AsistenciaEstado;
  registrado_por: string;
  registrado_en: Generated<Date>;
}

export interface IndicadorEvaluacionTable {
  id: string;
  programa_id: string | null;
  nombre: string;
  descripcion: string | null;
  escala: Generated<string>;
  creado_en: Generated<Date>;
}

export interface EvaluacionCualitativaTable {
  id: string;
  matricula_id: string;
  indicador_id: string;
  periodo: string;
  valor: EvaluacionValor;
  observacion: string | null;
  evaluado_por: string;
  evaluado_en: Generated<Date>;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

/**
 * Tipos del esquema `emisora` (E1). Se declaran a mano, como el resto del
 * modelo code-first (D28), y reproducen exactamente las columnas de las cuatro
 * migraciones de `apps/api/src/database/migrations/emisora/`.
 */
export type ConvocatoriaEstado = 'borrador' | 'abierta' | 'cerrada';
export type ProyectoEstado = 'recibido' | 'en_revision' | 'aprobado' | 'rechazado';
export type RejillaEstado = 'borrador' | 'aprobada';
export type FranjaTipo = 'programa' | 'promo' | 'mencion' | 'espacio';
export type ProgramacionEstado = 'borrador' | 'aprobada';
export type EmisoraAsistenciaEstado = 'presente' | 'ausente' | 'tarde' | 'excusa';
export type GrabacionEstado = 'programada' | 'realizada' | 'aprobada' | 'cancelada';
export type AudioTipo = 'programa' | 'entrevista' | 'promo' | 'cotidiano';
export type InformeEstado = 'recibido' | 'evaluado';
export type IncentivoEstado = 'calificado' | 'asignado' | 'resuelto' | 'solicitud_cdp';
export type PatrocinioEstado = 'propuesto' | 'aprobado' | 'rechazado';
export type PromoEstado = 'borrador' | 'producida';
export type OrdenEmisionEstado = 'borrador' | 'programada' | 'emitida';
export type PublicacionEstado = 'programada' | 'publicada';
export type TransmisionEstado = 'programada' | 'autorizada' | 'realizada' | 'cancelada';
export type PrestamoEstado = 'solicitado' | 'autorizado' | 'entregado' | 'devuelto' | 'rechazado';
export type ViaticoEstado = 'solicitado' | 'resuelto' | 'comprometido' | 'orden_generada';
export type TurnoEstado = 'planificado' | 'confirmado' | 'realizado';
export type EntidadReporte = 'sayco' | 'acinpro';
export type PeriodicidadReporte = 'mensual' | 'trimestral' | 'semestral' | 'anual';
export type PagoEstado = 'registrado' | 'en_tramite';
export type EquipoEstado = 'disponible' | 'en_uso' | 'mantenimiento' | 'baja';
export type ActualizacionEstado = 'solicitada' | 'aprobada' | 'rechazada' | 'implementada';
export type ProyeccionEstado = 'borrador' | 'aprobada';
export type InversionEstado = 'proyectada' | 'aprobada' | 'en_seguimiento' | 'cerrada';
export type AsignacionEstado = 'asignado' | 'devuelto';
export type PermisoEstado = 'solicitado' | 'emitido' | 'negado';
export type TramiteDestino = 'gobierno' | 'hacienda' | 'saia' | 'secretaria_tic' | 'otro';
export type TramiteEstado = 'radicado' | 'en_tramite' | 'respondido' | 'archivado';
export type PlanillaEstado = 'borrador' | 'registrada';
export type ArchivoEmisoraTipo = 'audio' | 'documento' | 'imagen' | 'acta' | 'formato';

export interface EmisoraConvocatoriaTable {
  id: string;
  anio: number;
  fecha_apertura: Date;
  fecha_cierre: Date;
  estado: Generated<ConvocatoriaEstado>;
  bases_archivo_id: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmisoraRealizadorTable {
  id: string;
  usuario_id: string | null;
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  numero_documento_cifrado: string;
  numero_documento_hash: string;
  contacto_cifrado: string | null;
  consentimiento_datos: unknown;
  municipio: string | null;
  fecha_nacimiento: Date | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmisoraProyectoProgramaTable {
  id: string;
  convocatoria_id: string;
  realizador_id: string;
  programa_id: string | null;
  formador_id: string | null;
  titulo: string;
  archivo_id: string;
  fecha_recepcion: Date;
  estado: Generated<ProyectoEstado>;
  observaciones: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmisoraComiteTable {
  id: string;
  convocatoria_id: string;
  fecha: Date;
  acta_archivo_id: string | null;
  integrantes: unknown;
  conclusiones: string | null;
  creado_en: Generated<Date>;
}

export interface EmisoraRejillaAnualTable {
  id: string;
  anio: number;
  comite_id: string | null;
  estado: Generated<RejillaEstado>;
  aprobada_en: Date | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface EmisoraRejillaAnualItemTable {
  id: string;
  rejilla_anual_id: string;
  fecha: Date | null;
  dia_semana: number | null;
  hora_inicio: string;
  hora_fin: string;
  tipo: Generated<FranjaTipo>;
  programa_id: string | null;
  nombre: string;
  creado_en: Generated<Date>;
}

export interface EmisoraProgramacionDiariaTable {
  id: string;
  rejilla_anual_id: string;
  fecha: Date;
  estado: Generated<ProgramacionEstado>;
  concuerda: boolean | null;
  desviaciones: unknown;
  responsable_id: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface EmisoraProgramacionItemTable {
  id: string;
  programacion_diaria_id: string;
  fecha: Date;
  hora_inicio: string;
  hora_fin: string;
  tipo: Generated<FranjaTipo>;
  programa_id: string | null;
  promo_id: string | null;
  titulo: string;
  creado_en: Generated<Date>;
}

export interface EmisoraSesionGrabacionTable {
  id: string;
  programacion_item_id: string | null;
  fecha: Date;
  estado: Generated<GrabacionEstado>;
  responsable_id: string | null;
  aprobada_por: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface EmisoraAudioTable {
  id: string;
  sesion_grabacion_id: string;
  tipo: AudioTipo;
  duracion_segundos: number;
  fecha: Date;
  responsable_id: string;
  archivo_id: string;
  hash_sha256: string | null;
  creado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmisoraAsistenciaCabinaTable {
  id: string;
  sesion_id: string;
  usuario_id: string;
  estado: Generated<EmisoraAsistenciaEstado>;
  registrado_en: Generated<Date>;
}

export interface EmisoraInformeRealizadorTable {
  id: string;
  proyecto_id: string;
  realizador_id: string;
  fecha_informe: Date;
  estado: Generated<InformeEstado>;
  archivo_id: string;
  calificacion: number | null;
  observaciones: string | null;
  evaluado_por: string | null;
  evaluado_en: Date | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface EmisoraIncentivoTable {
  id: string;
  informe_id: string;
  comite_id: string | null;
  realizador_id: string;
  estado: Generated<IncentivoEstado>;
  calificacion: number | null;
  referencia_cdp: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface EmisoraResolucionIncentivoTable {
  id: string;
  incentivo_id: string;
  pdf_archivo_id: string;
  referencia_cdp: string;
  emitida_en: Generated<Date>;
  creado_en: Generated<Date>;
}

export interface EmisoraPatrocinioTable {
  id: string;
  nombre: string;
  entidad: string;
  estado: Generated<PatrocinioEstado>;
  fecha_inicio: Date | null;
  fecha_fin: Date | null;
  contrato_archivo_id: string | null;
  creado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmisoraPromoTable {
  id: string;
  patrocinio_id: string | null;
  nombre: string;
  guion: string | null;
  duracion_segundos: number;
  audio_archivo_id: string | null;
  estado: Generated<PromoEstado>;
  creado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmisoraOrdenEmisionTable {
  id: string;
  promo_id: string;
  programacion_item_id: string | null;
  estado: Generated<OrdenEmisionEstado>;
  fecha_emision: Date | null;
  emitida_en: Date | null;
  creado_en: Generated<Date>;
}

export interface EmisoraPublicacionTable {
  id: string;
  promo_id: string | null;
  canal: string;
  fecha_publicacion: Date;
  publicada_en: Date | null;
  estado: Generated<PublicacionEstado>;
  archivo_id: string | null;
  creado_en: Generated<Date>;
}

export interface EmisoraTransmisionTable {
  id: string;
  programacion_item_id: string | null;
  fecha_transmision: Date;
  es_fuera_ciudad: Generated<boolean>;
  destino: string | null;
  estado: Generated<TransmisionEstado>;
  autorizada_por: string | null;
  autorizada_en: Date | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface EmisoraSalidaEquipoTable {
  id: string;
  transmision_id: string;
  equipo_id: string;
  responsable_id: string;
  fecha_salida: Generated<Date>;
  fecha_devolucion: Date | null;
  observaciones: string | null;
  creado_en: Generated<Date>;
}

export interface EmisoraReporteDesplazamientoTable {
  id: string;
  transmision_id: string;
  conductor_id: string | null;
  vehiculo: string;
  hora_salida: Date | null;
  hora_llegada: Date | null;
  novedades: string | null;
  creado_en: Generated<Date>;
}

export interface EmisoraPrestamoMifiTable {
  id: string;
  transmision_id: string;
  usuario_id: string;
  fecha_solicitud: Date;
  fecha_transmision: Date;
  estado: Generated<PrestamoEstado>;
  observaciones: string | null;
  creado_en: Generated<Date>;
}

export interface EmisoraViaticoTable {
  id: string;
  transmision_id: string;
  usuario_id: string;
  estado: Generated<ViaticoEstado>;
  referencia_compromiso: string | null;
  referencia_orden: string | null;
  soporte_archivo_id: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface EmisoraTransmisorTable {
  id: string;
  codigo: string;
  nombre: string;
  sede: string;
  frecuencia: string | null;
  activo: Generated<boolean>;
  creado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmisoraTurnoOperadorTable {
  id: string;
  transmisor_id: string;
  operador_id: string;
  fecha: Date;
  hora_inicio: string;
  hora_fin: string;
  estado: Generated<TurnoEstado>;
  creado_en: Generated<Date>;
}

export interface EmisoraLecturaTransmisorTable {
  id: string;
  transmisor_id: string;
  fecha: Date;
  potencia_w: number | null;
  frecuencia: string | null;
  observaciones: string | null;
  registrado_por: string;
  creado_en: Generated<Date>;
}

export interface EmisoraBitacoraSedeTable {
  id: string;
  transmisor_id: string;
  turno_id: string | null;
  fecha: Date;
  incidente: string;
  accion: string | null;
  actor_id: string;
  request_id: string | null;
  ocurrido_en: Generated<Date>;
  creado_en: Generated<Date>;
}

export interface EmisoraParametroReporteTable {
  id: string;
  entidad: EntidadReporte;
  periodicidad: PeriodicidadReporte;
  dia_limite: number;
  activo: Generated<boolean>;
  creado_en: Generated<Date>;
}

export interface EmisoraObraTable {
  id: string;
  titulo: string;
  compositor_autor: string;
  duracion_segundos: number;
  fecha_inclusion: Date;
  archivo_id: string | null;
  creado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmisoraReporteObraTable {
  id: string;
  entidad: EntidadReporte;
  periodo: string;
  fecha_inicio: Date;
  fecha_fin: Date;
  archivo_id: string | null;
  generado_en: Generated<Date>;
  creado_en: Generated<Date>;
}

export interface EmisoraPagoDerechosTable {
  id: string;
  obra_id: string;
  reporte_id: string | null;
  soporte_archivo_id: string;
  referencia: string;
  estado: Generated<PagoEstado>;
  registrado_en: Generated<Date>;
  creado_en: Generated<Date>;
}

export interface EmisoraHojaVidaEquipoTable {
  id: string;
  nombre: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string;
  estado: Generated<EquipoEstado>;
  fecha_adquisicion: Date | null;
  archivo_id: string | null;
  creado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmisoraActualizacionTecnologicaTable {
  id: string;
  equipo_id: string;
  descripcion: string;
  solicitada_por: string | null;
  estado: Generated<ActualizacionEstado>;
  fecha: Date | null;
  soporte_archivo_id: string | null;
  creado_en: Generated<Date>;
}

export interface EmisoraProyeccionAnualTable {
  id: string;
  anio: number;
  equipo_id: string | null;
  descripcion: string;
  estado: Generated<ProyeccionEstado>;
  archivo_id: string | null;
  creado_en: Generated<Date>;
}

export interface EmisoraInversionSeguimientoTable {
  id: string;
  proyeccion_id: string;
  contrato_ref: string | null;
  estado: Generated<InversionEstado>;
  fecha_inicio: Date | null;
  fecha_fin: Date | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface EmisoraVersionSoftwareTable {
  id: string;
  equipo_id: string | null;
  nombre: string;
  version: string;
  fecha_instalacion: Date;
  responsable_id: string | null;
  creado_en: Generated<Date>;
}

export interface EmisoraAsignacionEquipoTable {
  id: string;
  equipo_id: string;
  transmisor_id: string | null;
  usuario_id: string | null;
  fecha_asignacion: Date;
  fecha_devolucion: Date | null;
  estado: Generated<AsignacionEstado>;
  creado_en: Generated<Date>;
}

export interface EmisoraActividadCulturalTable {
  id: string;
  nombre: string;
  fecha: Date;
  lugar: string | null;
  descripcion: string | null;
  responsable_id: string | null;
  publicada: Generated<boolean>;
  archivo_id: string | null;
  creado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface EmisoraPermisoGobiernoTable {
  id: string;
  actividad_id: string;
  oficio_archivo_id: string;
  destino: string | null;
  fecha_emision: Date | null;
  estado: Generated<PermisoEstado>;
  creado_en: Generated<Date>;
}

export interface EmisoraTramiteExternoTable {
  id: string;
  destino: TramiteDestino;
  asunto: string;
  radicado_ref: string | null;
  estado: Generated<TramiteEstado>;
  fecha_radicacion: Date;
  responsable_id: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface EmisoraSoporteTramiteTable {
  id: string;
  tramite_id: string;
  archivo_id: string;
  tipo: string | null;
  descripcion: string | null;
  creado_en: Generated<Date>;
}

export interface EmisoraPlanillaEmisionTable {
  id: string;
  fecha: Date;
  programacion_diaria_id: string | null;
  operador_id: string | null;
  archivo_id: string | null;
  estado: Generated<PlanillaEstado>;
  creado_en: Generated<Date>;
}

export interface EmisoraArchivoEmisoraTable {
  id: string;
  archivo_id: string;
  tipo: ArchivoEmisoraTipo;
  duracion_segundos: number | null;
  fecha: Date;
  responsable_id: string;
  hash_sha256: string | null;
  mime: string | null;
  creado_en: Generated<Date>;
  deleted_at: Date | null;
}

export interface Database {
  usuario: UsuarioTable;
  perfil: PerfilTable;
  permiso: PermisoTable;
  perfil_permiso: PerfilPermisoTable;
  usuario_perfil: UsuarioPerfilTable;
  refresh_token: RefreshTokenTable;
  codigo_recuperacion_mfa: CodigoRecuperacionMfaTable;
  evento_auditoria: EventoAuditoriaTable;
  archivo: ArchivoTable;
  plantilla_notificacion: PlantillaNotificacionTable;
  notificacion: NotificacionTable;
  preferencia_notificacion: PreferenciaNotificacionTable;
  idempotency_key: IdempotencyKeyTable;
  evento_outbox: EventoOutboxTable;
  'academic.programa_formativo': ProgramaFormativoTable;
  'academic.grupo': GrupoTable;
  'academic.horario_grupo': HorarioGrupoTable;
  'academic.estudiante': EstudianteTable;
  'academic.matricula': MatriculaTable;
  'academic.sesion_clase': SesionClaseTable;
  'academic.asistencia': AsistenciaTable;
  'academic.indicador_evaluacion': IndicadorEvaluacionTable;
  'academic.evaluacion_cualitativa': EvaluacionCualitativaTable;
  'emisora.convocatoria': EmisoraConvocatoriaTable;
  'emisora.realizador': EmisoraRealizadorTable;
  'emisora.proyecto_programa': EmisoraProyectoProgramaTable;
  'emisora.comite': EmisoraComiteTable;
  'emisora.rejilla_anual': EmisoraRejillaAnualTable;
  'emisora.rejilla_anual_item': EmisoraRejillaAnualItemTable;
  'emisora.programacion_diaria': EmisoraProgramacionDiariaTable;
  'emisora.programacion_item': EmisoraProgramacionItemTable;
  'emisora.sesion_grabacion': EmisoraSesionGrabacionTable;
  'emisora.audio': EmisoraAudioTable;
  'emisora.asistencia_cabina': EmisoraAsistenciaCabinaTable;
  'emisora.informe_realizador': EmisoraInformeRealizadorTable;
  'emisora.incentivo': EmisoraIncentivoTable;
  'emisora.resolucion_incentivo': EmisoraResolucionIncentivoTable;
  'emisora.patrocinio': EmisoraPatrocinioTable;
  'emisora.orden_emision': EmisoraOrdenEmisionTable;
  'emisora.promo': EmisoraPromoTable;
  'emisora.publicacion': EmisoraPublicacionTable;
  'emisora.transmision': EmisoraTransmisionTable;
  'emisora.salida_equipo': EmisoraSalidaEquipoTable;
  'emisora.reporte_desplazamiento': EmisoraReporteDesplazamientoTable;
  'emisora.prestamo_mifi': EmisoraPrestamoMifiTable;
  'emisora.viatico': EmisoraViaticoTable;
  'emisora.transmisor': EmisoraTransmisorTable;
  'emisora.turno_operador': EmisoraTurnoOperadorTable;
  'emisora.lectura_transmisor': EmisoraLecturaTransmisorTable;
  'emisora.bitacora_sede': EmisoraBitacoraSedeTable;
  'emisora.parametro_reporte': EmisoraParametroReporteTable;
  'emisora.obra': EmisoraObraTable;
  'emisora.reporte_obra': EmisoraReporteObraTable;
  'emisora.pago_derechos': EmisoraPagoDerechosTable;
  'emisora.hoja_vida_equipo': EmisoraHojaVidaEquipoTable;
  'emisora.actualizacion_tecnologica': EmisoraActualizacionTecnologicaTable;
  'emisora.proyeccion_anual': EmisoraProyeccionAnualTable;
  'emisora.inversion_seguimiento': EmisoraInversionSeguimientoTable;
  'emisora.version_software': EmisoraVersionSoftwareTable;
  'emisora.asignacion_equipo': EmisoraAsignacionEquipoTable;
  'emisora.actividad_cultural': EmisoraActividadCulturalTable;
  'emisora.permiso_gobierno': EmisoraPermisoGobiernoTable;
  'emisora.tramite_externo': EmisoraTramiteExternoTable;
  'emisora.soporte_tramite': EmisoraSoporteTramiteTable;
  'emisora.planilla_emision': EmisoraPlanillaEmisionTable;
  'emisora.archivo_emisora': EmisoraArchivoEmisoraTable;
}
