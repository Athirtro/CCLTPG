import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  ASISTENCIA_ESTADOS,
  EVALUACION_VALORES,
  GRUPO_ESTADOS,
  MATRICULA_ESTADOS,
  PROGRAMA_ESTADOS,
  PROGRAM_AREAS,
  SESION_ESTADOS,
  type AsistenciaEstado,
  type EvaluacionValor,
  type GrupoEstado,
  type MatriculaEstado,
  type ProgramaArea,
  type ProgramaEstado,
  type SesionEstado,
} from '../../domain/academic-states.js';
import type {
  AsistenciaView,
  EstudianteDetailView,
  EstudianteSummaryView,
  EvaluacionView,
  GrupoView,
  IndicadorView,
  MatriculaView,
  MiEvaluacionView,
  ProgramaView,
  SesionView,
} from '../../application/academic.views.js';

const PERIOD_PATTERN = /^[0-9]{4}-[0-9]+$/u;
const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/u;

export class PaginationQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

/* -------------------------------------------------------------------------- */
/* Programas                                                                  */
/* -------------------------------------------------------------------------- */

export class CreateProgramDto {
  @ApiProperty({ type: String, example: 'Música inicial' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;

  @ApiProperty({ type: String, enum: [...PROGRAM_AREAS] })
  @IsIn([...PROGRAM_AREAS])
  area!: ProgramaArea;

  @ApiProperty({ type: Number, minimum: 1, example: 30 })
  @IsInt()
  @Min(1)
  @Max(1000)
  cupoMaximo!: number;
}

export class ProgramTransitionDto {
  @ApiProperty({ type: String, enum: [...PROGRAMA_ESTADOS] })
  @IsIn([...PROGRAMA_ESTADOS])
  to!: ProgramaEstado;
}

export class ProgramResponseDto implements ProgramaView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  nombre!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  descripcion!: string | null;

  @ApiProperty({ type: String, enum: [...PROGRAM_AREAS] })
  area!: ProgramaArea;

  @ApiProperty({ type: Number })
  cupoMaximo!: number;

  @ApiProperty({ type: String, enum: [...PROGRAMA_ESTADOS] })
  estado!: ProgramaEstado;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: string;
}

export class PaginatedProgramsDto {
  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: () => [ProgramResponseDto] })
  data!: ProgramResponseDto[];
}

/* -------------------------------------------------------------------------- */
/* Grupos y horarios                                                          */
/* -------------------------------------------------------------------------- */

export class CreateGroupDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  programaId!: string;

  @ApiProperty({ type: String, example: 'G-01' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  codigo!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  educadorId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Aula 2' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  salon?: string | null;

  @ApiProperty({ type: String, example: '2026-1' })
  @Matches(PERIOD_PATTERN, { message: 'El periodo debe tener el formato YYYY-P.' })
  periodo!: string;

  @ApiProperty({ type: Number, minimum: 1, example: 25 })
  @IsInt()
  @Min(1)
  @Max(1000)
  cupoMaximo!: number;
}

export class GroupTransitionDto {
  @ApiProperty({ type: String, enum: [...GRUPO_ESTADOS] })
  @IsIn([...GRUPO_ESTADOS])
  to!: GrupoEstado;
}

export class GroupResponseDto implements GrupoView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  programaId!: string;

  @ApiProperty({ type: String })
  codigo!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  educadorId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  salon!: string | null;

  @ApiProperty({ type: String })
  periodo!: string;

  @ApiProperty({ type: Number })
  cupoMaximo!: number;

  @ApiProperty({ type: String, enum: [...GRUPO_ESTADOS] })
  estado!: GrupoEstado;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: string;
}

export class PaginatedGroupsDto {
  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: () => [GroupResponseDto] })
  data!: GroupResponseDto[];
}

export class ScheduleSlotDto {
  @ApiProperty({
    type: Number,
    minimum: 1,
    maximum: 7,
    description: 'Día ISO 1 (lunes) – 7 (domingo).',
  })
  @IsInt()
  @Min(1)
  @Max(7)
  diaSemana!: number;

  @ApiProperty({ type: String, example: '08:00' })
  @Matches(TIME_PATTERN, { message: 'La hora debe tener el formato HH:MM.' })
  horaInicio!: string;

