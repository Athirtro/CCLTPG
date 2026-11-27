import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

export class AuditQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: false })
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: false })
  to?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7')
  actorId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z_]+$/u)
  recurso?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('7')
  recursoId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z_]+\.[a-z_]+$/u)
  accion?: string;

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
