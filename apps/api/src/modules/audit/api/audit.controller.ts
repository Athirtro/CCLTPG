import { Controller, Get, HttpException, Inject, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { buildRequestContext } from '../../../shared/http/request-context.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { AuditService } from '../application/audit.service.js';
import { AuditQueryDto } from './dto/audit-query.dto.js';

@ApiTags('auditoría')
@ApiBearerAuth('bearerAuth')
@Controller('audit')
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get('events')
  @RequirePermissions('audit:event:read')
  @ApiOperation({
    operationId: 'listAuditEvents',
    summary: 'Consulta de eventos de auditoría',
    description:
      'Solo `audit:event:read`. La propia consulta genera `auditoria.consultada` con los filtros y el número de resultados.',
  })
  @ApiOkResponse({ description: 'Página de eventos.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['audit:event:read'],
    scope: 'global',
    auditEvent: 'auditoria.consultada',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async list(
    @Query() query: AuditQueryDto,
    @Req() request: Request & { auth?: AuthPrincipal },
  ): Promise<unknown> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    if (from && to && from.getTime() > to.getTime()) {
      throw new HttpException(
        {
          code: 'VALIDATION_FAILED',
          statusCode: 400,
          detail: 'El rango de fechas es inválido.',
        },
        400,
      );
    }

    const page = await this.audit.query(
      {
        from,
        to,
        actorId: query.actorId,
        recurso: query.recurso,
        recursoId: query.recursoId,
        accion: query.accion,
        limit: query.limit,
        offset: query.offset,
      },
      request.auth!,
      buildRequestContext(request),
    );

    return {
      items: page.items,
      total: page.total,
      limit: query.limit,
      offset: query.offset,
    };
  }
}
