import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ type: String, example: 'persona@ccltpg.org' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ type: String, example: 'Plataforma#2026!' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class MfaVerifyDto {
  @ApiProperty({ type: String, description: 'Token parcial emitido por el login.' })
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  sessionToken!: string;

  @ApiProperty({ type: String, example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code!: string;

  @ApiPropertyOptional({ type: String, enum: ['totp', 'recovery'], default: 'totp' })
  @IsOptional()
  @IsIn(['totp', 'recovery'])
  method?: 'totp' | 'recovery';
}

export class MfaConfirmDto {
  @ApiPropertyOptional({ type: String, description: 'Token parcial `mfa_enroll`.' })
  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  sessionToken?: string;

  @ApiProperty({ type: String, example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code!: string;
}

export class RecoveryCodesDto {
  @ApiProperty({ type: String, description: 'Código TOTP o de recuperación.' })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;

  @ApiProperty({ type: String, description: 'Nueva contraseña (12–128 caracteres).' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class CreateUserProfileDto {
  @ApiProperty({ type: String, example: 'educador' })
  @IsString()
  @MaxLength(64)
  codigo!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: false })
  validUntil?: string;
}

export class CreateUserDto {
  @ApiProperty({ type: String, example: 'nuevo@ccltpg.org' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ type: String, example: 'Nombre Apellido' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre!: string;

  @ApiProperty({ type: String, description: 'Contraseña inicial; se fuerza cambio.' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ type: String, enum: ['activo', 'inactivo', 'bloqueado'] })
  @IsOptional()
  @IsIn(['activo', 'inactivo', 'bloqueado'])
  estado?: 'activo' | 'inactivo' | 'bloqueado';

  @ApiProperty({ type: () => [CreateUserProfileDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUserProfileDto)
  profiles!: CreateUserProfileDto[];
}

export class UpdateUserDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional({ type: String, description: 'Reset administrativo; write-only.' })
  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  resetMfa?: boolean;
}

export class TransitionDto {
  @ApiProperty({ type: String, enum: ['activo', 'inactivo', 'bloqueado'] })
  @IsIn(['activo', 'inactivo', 'bloqueado'])
  to!: 'activo' | 'inactivo' | 'bloqueado';

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}

export class AssignProfileDto {
  @ApiProperty({ type: String, example: 'estudiante' })
  @IsString()
  @MaxLength(64)
  codigo!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: false })
  validUntil?: string;
}
