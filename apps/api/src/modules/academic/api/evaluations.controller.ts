import { ApiQueryParams } from '../../../openapi/api-query-params.js';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBody,
} from '@nestjs/swagger';

import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { EvaluationService } from '../application/evaluation.service.js';
import {
  CreateEvaluationDto,
  EvaluationResponseDto,
  PaginatedEvaluationsDto,
  PaginationQueryDto,
  UpdateEvaluationDto,
} from './dto/academic.dto.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';

const EVALUATION_ERRORS = [
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_PERIOD',
  'EVALUATION_SCALE_INVALID',
  'EVALUATION_DUPLICATE',
];

@ApiTags('académico — evaluación cualitativa')
@ApiBearerAuth('bearerAuth')
@Controller('academic/evaluations')
export class EvaluationsController {
  constructor(@Inject(EvaluationService) private readonly evaluations: EvaluationService) {}

  @ApiBody({ type: CreateEvaluationDto })
  @Post()
  @RequirePermissions('academic:evaluation:create')
  @ApiCreatedResponse({ type: EvaluationResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiOperation({
    operationId: 'createEvaluation',
    summary: 'Registrar evaluación cualitativa',
    description: 'Única por matrícula, indicador y periodo; observación redactada en auditoría.',
  })
  @ApiContract({
    access: 'permission',
    permission: ['academic:evaluation:create'],
    scope: 'group',
    auditEvent: 'evaluacion.registrada',
    errorCodes: EVALUATION_ERRORS,
  })
  async create(
    @Body() body: CreateEvaluationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EvaluationResponseDto> {
    return this.evaluations.create(
      {
        matriculaId: body.matriculaId,
        indicadorId: body.indicadorId,
        periodo: body.periodo,
        valor: body.valor,
        observacion: body.observacion ?? null,
      },
      actorOf(request),
    );
  }

  @ApiQueryParams(PaginationQueryDto)
  @Get()
  @RequirePermissions('academic:evaluation:read')
  @ApiOkResponse({ type: PaginatedEvaluationsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiOperation({
    operationId: 'listEvaluations',
    summary: 'Listar evaluaciones del educador',
  })
  @ApiContract({
    access: 'permission',
    permission: ['academic:evaluation:read'],
    scope: 'group',
    auditEvent: '-',
    auditExempt: 'Listado de solo lectura filtrado por ámbito.',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async list(
    @Query() query: PaginationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedEvaluationsDto> {
    return this.evaluations.list({ page: query.page, pageSize: query.pageSize }, actorOf(request));
  }

  @ApiBody({ type: UpdateEvaluationDto })
  @Patch(':id')
  @RequirePermissions('academic:evaluation:update')
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: EvaluationResponseDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiOperation({
    operationId: 'updateEvaluation',
    summary: 'Corregir una evaluación',
  })
  @ApiContract({
    access: 'permission',
    permission: ['academic:evaluation:update'],
    scope: 'group',
    auditEvent: 'evaluacion.actualizada',
    errorCodes: [
      'PERMISSION_DENIED',
      'RESOURCE_NOT_FOUND',
      'VALIDATION_FAILED',
      'EVALUATION_SCALE_INVALID',
    ],
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateEvaluationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EvaluationResponseDto> {
    return this.evaluations.update(
      id,
      { valor: body.valor, observacion: body.observacion ?? null },
      actorOf(request),
    );
  }
}
