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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
  ApiBody,
} from '@nestjs/swagger';
import { ApiQueryParams } from '../../../openapi/api-query-params.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';
import { ProgramService } from '../application/program.service.js';
import {
  CreateProgramDto,
  PaginatedProgramsDto,
  PaginationQueryDto,
  ProgramResponseDto,
  ProgramTransitionDto,
} from './dto/academic.dto.js';

const PROGRAM_ERRORS = [
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_STATE_TRANSITION',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_IN_PROGRESS',
];

@ApiTags('académico — programas')
@ApiBearerAuth('bearerAuth')
@Controller('academic/programs')
export class ProgramsController {
  constructor(@Inject(ProgramService) private readonly programs: ProgramService) {}

  @ApiQueryParams(PaginationQueryDto)
  @Get()
  @RequirePermissions('academic:program:manage')
  @ApiOperation({ operationId: 'listPrograms', summary: 'Listar programas formativos' })
  @ApiOkResponse({ type: PaginatedProgramsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:program:manage'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Listado de solo lectura sobre datos no sensibles.',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async list(@Query() query: PaginationQueryDto): Promise<PaginatedProgramsDto> {
    return this.programs.list({ page: query.page, pageSize: query.pageSize });
  }

  @ApiBody({ type: CreateProgramDto })
  @Post()
  @RequirePermissions('academic:program:manage')
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'createProgram',
    summary: 'Crear programa formativo',
    description: 'El programa nace en estado `borrador`. `Idempotency-Key` obligatoria.',
  })
  @ApiCreatedResponse({ type: ProgramResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnsupportedMediaTypeResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:program:manage'],
    scope: 'global',
    auditEvent: 'programa.creado',
    errorCodes: PROGRAM_ERRORS,
  })
  async create(
    @Body() body: CreateProgramDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProgramResponseDto> {
    return this.programs.create(
      {
        nombre: body.nombre,
        descripcion: body.descripcion ?? null,
        area: body.area,
        cupoMaximo: body.cupoMaximo,
      },
      actorOf(request),
      idempotencyKey ?? null,
    );
  }

  @ApiBody({ type: ProgramTransitionDto })
  @Post(':id/transitions')
  @RequirePermissions('academic:program:manage')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'transitionProgram',
    summary: 'Transición de estado del programa',
    description: 'Máquina de estados `borrador → publicado → archivado`.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ProgramResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:program:manage'],
    scope: 'global',
    auditEvent: 'programa.<estado>',
    errorCodes: PROGRAM_ERRORS,
  })
  async transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ProgramTransitionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProgramResponseDto> {
    return this.programs.transition(id, body.to, actorOf(request));
  }
}
