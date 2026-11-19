import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

export class AuditQueryDto {
  @IsOptional()
  @IsISO8601({ strict: false })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: false })
  to?: string;

  @IsOptional()
  @IsUUID('7')
  actorId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z_]+$/u)
  recurso?: string;

  @IsOptional()
  @IsUUID('7')
  recursoId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z_]+\.[a-z_]+$/u)
  accion?: string;

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
