import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  ACTUALIZACION_ESTADOS,
  ARCHIVO_EMISORA_TIPOS,
  ASISTENCIA_ESTADOS,
  AUDIO_TIPOS,
  ENTIDADES_REPORTE,
  EQUIPO_ESTADOS,
  FRANJA_TIPOS,
  GRABACION_ESTADOS,
  INCENTIVO_ESTADOS,
  INVERSION_ESTADOS,
  ORDEN_EMISION_ESTADOS,
  PATROCINIO_ESTADOS,
  PRESTAMO_ESTADOS,
  PROYECCION_ESTADOS,
  PROMO_ESTADOS,
  PROGRAMACION_ESTADOS,
  PUBLICACION_ESTADOS,
  REJILLA_ESTADOS,
  TRAMITE_DESTINOS,
  TRAMITE_ESTADOS,
  TRANSMISION_ESTADOS,
  TURNO_ESTADOS,
  type ActualizacionEstado,
  type ArchivoEmisoraTipo,
  type AsistenciaEstado,
  type AudioTipo,
  type EntidadReporte,
  type EquipoEstado,
  type FranjaTipo,
  type GrabacionEstado,
  type IncentivoEstado,
  type InversionEstado,
  type OrdenEmisionEstado,
  type PatrocinioEstado,
  type PrestamoEstado,
  type ProyeccionEstado,
  type PromoEstado,
  type ProgramacionEstado,
  type PublicacionEstado,
  type RejillaEstado,
  type TramiteDestino,
  type TramiteEstado,
  type TransmisionEstado,
  type TurnoEstado,
} from '../../domain/emisora-states.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/u;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/u;
/* ------------------------------- Convocatoria ---------------------------- */

export class CreateConvocatoriaDto {
  @ApiProperty({ type: Number, description: 'Año de la convocatoria (4 dígitos).', example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio!: number;

  @ApiProperty({
    type: String,
    description: 'Fecha de apertura en enero (YYYY-MM-DD).',
    example: '2026-01-15',
  })
  @Matches(FECHA)
  fechaApertura!: string;

  @ApiPropertyOptional({ type: String, description: 'PDF de las bases, ya cargado en Archivos.' })
  @IsOptional()
  @IsUUID()
  basesArchivoId?: string;
}

export class RealizadorDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Usuario de identidad, si el realizador tiene cuenta.',
  })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @ApiProperty({ type: String, example: 'Ana' })
  @IsString()
  @MinLength(1)
  nombres!: string;

  @ApiProperty({ type: String, example: 'Pérez' })
  @IsString()
  @MinLength(1)
  apellidos!: string;

  @ApiProperty({ type: String, example: 'CC' })
  @IsString()
  @MinLength(2)
  tipoDocumento!: string;

  @ApiProperty({ type: String, example: '123456789' })
  @IsString()
  @MinLength(4)
  numeroDocumento!: string;

  @ApiPropertyOptional({ type: String, description: 'Dato sensible; se cifra antes de persistir.' })
  @IsOptional()
  @IsString()
  contacto?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  municipio?: string;

  @ApiPropertyOptional({ type: String, example: '1990-05-20' })
  @IsOptional()
  @Matches(FECHA)
  fechaNacimiento?: string;

  @ApiProperty({ type: Boolean, description: 'Consentimiento expreso de tratamiento de datos.' })
  @IsBoolean()
  consentimientoAceptado!: boolean;
}

export class CreateProyectoDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  convocatoriaId!: string;

  @ApiProperty({ type: String, example: 'Radio comunitaria y memoria local' })
  @IsString()
  @MinLength(3)
  titulo!: string;

  @ApiProperty({
    type: String,
    description: 'PDF del formato oficial, ya cargado en Archivos.',
    format: 'uuid',
  })
  @IsUUID()
  archivoId!: string;

  @ApiProperty({ type: String, example: '2026-01-20' })
  @Matches(FECHA)
  fechaRecepcion!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Programa formativo de la propuesta.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  programaId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Formador asociado al programa.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  formadorId?: string;

  @ApiProperty({ type: RealizadorDto })
  @ValidateNested()
  @Type(() => RealizadorDto)
  realizador!: RealizadorDto;
}

