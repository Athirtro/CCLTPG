import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['activo', 'inactivo', 'bloqueado'])
  estado?: 'activo' | 'inactivo' | 'bloqueado';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

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
