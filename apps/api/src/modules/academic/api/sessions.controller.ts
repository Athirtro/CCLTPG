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
import { SessionService } from '../application/session.service.js';
import { CreateSessionDto, SessionResponseDto, SessionTransitionDto } from './dto/academic.dto.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';

const SESSION_ERRORS = [
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_STATE_TRANSITION',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_IN_PROGRESS',
];

@ApiTags('académico — sesiones de clase')
@ApiBearerAuth('bearerAuth')
@Controller('academic/sessions')
export class SessionsController {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  @ApiBody({ type: CreateSessionDto })
  @Post()
  @RequirePermissions('academic:session:create')
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'createSession',
    summary: 'Crear sesión de clase',
    description: 'La sesión nace `programada`; `Idempotency-Key` obligatoria.',
  })
  @ApiCreatedResponse({ type: SessionResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:session:create'],
    scope: 'group',
    auditEvent: 'clase.creada',
    errorCodes: SESSION_ERRORS,
  })
  async create(
    @Body() body: CreateSessionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionResponseDto> {
    return this.sessions.create(
      { grupoId: body.grupoId, fecha: body.fecha, tema: body.tema ?? null },
      actorOf(request),
      idempotencyKey ?? null,
    );
  }

  @ApiBody({ type: SessionTransitionDto })
  @Post(':id/transitions')
  @RequirePermissions('academic:session:update')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'transitionSession',
    summary: 'Marcar sesión como realizada o cancelada',
    description: 'Máquina de estados `programada → realizada|cancelada`.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:session:update'],
    scope: 'group',
    auditEvent: 'clase.<estado>',
    errorCodes: SESSION_ERRORS,
  })
  async transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SessionTransitionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionResponseDto> {
    return this.sessions.transition(id, body.to, actorOf(request));
  }

  @Get(':id')
  @RequirePermissions('academic:group:manage', 'academic:group:read_own')
  @ApiOperation({
    operationId: 'getSession',
    summary: 'Consultar una sesión',
    description: 'Administración, educador dueño o estudiante matriculado; ajeno responde 404.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:group:manage', 'academic:group:read_own'],
    scope: 'mixed',
    auditEvent: '-',
    auditExempt: 'Consulta de solo lectura filtrada por ámbito.',
    errorCodes: ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND'],
  })
  async get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionResponseDto> {
    return this.sessions.get(id, actorOf(request));
  }
}
