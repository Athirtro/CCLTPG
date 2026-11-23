import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { KpiService } from '../application/kpi.service.js';
import { KpiQueryDto, KpisResponseDto } from './dto/analytics.dto.js';

type AuthenticatedRequest = Request & { auth?: AuthPrincipal };

/** Consulta agregada de KPIs (C6 — D82/D83). */
@ApiTags('analítica')
@ApiBearerAuth('bearerAuth')
@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(KpiService) private readonly kpis: KpiService) {}

  @Get('kpis')
  @RequirePermissions('analytics:kpi:read')
  @ApiOperation({
    operationId: 'getKpis',
    summary: 'Consultar KPIs académicos',
    description:
      'Seis KPIs con fórmula documentada. El ámbito del educador se aplica en servidor; las respuestas contienen solo agregados y las celdas derivadas de PII con menos de 5 casos se suprimen.',
  })
  @ApiOkResponse({ type: KpisResponseDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['analytics:kpi:read'],
    scope: 'mixed',
    auditEvent: '-',
    auditExempt: 'Agregados de solo lectura; sin PII individual ni mutación de estado.',
    errorCodes: [
      'PERMISSION_DENIED',
      'RESOURCE_NOT_FOUND',
      'VALIDATION_FAILED',
      'INVALID_PERIOD',
      'KPI_NOT_FOUND',
    ],
  })
  async list(
    @Query() query: KpiQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<KpisResponseDto> {
    const actor = request.auth!;
    const kpis = await this.kpis.list(
      {
        periodo: query.periodo,
        programaId: query.programaId ?? null,
        grupoId: query.grupoId ?? null,
        kpi: query.kpi ?? null,
      },
      { userId: actor.userId, permissions: actor.permissions },
    );
    return { kpis };
  }
}
