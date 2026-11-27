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
  Put,
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
import { GroupService } from '../application/group.service.js';
import {
  CreateGroupDto,
  GroupResponseDto,
  GroupTransitionDto,
  PaginatedGroupsDto,
  PaginationQueryDto,
  ReplaceScheduleDto,
  ScheduleResponseDto,
} from './dto/academic.dto.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';

const GROUP_ERRORS = [
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_PERIOD',
  'INVALID_STATE_TRANSITION',
  'EDUCATOR_INVALID',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_IN_PROGRESS',
];

@ApiTags('académico — grupos y horarios')
@ApiBearerAuth('bearerAuth')
@Controller('academic/groups')
export class GroupsController {
  constructor(@Inject(GroupService) private readonly groups: GroupService) {}

  @ApiQueryParams(PaginationQueryDto)
  @Get()
  @RequirePermissions('academic:group:manage', 'academic:group:read_own')
  @ApiOperation({
    operationId: 'listGroups',
    summary: 'Listar grupos',
    description:
      'El administrador ve todos; el educador ve únicamente los grupos donde figura como educador.',
  })
  @ApiOkResponse({ type: PaginatedGroupsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:group:manage', 'academic:group:read_own'],
    scope: 'mixed',
    auditEvent: '-',
    auditExempt: 'Listado de solo lectura filtrado por ámbito.',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async list(
    @Query() query: PaginationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedGroupsDto> {
    return this.groups.list({ page: query.page, pageSize: query.pageSize }, actorOf(request));
  }

  @ApiBody({ type: CreateGroupDto })
  @Post()
  @RequirePermissions('academic:group:manage')
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'createGroup',
    summary: 'Crear grupo',
    description: 'El periodo sigue el formato `YYYY-P`. `Idempotency-Key` obligatoria.',
  })
  @ApiCreatedResponse({ type: GroupResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:group:manage'],
    scope: 'global',
    auditEvent: 'grupo.creado',
    errorCodes: GROUP_ERRORS,
  })
  async create(
    @Body() body: CreateGroupDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<GroupResponseDto> {
    return this.groups.create(
      {
        programaId: body.programaId,
        codigo: body.codigo,
        educadorId: body.educadorId,
        salon: body.salon ?? null,
        periodo: body.periodo,
        cupoMaximo: body.cupoMaximo,
      },
      actorOf(request),
      idempotencyKey ?? null,
    );
  }

  @ApiBody({ type: GroupTransitionDto })
  @Post(':id/transitions')
  @RequirePermissions('academic:group:manage')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'transitionGroup',
    summary: 'Cerrar un grupo',
    description: 'Máquina de estados `abierto → cerrado`.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: GroupResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:group:manage'],
    scope: 'global',
    auditEvent: 'grupo.<estado>',
    errorCodes: [
      'PERMISSION_DENIED',
      'RESOURCE_NOT_FOUND',
      'VALIDATION_FAILED',
      'INVALID_STATE_TRANSITION',
    ],
  })
  async transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: GroupTransitionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GroupResponseDto> {
    return this.groups.transition(id, body.to, actorOf(request));
  }

  @Get(':id/schedule')
  @RequirePermissions(
    'academic:group:manage',
    'academic:schedule:read',
    'academic:schedule:read_own',
  )
  @ApiOperation({
    operationId: 'getGroupSchedule',
    summary: 'Consultar el horario de un grupo',
    description:
      'Disponible para administración, educador dueño y estudiante matriculado. Un grupo ajeno responde 404.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ScheduleResponseDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:group:manage', 'academic:schedule:read', 'academic:schedule:read_own'],
    scope: 'mixed',
    auditEvent: '-',
    auditExempt: 'Consulta de horario sin mutación de estado.',
    errorCodes: ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'VALIDATION_FAILED'],
  })
  async getSchedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ScheduleResponseDto> {
    return { items: await this.groups.getSchedule(id, actorOf(request)) };
  }

  @ApiBody({ type: ReplaceScheduleDto })
  @Put(':id/schedule')
  @RequirePermissions('academic:group:manage')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'replaceGroupSchedule',
    summary: 'Reemplazar el horario de un grupo',
    description:
      'Operación atómica: valida franjas y solapamiento por educador y salón dentro del periodo; publica `horario.modificado` por outbox.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ScheduleResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:group:manage'],
    scope: 'global',
    auditEvent: 'horario.modificado',
    errorCodes: [
      'PERMISSION_DENIED',
      'RESOURCE_NOT_FOUND',
      'VALIDATION_FAILED',
      'SCHEDULE_OVERLAP',
      'SCHEDULE_INVALID_RANGE',
    ],
  })
  async replaceSchedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReplaceScheduleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ScheduleResponseDto> {
    return {
      items: await this.groups.replaceSchedule(
        id,
        body.franjas.map((slot) => ({
          diaSemana: slot.diaSemana,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
        })),
        actorOf(request),
      ),
    };
  }
}