export class NotifyRealizadorDto {
  @ApiPropertyOptional({ type: String, description: 'Dato sensible; se cifra antes de persistir.' })
  @IsOptional()
  @IsString()
  contacto?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  municipio?: string;
}

export class CreateComiteDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  convocatoriaId!: string;

  @ApiProperty({ type: String, example: '2026-02-10' })
  @Matches(FECHA)
  fecha!: string;

  @ApiProperty({
    type: String,
    description: 'PDF del acta, ya cargado en Archivos.',
    format: 'uuid',
  })
  @IsUUID()
  actaArchivoId!: string;

  @ApiProperty({ type: [String], description: 'Identificadores de los integrantes.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  integrantes!: string[];

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  conclusiones?: string;
}

export class RejillaTransitionDto {
  @ApiProperty({ type: String, enum: REJILLA_ESTADOS })
  @IsIn(REJILLA_ESTADOS)
  to!: RejillaEstado;
}

export class RejillaQueryDto {
  @ApiProperty({ type: Number, description: 'Año de la rejilla.', example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio!: number;
}

export class CreateInformeDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  proyectoId!: string;

  @ApiProperty({
    type: String,
    description: 'Fecha en octubre o noviembre.',
    example: '2026-10-15',
  })
  @Matches(FECHA)
  fechaInforme!: string;

  @ApiProperty({
    type: String,
    description: 'PDF del informe, ya cargado en Archivos.',
    format: 'uuid',
  })
  @IsUUID()
  archivoId!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateIncentivoDto {
  @ApiProperty({ type: String, enum: INCENTIVO_ESTADOS })
  @IsIn(INCENTIVO_ESTADOS)
  to!: IncentivoEstado;

  @ApiPropertyOptional({
    type: Number,
    description: 'Calificación 0…100.',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  calificacion?: number;

  @ApiPropertyOptional({ type: String, description: 'Referencia de CDP exigida al resolver.' })
  @IsOptional()
  @IsString()
  referenciaCdp?: string;
}

/* ------------------------------- Programación ---------------------------- */

export class ProgramacionItemDto {
  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;

  @ApiProperty({ type: String, example: '06:00' })
  @Matches(HORA)
  horaInicio!: string;

  @ApiProperty({ type: String, example: '07:00' })
  @Matches(HORA)
  horaFin!: string;

  @ApiProperty({ type: String, enum: FRANJA_TIPOS })
  @IsIn(FRANJA_TIPOS)
  tipo!: FranjaTipo;

  @ApiPropertyOptional({
    type: String,
    description: 'Programa de formación asociado.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  programaId?: string;

  @ApiProperty({ type: String, example: 'Voces de la semana' })
  @IsString()
  @MinLength(1)
  titulo!: string;
}

export class CreateProgramacionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  rejillaAnualId!: string;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;

  @ApiProperty({ type: [ProgramacionItemDto], description: 'Franjas del día.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProgramacionItemDto)
  items!: ProgramacionItemDto[];
}

export class ProgramacionTransitionDto {
  @ApiProperty({ type: String, enum: PROGRAMACION_ESTADOS })
  @IsIn(PROGRAMACION_ESTADOS)
  to!: ProgramacionEstado;
}

export class ProgramacionQueryDto {
  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;
}

/* ------------------------------ Grabación -------------------------------- */

export class CreateGrabacionDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Franja de programación asociada.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  programacionItemId?: string;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;

  @ApiPropertyOptional({ type: String, description: 'Responsable de la sesión.', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  responsableId?: string;
}

export class GrabacionTransitionDto {
  @ApiProperty({ type: String, enum: GRABACION_ESTADOS })
  @IsIn(GRABACION_ESTADOS)
  to!: GrabacionEstado;
}

export class AsistenciaEntryDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  usuarioId!: string;

  @ApiProperty({ type: String, enum: ASISTENCIA_ESTADOS })
  @IsIn(ASISTENCIA_ESTADOS)
  estado!: AsistenciaEstado;
}

export class RegistrarAsistenciaDto {
  @ApiProperty({ type: [AsistenciaEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AsistenciaEntryDto)
  entries!: AsistenciaEntryDto[];
}

export class SubirAudioDto {
  @ApiProperty({ type: String, description: 'Sesión de grabación.', format: 'uuid' })
  @IsUUID()
  sesionGrabacionId!: string;

  @ApiProperty({ type: String, enum: AUDIO_TIPOS })
  @IsIn(AUDIO_TIPOS)
  tipo!: AudioTipo;

  @ApiProperty({ type: Number, description: 'Duración en segundos.', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duracionSegundos!: number;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;

  // El archivo viaja en `req.file` (multer), no en el cuerpo validado. Se
  // declara opcional para que el `whitelist` global no lo rechace si el
  // transporte lo refleja en el cuerpo; la presencia real se valida en el
  // controlador y la documentación sigue marcándolo como requerido.
  @ApiProperty({ type: String, format: 'binary', description: 'Archivo de audio.' })
  @IsOptional()
  file?: Express.Multer.File;
}

export class AudioQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Filtra por sesión de grabación.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  sesionId?: string;
}

/* --------------------------------- E3 ------------------------------------ */

const FECHA_HORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/u;

export class CreateResolucionDto {
  @ApiProperty({ type: String, format: 'uuid', description: 'Incentivo resuelto.' })
  @IsUUID()
  incentivoId!: string;

  @ApiProperty({ type: String, description: 'Periodo YYYY o YYYY-MM del oficio.', example: '2026' })
  @Matches(/^\d{4}(-(0[1-9]|1[0-2]))?$/u)
  periodo!: string;
}

export class CreatePatrocinioDto {
  @ApiProperty({ type: String, example: 'Cultura en la plaza' })
  @IsString()
  @MinLength(1)
  nombre!: string;

  @ApiProperty({ type: String, example: 'Alcaldía municipal' })
  @IsString()
  @MinLength(1)
  entidad!: string;

  @ApiPropertyOptional({ type: String, example: '2026-01-19' })
  @IsOptional()
  @Matches(FECHA)
  fechaInicio?: string;

  @ApiPropertyOptional({ type: String, example: '2026-12-18' })
  @IsOptional()
  @Matches(FECHA)
  fechaFin?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', description: 'Contrato PDF ya cargado.' })
  @IsOptional()
  @IsUUID()
  contratoArchivoId?: string;
}

export class PatrocinioTransitionDto {
  @ApiProperty({ type: String, enum: PATROCINIO_ESTADOS })
  @IsIn(PATROCINIO_ESTADOS)
  to!: PatrocinioEstado;

  @ApiPropertyOptional({ type: String, format: 'uuid', description: 'Contrato PDF para aprobar.' })
  @IsOptional()
  @IsUUID()
  contratoArchivoId?: string;
}

export class CreatePromoDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  patrocinioId!: string;

  @ApiProperty({ type: String, example: 'Promo de la semana cultural' })
  @IsString()
  @MinLength(1)
  nombre!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  guion?: string;

  @ApiProperty({ type: Number, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duracionSegundos!: number;
}

export class PromoTransitionDto {
  @ApiProperty({ type: String, enum: PROMO_ESTADOS })
  @IsIn(PROMO_ESTADOS)
  to!: PromoEstado;

  @ApiPropertyOptional({ type: String, format: 'uuid', description: 'Audio limpio para producir.' })
  @IsOptional()
  @IsUUID()
  audioArchivoId?: string;
}

export class CreateOrdenEmisionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  promoId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  programacionItemId?: string;

  @ApiPropertyOptional({ type: String, example: '2026-01-19' })
  @IsOptional()
  @Matches(FECHA)
  fechaEmision?: string;
}

export class OrdenEmisionTransitionDto {
  @ApiProperty({ type: String, enum: ORDEN_EMISION_ESTADOS })
  @IsIn(ORDEN_EMISION_ESTADOS)
  to!: OrdenEmisionEstado;
}

export class CreatePublicacionDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  promoId?: string;

  @ApiProperty({ type: String, example: 'facebook' })
  @IsString()
  @MinLength(1)
  canal!: string;

  @ApiProperty({ type: String, example: '2026-01-20' })
  @Matches(FECHA)
  fechaPublicacion!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  archivoId?: string;
}

export class PublicacionTransitionDto {
  @ApiProperty({ type: String, enum: PUBLICACION_ESTADOS })
  @IsIn(PUBLICACION_ESTADOS)
  to!: PublicacionEstado;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  archivoId?: string;
}

export class CreateTransmisionDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  programacionItemId?: string;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fechaTransmision!: string;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  esFueraCiudad!: boolean;

  @ApiPropertyOptional({ type: String, example: 'Villa de Leyva' })
  @IsOptional()
  @IsString()
  destino?: string;
}

export class TransmisionTransitionDto {
  @ApiProperty({ type: String, enum: TRANSMISION_ESTADOS })
  @IsIn(TRANSMISION_ESTADOS)
  to!: TransmisionEstado;
}

export class CreateSalidaEquipoDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  transmisionId!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    example: 'dddddddd-0000-4000-8000-000000000001',
  })
  @IsUUID()
  equipoId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  responsableId!: string;

  @ApiPropertyOptional({ type: String, example: '2026-01-19T06:00:00Z' })
  @IsOptional()
  @Matches(FECHA_HORA_ISO)
  fechaSalida?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class CreateReporteDesplazamientoDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  transmisionId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  conductorId?: string;

  @ApiProperty({ type: String, example: 'Vehículo 01' })
  @IsString()
  @MinLength(1)
  vehiculo!: string;

  @ApiPropertyOptional({ type: String, example: '2026-01-19T05:30:00Z' })
  @IsOptional()
  @Matches(FECHA_HORA_ISO)
  horaSalida?: string;

  @ApiPropertyOptional({ type: String, example: '2026-01-19T06:00:00Z' })
  @IsOptional()
  @Matches(FECHA_HORA_ISO)
  horaLlegada?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  novedades?: string;
}

export class CreatePrestamoMifiDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  transmisionId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  usuarioId!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class PrestamoMifiTransitionDto {
  @ApiProperty({ type: String, enum: PRESTAMO_ESTADOS })
  @IsIn(PRESTAMO_ESTADOS)
  to!: PrestamoEstado;
}

export class CreateViaticoDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  transmisionId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  usuarioId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  soporteArchivoId?: string;
}

/* ---------------------------------- E4 ----------------------------------- */

export class CreateTurnoDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  transmisorId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  operadorId!: string;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;

  @ApiProperty({ type: String, example: '06:00' })
  @Matches(HORA)
  horaInicio!: string;

  @ApiProperty({ type: String, example: '07:00' })
  @Matches(HORA)
  horaFin!: string;
}

export class TurnoTransitionDto {
  @ApiProperty({ type: String, enum: TURNO_ESTADOS })
  @IsIn(TURNO_ESTADOS)
  to!: TurnoEstado;
}

export class CreateLecturaDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  transmisorId!: string;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;

  @ApiPropertyOptional({ type: Number, example: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  potenciaW?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  frecuencia?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class LecturaQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Filtra por transmisor.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  transmisorId?: string;
}

export class CreateBitacoraDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  transmisorId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  turnoId?: string;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  incidente!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  accion?: string;
}

export class CreateObraDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  titulo!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  compositorAutor!: string;

  @ApiProperty({ type: Number, example: 210 })
  @IsInt()
  @Min(1)
  duracionSegundos!: number;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fechaInclusion!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  archivoId?: string;
}

export class CreateReporteObraDto {
  @ApiProperty({ type: String, enum: ENTIDADES_REPORTE })
  @IsIn(ENTIDADES_REPORTE)
  entidad!: EntidadReporte;

  @ApiProperty({ type: String, example: '2026-01' })
  @Matches(/^\d{4}(-(0[1-9]|1[0-2]))?$/u)
  periodo!: string;

  @ApiProperty({ type: String, example: '2026-01-01' })
  @Matches(FECHA)
  fechaInicio!: string;

  @ApiProperty({ type: String, example: '2026-01-31' })
  @Matches(FECHA)
  fechaFin!: string;
}

export class CreatePagoDerechosDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  obraId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reporteId?: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  soporteArchivoId!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  referencia!: string;
}

export class CreateEquipoDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  nombre!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  tipo!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  numeroSerie!: string;

  @ApiPropertyOptional({ type: String, example: '2026-01-19' })
  @IsOptional()
  @Matches(FECHA)
  fechaAdquisicion?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  archivoId?: string;
}

export class EquipoEstadoDto {
  @ApiProperty({ type: String, enum: EQUIPO_ESTADOS })
  @IsIn(EQUIPO_ESTADOS)
  estado!: EquipoEstado;
}

export class CreateActualizacionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  equipoId!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  descripcion!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  solicitadaPor?: string;

  @ApiPropertyOptional({ type: String, example: '2026-01-19' })
  @IsOptional()
  @Matches(FECHA)
  fecha?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  soporteArchivoId?: string;
}

