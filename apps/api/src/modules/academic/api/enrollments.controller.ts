import { ApiQueryParams } from '../../../openapi/api-query-params.js';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
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
  ApiBody,
} from '@nestjs/swagger';

import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { EnrollmentService } from '../application/enrollment.service.js';
import {
  CreateEnrollmentDto,
  EnrollmentResponseDto,
  EnrollmentTransitionDto,
  PaginatedEnrollmentsDto,
  PaginationQueryDto,
} from './dto/academic.dto.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';

const ENROLLMENT_ERRORS = [
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_PERIOD',
  'GROUP_CLOSED',
  'GROUP_CAPACITY_EXCEEDED',
  'ENROLLMENT_DUPLICATE',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_IN_PROGRESS',
];

@ApiTags('académico — matrículas')
@ApiBearerAuth('bearerAuth')
@Controller('academic/enrollments')
export class EnrollmentsController {
  constructor(@Inject(EnrollmentService) private readonly enrollments: EnrollmentService) {}

  @ApiQueryParams(PaginationQueryDto)
  @Get()
  @RequirePermissions('academic:enrollment:read')
  @ApiOperation({
    operationId: 'listEnrollments',
    summary: 'Roster de matrículas',
    description:
      'La administración ve todas; el educador únicamente las de sus grupos. Nunca se filtra por documento.',
  })
  @ApiOkResponse({ type: PaginatedEnrollmentsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:enrollment:read'],
    scope: 'group',
    auditEvent: '-',
    auditExempt: 'Listado de solo lectura filtrado por grupo.',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async list(
    @Query() query: PaginationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedEnrollmentsDto> {
    return this.enrollments.list(actorOf(request), {
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @ApiBody({ type: CreateEnrollmentDto })
  @Post()
  @RequirePermissions('academic:enrollment:create')
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'createEnrollment',
    summary: 'Crear matrícula',
    description:
      'La matrícula nace `preinscrita`. Valida grupo abierto, periodo y duplicados vigentes. `Idempotency-Key` obligatoria.',
  })
  @ApiCreatedResponse({ type: EnrollmentResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:enrollment:create'],
    scope: 'global',
    auditEvent: 'matricula.creada',
    errorCodes: ENROLLMENT_ERRORS,
  })
  async create(
    @Body() body: CreateEnrollmentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<EnrollmentResponseDto> {
    return this.enrollments.create(
      {
        estudianteId: body.estudianteId,
        grupoId: body.grupoId,
        periodo: body.periodo ?? null,
      },
      actorOf(request),
      idempotencyKey ?? null,
    );
  }

  @ApiBody({ type: EnrollmentTransitionDto })
  @Post(':id/transitions')
  @RequirePermissions('academic:enrollment:update')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'transitionEnrollment',
    summary: 'Transición de estado de matrícula',
    description:
      'Al confirmar valida cupo del grupo dentro de la misma transacción; el evento de notificación se escribe en la outbox.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: EnrollmentResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:enrollment:update'],
    scope: 'global',
    auditEvent: 'matricula.<estado>',
    errorCodes: [...ENROLLMENT_ERRORS, 'INVALID_STATE_TRANSITION'],
  })
  async transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: EnrollmentTransitionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EnrollmentResponseDto> {
    return this.enrollments.transition(id, body.to, actorOf(request));
  }
}
