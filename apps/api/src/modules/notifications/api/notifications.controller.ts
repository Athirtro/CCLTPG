import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { buildRequestContext } from '../../../shared/http/request-context.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { NotificationsService } from '../application/notifications.service.js';
import {
  ListNotificationsQueryDto,
  MarkReadResponseDto,
  NotificationListResponseDto,
  PreferencesResponseDto,
  UpdateNotificationDto,
  UpdatePreferencesDto,
} from './dto/notification.dto.js';

@ApiTags('notificaciones')
@ApiBearerAuth('bearerAuth')
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications:notification:read_own')
  @ApiOperation({
    operationId: 'listNotifications',
    summary: 'Bandeja de notificaciones propia',
    description: 'Solo devuelve notificaciones del usuario autenticado; nunca las de otro usuario.',
  })
  @ApiOkResponse({ type: NotificationListResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['notifications:notification:read_own'],
    scope: 'own',
    auditEvent: '-',
    auditExempt: 'Lectura propia sin mutación de estado.',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async list(
    @Query() query: ListNotificationsQueryDto,
    @Req() request: Request & { auth?: AuthPrincipal },
  ): Promise<NotificationListResponseDto> {
    const page = await this.notifications.list(request.auth!.userId, {
      soloNoLeidas: query.soloNoLeidas,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      items: page.items.map((item) => ({
        id: item.id,
        evento: item.evento,
        canal: item.canal,
        asunto: item.asunto,
        cuerpo: item.cuerpo,
        payload: item.payload,
        estado: item.estado,
        leidaEn: item.leidaEn?.toISOString() ?? null,
        creadoEn: item.creadoEn.toISOString(),
      })),
      total: page.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Patch(':id')
  @RequirePermissions('notifications:notification:update_own')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateNotification',
    summary: 'Marca una notificación propia como leída',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: MarkReadResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['notifications:notification:update_own'],
    scope: 'own',
    auditEvent: '-',
    auditExempt:
      'Marcar como leída no altera datos de negocio; se audita la entrega, no la lectura.',
    errorCodes: ['RESOURCE_NOT_FOUND', 'PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateNotificationDto,
    @Req() request: Request & { auth?: AuthPrincipal },
  ): Promise<MarkReadResponseDto> {
    await this.notifications.markRead(request.auth!.userId, id, body.leida);
    return { id, leida: body.leida };
  }

  @Get('preferences')
  @RequirePermissions('notifications:preference:read_own')
  @ApiOperation({
    operationId: 'getNotificationPreferences',
    summary: 'Preferencias de notificación propias',
  })
  @ApiOkResponse({ type: PreferencesResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['notifications:preference:read_own'],
    scope: 'own',
    auditEvent: '-',
    auditExempt: 'Lectura propia de preferencias.',
    errorCodes: ['PERMISSION_DENIED'],
  })
  async getPreferences(
    @Req() request: Request & { auth?: AuthPrincipal },
  ): Promise<PreferencesResponseDto> {
    const result = await this.notifications.getPreferences(request.auth!.userId);
    return { preferencias: result.preferencias, criticos: [...result.criticos] };
  }

  @Put('preferences')
  @RequirePermissions('notifications:preference:update_own')
  @ApiOperation({
    operationId: 'updateNotificationPreferences',
    summary: 'Actualiza preferencias de notificación propias',
    description: 'Los eventos críticos no se pueden silenciar.',
  })
  @ApiOkResponse({ type: PreferencesResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['notifications:preference:update_own'],
    scope: 'own',
    auditEvent: 'preferencia.actualizada',
    errorCodes: [
      'NOTIFICATION_CRITICAL_NOT_SILENCEABLE',
      'NOTIFICATION_PREFERENCE_INVALID',
      'PERMISSION_DENIED',
      'VALIDATION_FAILED',
    ],
  })
  async updatePreferences(
    @Body() body: UpdatePreferencesDto,
    @Req() request: Request & { auth?: AuthPrincipal },
  ): Promise<PreferencesResponseDto> {
    const actor = request.auth!;
    const result = await this.notifications.updatePreferences(
      { userId: actor.userId, actorProfile: actor.actorProfile },
      body.preferencias,
      buildRequestContext(request),
    );

    return { preferencias: result.preferencias, criticos: [...result.criticos] };
  }
}
