import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProblemFieldErrorDto {
  @ApiProperty({ type: String, example: 'email' })
  field!: string;

  @ApiProperty({ type: String, example: 'INVALID_FORMAT' })
  code!: string;

  @ApiProperty({ type: String, example: 'El correo no tiene un formato válido.' })
  detail!: string;
}

export class ProblemDetailsDto {
  @ApiProperty({ type: String, example: 'about:blank' })
  type!: string;

  @ApiProperty({ type: String, example: 'Service Unavailable' })
  title!: string;

  @ApiProperty({ type: Number, example: 503 })
  status!: number;

  @ApiProperty({ type: String, example: 'Dependencias no disponibles: redis.' })
  detail!: string;

  @ApiProperty({ type: String, example: '/api/v1/health/ready' })
  instance!: string;

  @ApiProperty({ type: String, example: 'SERVICE_UNAVAILABLE' })
  code!: string;

  @ApiPropertyOptional({ type: () => [ProblemFieldErrorDto] })
  errors?: ProblemFieldErrorDto[];

  @ApiProperty({ type: String, example: '01a1ec52-3f1b-7c4d-8e5f-6a7b8c9d0e1f' })
  requestId!: string;
}
