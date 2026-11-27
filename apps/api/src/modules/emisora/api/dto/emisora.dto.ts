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
  PROGRAMACION_ESTADOS,
  REJILLA_ESTADOS,
  type AsistenciaEstado,
  type AudioTipo,
  type FranjaTipo,
  type GrabacionEstado,
  type IncentivoEstado,
  type ProgramacionEstado,
  type RejillaEstado,
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
