import { Body, Controller, Headers, Inject, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { buildRequestContext } from '../../../shared/http/request-context.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { ExportsService } from '../application/exports.service.js';
import { CreateExportDto, ExportResponseDto } from './dto/export.dto.js';

@ApiTags('exportaciones')
@ApiBearerAuth('bearerAuth')
@Controller('exports')
export class ExportsController {
  constructor(@Inject(ExportsService) private readonly exports: ExportsService) {}

  @Post()
  @RequirePermissions('exports:report:export')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'createExport',
    summary: 'Genera un reporte exportable (PDF, XLSX o CSV)',
    description:
      'Plantillas cerradas en código, entrada JSON validada y salida registrada como archivo descargable por `GET /files/{id}/download`.',
  })
  @ApiCreatedResponse({ type: ExportResponseDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnsupportedMediaTypeResponse({ type: ProblemDetailsDto })
  @ApiPayloadTooLargeResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['exports:report:export'],
    scope: 'global',
    auditEvent: 'reporte.generado',
    errorCodes: [
      'EXPORT_TEMPLATE_NOT_FOUND',
      'EXPORT_FORMAT_NOT_SUPPORTED',
      'EXPORT_PARAMETERS_INVALID',
      'EXPORT_TOO_LARGE',
      'IDEMPOTENCY_KEY_REQUIRED',
      'IDEMPOTENCY_KEY_REUSED',
      'IDEMPOTENCY_IN_PROGRESS',
      'FILE_STORAGE_UNAVAILABLE',
      'PERMISSION_DENIED',
      'VALIDATION_FAILED',
    ],
  })
  async create(
    @Body() body: CreateExportDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request & { auth?: AuthPrincipal },
  ): Promise<ExportResponseDto> {
    const actor = request.auth!;
    return this.exports.create({
      plantilla: body.plantilla,
      formato: body.formato,
      parametros: body.parametros,
      idempotencyKey: idempotencyKey ?? null,
      actor: { userId: actor.userId, actorProfile: actor.actorProfile },
      context: buildRequestContext(request),
    });
  }
}
