import { ApiProperty } from '@nestjs/swagger';

import type { FileView } from '../../application/file.types.js';

export class FileResponseDto implements FileView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  nombreOriginal!: string;

  @ApiProperty({ type: String })
  mime!: string;

  @ApiProperty({ type: Number })
  tamano!: number;

  @ApiProperty({ type: String, description: 'SHA-256 del contenido.' })
  hashSha256!: string;

  @ApiProperty({ type: String, enum: ['pendiente', 'limpio', 'infectado'] })
  estadoEscaneo!: FileView['estadoEscaneo'];

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: string;
}

export class ProblemDetailsResponseDto {
  @ApiProperty({ type: String })
  type!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: Number })
  status!: number;

  @ApiProperty({ type: String })
  detail!: string;

  @ApiProperty({ type: String })
  instance!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  requestId!: string;
}
