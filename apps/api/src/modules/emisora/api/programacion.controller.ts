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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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
} from '@nestjs/swagger';

import { ApiQueryParams } from '../../../openapi/api-query-params.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { ProgramacionService } from '../application/programacion.service.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';
import {
  CreateProgramacionDto,
  ProgramacionQueryDto,
  ProgramacionTransitionDto,
} from './dto/emisora.dto.js';

const ERRORES = [
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_STATE_TRANSITION',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_IN_PROGRESS',
  'SCHEDULE_OVERLAP',
];

@ApiTags('emisora — programación diaria')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/programacion-diaria')
export class ProgramacionController {
  constructor(@Inject(ProgramacionService) private readonly service: ProgramacionService) {}

  @ApiBody({ type: CreateProgramacionDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:programacion:create')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'createEmisoraProgramacion',
    summary: 'Crear la programación diaria y verificarla contra la rejilla',
    description: 'RF-01.1…01.3: las desviaciones se registran sin alterar la rejilla.',
  })
  @ApiCreatedResponse({ description: 'Programación creada en borrador.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:programacion:create'],
    scope: 'global',
    auditEvent: 'programacion.creada',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateProgramacionDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(
      {
        rejillaAnualId: body.rejillaAnualId,
        fecha: body.fecha,
        items: body.items.map((item) => ({
          fecha: item.fecha,
          horaInicio: item.horaInicio,
          horaFin: item.horaFin,
          tipo: item.tipo,
          programaId: item.programaId ?? null,
          titulo: item.titulo,
        })),
      },
      actorOf(request),
      clave ?? null,
    );
  }

  @Get()
  @ApiQueryParams(ProgramacionQueryDto)
  @RequirePermissions('emisora:programacion:read')
  @ApiOperation({
    operationId: 'getEmisoraProgramacion',
    summary: 'Consultar la programación de una fecha',
  })
  @ApiOkResponse({ description: 'Programación con franjas y desviaciones.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:programacion:read'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Consulta de solo lectura sobre datos no sensibles.',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  get(@Query() query: ProgramacionQueryDto) {
    return this.service.getByFecha(query.fecha);
  }

  @ApiBody({ type: ProgramacionTransitionDto })
  @Post(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:programacion:update')
  @ApiOperation({
    operationId: 'transitionEmisoraProgramacion',
    summary: 'Aprobar la programación diaria',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Programación aprobada.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:programacion:update'],
    scope: 'global',
    auditEvent: 'programacion.aprobada',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ProgramacionTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transition(id, body.to, actorOf(request));
  }
}
