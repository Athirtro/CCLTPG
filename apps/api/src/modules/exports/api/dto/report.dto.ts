import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

import {
  ANALYTICS_FORMATS,
  REPORT_CODES,
  type AnalyticsFormat,
} from '../../../../shared/analytics/analytics-catalog.js';

const PERIOD_PATTERN = /^[0-9]{4}-[0-9]+$/u;

export class ReportColumnDto {
  @ApiProperty({ type: String })
  key!: string;

  @ApiProperty({ type: String })
  label!: string;
}

export class ReportCatalogItemDto {
  @ApiProperty({ type: String, enum: [...REPORT_CODES] })
  code!: string;

  @ApiProperty({ type: String })
  nombre!: string;

  @ApiProperty({ type: String })
  descripcion!: string;

  @ApiProperty({ type: [String], enum: [...ANALYTICS_FORMATS] })
  formatos!: readonly AnalyticsFormat[];

  @ApiProperty({ type: () => [ReportColumnDto] })
  columnas!: readonly ReportColumnDto[];
}

export class ReportCatalogResponseDto {
  @ApiProperty({ type: () => [ReportCatalogItemDto] })
  items!: readonly ReportCatalogItemDto[];
}

export class GenerateReportDto {
  @ApiProperty({ type: String, example: '2026-1' })
  @IsString()
  @Matches(PERIOD_PATTERN, { message: 'El periodo debe tener el formato YYYY-P.' })
  periodo!: string;

  @ApiProperty({ type: String, enum: [...ANALYTICS_FORMATS] })
  @IsIn([...ANALYTICS_FORMATS])
  formato!: AnalyticsFormat;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  programaId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  grupoId?: string | null;
}
