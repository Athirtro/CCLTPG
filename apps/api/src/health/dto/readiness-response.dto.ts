import { ApiProperty } from '@nestjs/swagger';

export class DependencyCheckDto {
  @ApiProperty({ type: String, enum: ['up', 'down'], example: 'up' })
  status!: 'up' | 'down';

  @ApiProperty({ type: Number, example: 3 })
  latencyMs!: number;
}

export class ReadinessChecksDto {
  @ApiProperty({ type: () => DependencyCheckDto })
  database!: DependencyCheckDto;

  @ApiProperty({ type: () => DependencyCheckDto })
  redis!: DependencyCheckDto;
}

export class ReadinessResponseDto {
  @ApiProperty({ type: String, enum: ['ok', 'unavailable'], example: 'ok' })
  status!: 'ok' | 'unavailable';

  @ApiProperty({ type: () => ReadinessChecksDto })
  checks!: ReadinessChecksDto;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-17T12:00:00.000Z' })
  checkedAt!: string;

  @ApiProperty({ type: String, example: '01a1ec52-3f1b-7c4d-8e5f-6a7b8c9d0e1f' })
  requestId!: string;
}
