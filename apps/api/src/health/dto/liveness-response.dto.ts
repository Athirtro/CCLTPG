import { ApiProperty } from '@nestjs/swagger';

export class LivenessResponseDto {
  @ApiProperty({ type: String, enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({ type: Number, example: 42 })
  uptimeSeconds!: number;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-17T12:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '01a1ec52-3f1b-7c4d-8e5f-6a7b8c9d0e1f',
  })
  requestId!: string | null;
}
