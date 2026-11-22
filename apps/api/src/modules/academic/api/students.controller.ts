import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
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
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { StudentService } from '../application/student.service.js';
import {
  CreateStudentDto,
  PaginatedStudentsDto,
  PaginationQueryDto,
  StudentResponseDto,
  UpdateStudentDto,
} from './dto/academic.dto.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';

const STUDENT_ERRORS = [
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'CONSENT_REQUIRED',
  'STUDENT_DUPLICATE',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_IN_PROGRESS',
];

@ApiTags('académico — estudiantes')
@ApiBearerAuth('bearerAuth')
@Controller('academic/students')
export class StudentsController {
  constructor(@Inject(StudentService) private readonly students: StudentService) {}

  @Get()
  @RequirePermissions('academic:student:manage')
  @ApiOperation({
    operationId: 'listStudents',
    summary: 'Listar estudiantes',
    description:
      'Listado de datos mínimos. Nunca incluye documento, dirección ni teléfono; el acceso se audita antes de responder.',
  })
  @ApiOkResponse({ type: PaginatedStudentsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:student:manage'],
    scope: 'global',
    auditEvent: 'estudiante.listado',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async list(
    @Query() query: PaginationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedStudentsDto> {
    return this.students.list({ page: query.page, pageSize: query.pageSize }, actorOf(request));
  }

  @Post()
  @RequirePermissions('academic:student:manage')
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'createStudent',
    summary: 'Registrar estudiante',
    description:
      'La PII se cifra antes de persistir y el documento se indexa solo por HMAC. Requiere consentimiento aceptado e `Idempotency-Key`.',
  })
  @ApiCreatedResponse({ type: StudentResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:student:manage'],
    scope: 'global',
    auditEvent: 'estudiante.creado',
    errorCodes: STUDENT_ERRORS,
  })
  async create(
    @Body() body: CreateStudentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<StudentResponseDto> {
    return this.students.create(
      {
        usuarioId: body.usuarioId ?? null,
        tipoDocumento: body.tipoDocumento,
        numeroDocumento: body.numeroDocumento,
        nombres: body.nombres,
        apellidos: body.apellidos,
        fechaNacimiento: body.fechaNacimiento ?? null,
        municipio: body.municipio ?? null,
        barrio: body.barrio ?? null,
        direccion: body.direccion ?? null,
        telefono: body.telefono ?? null,
        consentimientoDatos: body.consentimientoDatos,
      },
      actorOf(request),
      idempotencyKey ?? null,
    );
  }

  @Patch(':id')
  @RequirePermissions('academic:student:manage')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateStudent',
    summary: 'Actualizar ficha de estudiante',
    description:
      'Recalcula el índice ciego si cambia el documento. La auditoría registra solo qué campos cambiaron, nunca su valor.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: StudentResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:student:manage'],
    scope: 'global',
    auditEvent: 'estudiante.actualizado',
    errorCodes: STUDENT_ERRORS,
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateStudentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<StudentResponseDto> {
    return this.students.update(id, body, actorOf(request));
  }
}
