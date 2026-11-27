import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
  ApiBody,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { buildRequestContext } from '../../../shared/http/request-context.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { ReportGenerationService } from '../application/report-generation.service.js';
import { ExportResponseDto } from './dto/export.dto.js';
import { GenerateReportDto, ReportCatalogResponseDto } from './dto/report.dto.js';

type AuthenticatedRequest = Request & { auth?: AuthPrincipal };

const CATALOG_PERMISSIONS = ['exports:report:create', 'exports:report:export'] as const;

/** Catálogo y generación de reportes académicos (C6 — D81). */
@ApiTags('reportes')
@ApiBearerAuth('bearerAuth')
@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportGenerationService) private readonly reports: ReportGenerationService) {}

  @Get('catalog')
  @RequirePermissions(...CATALOG_PERMISSIONS)
  @ApiOperation({
    operationId: 'listReportCatalog',
    summary: 'Catálogo de reportes académicos',
    description: 'Cuatro definiciones cerradas en código con sus formatos y columnas.',
  })
  @ApiOkResponse({ type: ReportCatalogResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: [...CATALOG_PERMISSIONS],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Catálogo estático de solo lectura; no expone datos de estudiantes.',
    errorCodes: ['PERMISSION_DENIED'],
  })
  async catalog(): Promise<ReportCatalogResponseDto> {
    return { items: await this.reports.catalog() };
  }

  @ApiBody({ type: GenerateReportDto })
  @Post(':code/generate')
  @RequirePermissions('exports:report:create')
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'generateReport',
    summary: 'Genera un reporte académico exportable',
    description:
      'Los datos se consultan en servidor con el ámbito del actor y se entregan mediante el servicio de exportaciones; la generación queda registrada como `reporte.generado`.',
  })
  @ApiParam({
    name: 'code',
    type: String,
    description: 'Código del catálogo de reportes: asistencia, desempeno, matricula o desercion.',
  })
  @ApiCreatedResponse({ type: ExportResponseDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnsupportedMediaTypeResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['exports:report:create'],
    scope: 'mixed',
    auditEvent: 'reporte.generado',
    errorCodes: [
      'REPORT_NOT_FOUND',
      'RESOURCE_NOT_FOUND',
      'INVALID_PERIOD',
      'VALIDATION_FAILED',
      'EXPORT_FORMAT_NOT_SUPPORTED',
      'EXPORT_PARAMETERS_INVALID',
      'EXPORT_TOO_LARGE',
      'IDEMPOTENCY_KEY_REQUIRED',
      'IDEMPOTENCY_KEY_REUSED',
      'IDEMPOTENCY_IN_PROGRESS',
      'FILE_STORAGE_UNAVAILABLE',
      'PERMISSION_DENIED',
    ],
  })
  async generate(
    @Param('code') code: string,
    @Body() body: GenerateReportDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExportResponseDto> {
    const actor = request.auth!;
    return this.reports.generate({
      code,
      periodo: body.periodo,
      formato: body.formato,
      programaId: body.programaId ?? null,
      grupoId: body.grupoId ?? null,
      idempotencyKey: idempotencyKey ?? null,
      actor: {
        userId: actor.userId,
        actorProfile: actor.actorProfile,
        permissions: actor.permissions,
      },
      context: buildRequestContext(request),
    });
  }
}
