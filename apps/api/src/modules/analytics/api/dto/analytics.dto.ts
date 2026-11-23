import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

import { KPI_CODES, type KpiUnit } from '../../../../shared/analytics/analytics-catalog.js';

const PERIOD_PATTERN = /^[0-9]{4}-[0-9]+$/u;

export class KpiQueryDto {
  @ApiProperty({ type: String, example: '2026-1' })
  @IsString()
  @Matches(PERIOD_PATTERN, { message: 'El periodo debe tener el formato YYYY-P.' })
  periodo!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  programaId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  grupoId?: string | null;

  @ApiPropertyOptional({ type: String, enum: [...KPI_CODES] })
  @IsOptional()
  @IsIn([...KPI_CODES])
  kpi?: string;
}

export class KpiBreakdownItemDto {
  @ApiProperty({ type: String })
  clave!: string;

  @ApiProperty({ type: Number })
  total!: number;
}

export class KpiResultDto {
  @ApiProperty({ type: String, enum: [...KPI_CODES] })
  code!: string;

  @ApiProperty({ type: String })
  nombre!: string;

  @ApiProperty({ type: Number, nullable: true })
  valor!: number | null;

  @ApiProperty({ type: String, enum: ['conteo', 'porcentaje', 'distribucion'] })
  unidad!: KpiUnit;

  @ApiProperty({ type: () => [KpiBreakdownItemDto] })
  desglose!: readonly KpiBreakdownItemDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  calculadoEn!: Date;
}

export class KpisResponseDto {
  @ApiProperty({ type: () => [KpiResultDto] })
  kpis!: readonly KpiResultDto[];
}
