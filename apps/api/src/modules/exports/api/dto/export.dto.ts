import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsString, Matches } from 'class-validator';

import { EXPORT_FORMATS, type ExportFormat } from '../../domain/export-templates.js';

export class CreateExportDto {
  @ApiProperty({ type: String, example: 'matriculas-por-programa' })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/u)
  plantilla!: string;

  @ApiProperty({ type: String, enum: [...EXPORT_FORMATS] })
  @IsIn([...EXPORT_FORMATS])
  formato!: ExportFormat;

  @ApiProperty({
    type: Object,
    example: {
      periodo: '2026-1',
      filas: [{ programa: 'Música', matriculados: 30, activos: 28 }],
    },
  })
  @IsObject()
  parametros!: Record<string, unknown>;
}

export class ExportResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  archivoId!: string;

  @ApiProperty({ type: String })
  nombre!: string;

  @ApiProperty({ type: String })
  mime!: string;

  @ApiProperty({ type: Number })
  tamano!: number;

  @ApiProperty({ type: String, enum: [...EXPORT_FORMATS] })
  formato!: ExportFormat;

  @ApiProperty({ type: String })
  hashSha256!: string;

  @ApiProperty({
    type: String,
    example: '/api/v1/files/00000000-0000-7000-8000-000000000000/download',
  })
  descargaUrl!: string;
}
