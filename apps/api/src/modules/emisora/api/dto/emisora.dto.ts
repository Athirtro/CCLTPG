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
  ASISTENCIA_ESTADOS,
  AUDIO_TIPOS,
  FRANJA_TIPOS,
  GRABACION_ESTADOS,
  INCENTIVO_ESTADOS,
  ORDEN_EMISION_ESTADOS,
  PATROCINIO_ESTADOS,
  PRESTAMO_ESTADOS,
  PROMO_ESTADOS,
  PROGRAMACION_ESTADOS,
  PUBLICACION_ESTADOS,
  REJILLA_ESTADOS,
  TRANSMISION_ESTADOS,
  type AsistenciaEstado,
  type AudioTipo,
  type FranjaTipo,
  type GrabacionEstado,
  type IncentivoEstado,
  type OrdenEmisionEstado,
  type PatrocinioEstado,
  type PrestamoEstado,
  type PromoEstado,
  type ProgramacionEstado,
  type PublicacionEstado,
  type RejillaEstado,
  type TransmisionEstado,
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
  @Matches(/^\d{4}(-\d{2})?$/u)
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
