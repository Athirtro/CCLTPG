import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Solo notificaciones no leídas.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  soloNoLeidas = false;

  @ApiPropertyOptional({ type: Number, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  @ApiPropertyOptional({ type: Number, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class UpdateNotificationDto {
  @ApiProperty({ type: Boolean, description: 'Marca la notificación como leída o no leída.' })
  @IsBoolean()
  leida!: boolean;
}

export class NotificationPreferenceDto {
  @ApiProperty({ type: String, example: 'matricula.confirmada' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/u)
  evento!: string;

  @ApiProperty({ type: String, enum: ['app', 'email'] })
  @IsIn(['app', 'email'])
  canal!: 'app' | 'email';

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  habilitado!: boolean;
}

export class UpdatePreferencesDto {
  @ApiProperty({ type: () => [NotificationPreferenceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceDto)
  preferencias!: NotificationPreferenceDto[];
}

export class NotificationPreferenceResponseDto implements NotificationPreferenceDto {
  @ApiProperty({ type: String })
  evento!: string;

  @ApiProperty({ type: String, enum: ['app', 'email'] })
  canal!: 'app' | 'email';

  @ApiProperty({ type: Boolean })
  habilitado!: boolean;
}

export class PreferencesResponseDto {
  @ApiProperty({ type: () => [NotificationPreferenceResponseDto] })
  preferencias!: NotificationPreferenceResponseDto[];

  @ApiProperty({ type: [String], description: 'Prefijos de eventos no silenciables.' })
  criticos!: string[];
}

export class NotificationResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  evento!: string;

  @ApiProperty({ type: String, enum: ['app', 'email'] })
  canal!: 'app' | 'email';

  @ApiPropertyOptional({ type: String, nullable: true })
  asunto!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  cuerpo!: string | null;

  @ApiProperty({ type: Object })
  payload!: unknown;

  @ApiProperty({ type: String, enum: ['pendiente', 'enviada', 'leida', 'fallida'] })
  estado!: 'pendiente' | 'enviada' | 'leida' | 'fallida';

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  leidaEn!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: string;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: () => [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  limit!: number;

  @ApiProperty({ type: Number })
  offset!: number;
}

export class MarkReadResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Boolean })
  leida!: boolean;
}