  @ApiProperty({ type: String, example: '10:00' })
  @Matches(TIME_PATTERN, { message: 'La hora debe tener el formato HH:MM.' })
  horaFin!: string;
}

export class ReplaceScheduleDto {
  @ApiProperty({ type: () => [ScheduleSlotDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  franjas!: ScheduleSlotDto[];
}

export class ScheduleItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  grupoId!: string;

  @ApiProperty({ type: String, nullable: true })
  grupoCodigo!: string | null;

  @ApiProperty({ type: String, nullable: true })
  programaNombre!: string | null;

  @ApiProperty({ type: String, nullable: true })
  salon!: string | null;

  @ApiProperty({ type: String, nullable: true })
  periodo!: string | null;

  @ApiProperty({ type: Number, minimum: 1, maximum: 7 })
  diaSemana!: number;

  @ApiProperty({ type: String, example: '08:00' })
  horaInicio!: string;

  @ApiProperty({ type: String, example: '10:00' })
  horaFin!: string;
}

export class ScheduleResponseDto {
  @ApiProperty({ type: () => [ScheduleItemDto] })
  items!: ScheduleItemDto[];
}

/* -------------------------------------------------------------------------- */
/* Estudiantes                                                                */
/* -------------------------------------------------------------------------- */

export class ConsentimientoDatosDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  aceptado!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  fecha!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  versionAviso!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  medio?: string;
}

export class CreateStudentDto {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  usuarioId?: string | null;

  @ApiProperty({ type: String, example: 'CC' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  tipoDocumento!: string;

  @ApiProperty({ type: String, example: '1020304050' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  numeroDocumento!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombres!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  apellidos!: string;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  municipio?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  barrio?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  direccion?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @ApiProperty({ type: () => ConsentimientoDatosDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ConsentimientoDatosDto)
  consentimientoDatos!: ConsentimientoDatosDto;
}

export class UpdateStudentDto {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  usuarioId?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  tipoDocumento?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  numeroDocumento?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombres?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  apellidos?: string;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  municipio?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  barrio?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  direccion?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @ApiPropertyOptional({ type: () => ConsentimientoDatosDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConsentimientoDatosDto)
  consentimientoDatos?: ConsentimientoDatosDto;
}

export class StudentSummaryDto implements EstudianteSummaryView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  usuarioId!: string | null;

  @ApiProperty({ type: String })
  tipoDocumento!: string;

  @ApiProperty({ type: String })
  nombres!: string;

  @ApiProperty({ type: String })
  apellidos!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  municipio!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  barrio!: string | null;

  @ApiProperty({ type: Boolean })
  consentimientoAceptado!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: string;
}

export class StudentResponseDto extends StudentSummaryDto implements EstudianteDetailView {
  @ApiProperty({ type: String, description: 'Solo en la ficha individual.' })
  numeroDocumento!: string;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  fechaNacimiento!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  direccion!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  telefono!: string | null;

  @ApiProperty({ type: Object })
  consentimientoDatos!: unknown;

  @ApiProperty({ type: String, format: 'date-time' })
  actualizadoEn!: string;
}

export class PaginatedStudentsDto {
  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: () => [StudentSummaryDto] })
  data!: StudentSummaryDto[];
}

/* -------------------------------------------------------------------------- */
/* Matrícula                                                                  */
/* -------------------------------------------------------------------------- */

export class CreateEnrollmentDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  estudianteId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  grupoId!: string;

  @ApiPropertyOptional({ type: String, example: '2026-1' })
  @IsOptional()
  @Matches(PERIOD_PATTERN, { message: 'El periodo debe tener el formato YYYY-P.' })
  periodo?: string | null;
}

export class EnrollmentTransitionDto {
  @ApiProperty({ type: String, enum: [...MATRICULA_ESTADOS] })
  @IsIn([...MATRICULA_ESTADOS])
  to!: MatriculaEstado;
}

export class EnrollmentResponseDto implements MatriculaView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  estudianteId!: string;

  @ApiProperty({ type: String })
  estudianteNombres!: string;

  @ApiProperty({ type: String })
  estudianteApellidos!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  grupoId!: string;

  @ApiProperty({ type: String })
  grupoCodigo!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  programaId!: string;

  @ApiProperty({ type: String })
  programaNombre!: string;

  @ApiProperty({ type: String })
  periodo!: string;

  @ApiProperty({ type: String, enum: [...MATRICULA_ESTADOS] })
  estado!: MatriculaEstado;

  @ApiProperty({ type: String, format: 'date-time' })
  fechaMatricula!: string;
}

export class PaginatedEnrollmentsDto {
  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: () => [EnrollmentResponseDto] })
  data!: EnrollmentResponseDto[];
}

