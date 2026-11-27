import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: String, enum: ['activo', 'inactivo', 'bloqueado'] })
  @IsOptional()
  @IsIn(['activo', 'inactivo', 'bloqueado'])
  estado?: 'activo' | 'inactivo' | 'bloqueado';

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class ProfileSummaryDto {
  @ApiProperty({ type: String, example: 'educador' })
  codigo!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  validUntil!: Date | null;
}

export class LoginResponseDto {
  @ApiProperty({
    type: String,
    enum: ['authenticated', 'password_change_required', 'mfa_required', 'mfa_enrollment_required'],
  })
  status!: string;

  @ApiPropertyOptional({ type: String })
  sessionToken?: string;

  @ApiPropertyOptional({ type: String })
  accessToken?: string;

  @ApiPropertyOptional({ type: String, example: 'Bearer' })
  tokenType?: string;

  @ApiPropertyOptional({ type: Number, example: 900 })
  expiresIn?: number;

  @ApiPropertyOptional({ type: String })
  csrfToken?: string;

  @ApiProperty({ type: Boolean })
  mustChangePassword!: boolean;

  @ApiProperty({ type: () => [ProfileSummaryDto] })
  profiles!: ProfileSummaryDto[];
}

export class MeResponseDto {
  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ type: String })
  nombre!: string;

  @ApiProperty({ type: String })
  estado!: string;

  @ApiProperty({ type: Boolean })
  mfaEnabled!: boolean;

  @ApiProperty({ type: Boolean })
  mustChangePassword!: boolean;

  @ApiProperty({ type: () => [ProfileSummaryDto] })
  profiles!: ProfileSummaryDto[];

  @ApiPropertyOptional({ type: String, nullable: true })
  activeProfile!: string | null;

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class MfaEnrollResponseDto {
  @ApiProperty({ type: String })
  secret!: string;

  @ApiProperty({ type: String })
  otpauthUri!: string;
}

export class RecoveryCodesResponseDto {
  @ApiProperty({ type: [String] })
  recoveryCodes!: string[];
}

/** Proyección administrativa de usuario: nunca incluye hashes ni secreto MFA. */
export class AdminUserResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'persona@ccltpg.org' })
  email!: string;

  @ApiProperty({ type: String })
  nombre!: string;

  @ApiProperty({ type: String, enum: ['activo', 'inactivo', 'bloqueado'] })
  estado!: 'activo' | 'inactivo' | 'bloqueado';

  @ApiProperty({ type: Boolean })
  mfaHabilitado!: boolean;

  @ApiProperty({ type: Boolean })
  debeCambiarPassword!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  actualizadoEn!: string;
}

export class ListUsersResponseDto {
  @ApiProperty({ type: () => [AdminUserResponseDto] })
  items!: AdminUserResponseDto[];

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  limit!: number;

  @ApiProperty({ type: Number })
  offset!: number;
}

export class AssignProfileResponseDto {
  @ApiProperty({ type: Boolean })
  ok!: true;
}