export class ActualizacionTransitionDto {
  @ApiProperty({ type: String, enum: ACTUALIZACION_ESTADOS })
  @IsIn(ACTUALIZACION_ESTADOS)
  to!: ActualizacionEstado;
}

export class CreateProyeccionDto {
  @ApiProperty({ type: Number, example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio!: number;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoId?: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  descripcion!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  archivoId?: string;
}

export class ProyeccionTransitionDto {
  @ApiProperty({ type: String, enum: PROYECCION_ESTADOS })
  @IsIn(PROYECCION_ESTADOS)
  to!: ProyeccionEstado;
}

export class CreateInversionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  proyeccionId!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  contratoRef?: string;

  @ApiPropertyOptional({ type: String, example: '2026-01-01' })
  @IsOptional()
  @Matches(FECHA)
  fechaInicio?: string;

  @ApiPropertyOptional({ type: String, example: '2026-12-31' })
  @IsOptional()
  @Matches(FECHA)
  fechaFin?: string;
}

export class InversionTransitionDto {
  @ApiProperty({ type: String, enum: INVERSION_ESTADOS })
  @IsIn(INVERSION_ESTADOS)
  to!: InversionEstado;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  contratoRef?: string;
}

export class CreateVersionSoftwareDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoId?: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  nombre!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  version!: string;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fechaInstalacion!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  responsableId?: string;
}

export class CreateAsignacionEquipoDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  equipoId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  transmisorId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fechaAsignacion!: string;

  @ApiPropertyOptional({ type: String, example: '2026-01-20' })
  @IsOptional()
  @Matches(FECHA)
  fechaDevolucion?: string;
}

export class CreateActividadDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  nombre!: string;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  lugar?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  archivoId?: string;
}

export class CreatePermisoSalidaDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  actividadId!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  destino!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  referencia!: string;
}

export class CreateArchivoEmisoraDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  archivoId!: string;

  @ApiProperty({ type: String, enum: ARCHIVO_EMISORA_TIPOS })
  @IsIn(ARCHIVO_EMISORA_TIPOS)
  tipo!: ArchivoEmisoraTipo;

  @ApiPropertyOptional({ type: Number, example: 210 })
  @IsOptional()
  @IsInt()
  @Min(1)
  duracionSegundos?: number;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  responsableId!: string;
}

export class CreatePlanillaDto {
  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fecha!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  programacionDiariaId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  operadorId?: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  programa!: string;
}

export class CreateTramiteDto {
  @ApiProperty({ type: String, enum: TRAMITE_DESTINOS })
  @IsIn(TRAMITE_DESTINOS)
  destino!: TramiteDestino;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  asunto!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  radicadoRef?: string;

  @ApiProperty({ type: String, example: '2026-01-19' })
  @Matches(FECHA)
  fechaRadicacion!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  responsableId?: string;
}

export class CreateSoporteTramiteDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  archivoId!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class TramiteTransitionDto {
  @ApiProperty({ type: String, enum: TRAMITE_ESTADOS })
  @IsIn(TRAMITE_ESTADOS)
  to!: TramiteEstado;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  radicadoRef?: string;
}