/* -------------------------------------------------------------------------- */
/* Académico B — sesiones, asistencia y evaluación (C5)                        */
/* -------------------------------------------------------------------------- */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export class CreateSessionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  grupoId!: string;

  @ApiProperty({ type: String, example: '2026-09-14' })
  @Matches(DATE_ONLY_PATTERN, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  tema?: string | null;
}

export class SessionTransitionDto {
  @ApiProperty({ type: String, enum: [...SESION_ESTADOS] })
  @IsIn([...SESION_ESTADOS])
  to!: SesionEstado;
}

export class SessionResponseDto implements SesionView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  grupoId!: string;

  @ApiProperty({ type: String, example: '2026-09-14' })
  fecha!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  tema!: string | null;

  @ApiProperty({ type: String, enum: [...SESION_ESTADOS] })
  estado!: SesionEstado;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: string;
}

export class PaginatedSessionsDto {
  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: () => [SessionResponseDto] })
  data!: SessionResponseDto[];
}

export class AttendanceEntryDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  matriculaId!: string;

  @ApiProperty({ type: String, enum: [...ASISTENCIA_ESTADOS] })
  @IsIn([...ASISTENCIA_ESTADOS])
  estado!: AsistenciaEstado;
}

export class ReplaceAttendanceDto {
  @ApiProperty({ type: () => [AttendanceEntryDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  registros!: AttendanceEntryDto[];
}

export class AttendanceResponseDto implements AsistenciaView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  sesionId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  matriculaId!: string;

  @ApiProperty({ type: String, enum: [...ASISTENCIA_ESTADOS] })
  estado!: AsistenciaEstado;

  @ApiProperty({ type: String, format: 'date-time' })
  registradoEn!: string;
}

export class AttendanceListResponseDto {
  @ApiProperty({ type: () => [AttendanceResponseDto] })
  registros!: AttendanceResponseDto[];

  @ApiProperty({ type: Number })
  total!: number;
}

export class IndicatorResponseDto implements IndicadorView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  programaId!: string | null;

  @ApiProperty({ type: String })
  nombre!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  descripcion!: string | null;

  @ApiProperty({ type: String })
  escala!: string;
}

export class CreateEvaluationDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  matriculaId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  indicadorId!: string;

  @ApiProperty({ type: String, example: '2026-1' })
  @Matches(PERIOD_PATTERN, { message: 'El periodo debe tener el formato YYYY-P.' })
  periodo!: string;

  @ApiProperty({ type: String, enum: [...EVALUACION_VALORES] })
  @IsIn([...EVALUACION_VALORES])
  valor!: EvaluacionValor;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  observacion?: string | null;
}

export class UpdateEvaluationDto {
  @ApiProperty({ type: String, enum: [...EVALUACION_VALORES] })
  @IsIn([...EVALUACION_VALORES])
  valor!: EvaluacionValor;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  observacion?: string | null;
}

export class EvaluationResponseDto implements EvaluacionView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  matriculaId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  indicadorId!: string;

  @ApiProperty({ type: String })
  indicadorNombre!: string;

  @ApiProperty({ type: String, example: '2026-1' })
  periodo!: string;

  @ApiProperty({ type: String, enum: [...EVALUACION_VALORES] })
  valor!: EvaluacionValor;

  @ApiPropertyOptional({ type: String, nullable: true })
  observacion!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  evaluadoEn!: string;
}

export class MyEvaluationResponseDto extends EvaluationResponseDto implements MiEvaluacionView {
  @ApiProperty({ type: String })
  grupoCodigo!: string;

  @ApiProperty({ type: String })
  programaNombre!: string;
}

export class PaginatedEvaluationsDto {
  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: () => [EvaluationResponseDto] })
  data!: EvaluationResponseDto[];
}
