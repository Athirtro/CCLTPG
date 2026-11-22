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

import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { EnrollmentService } from '../application/enrollment.service.js';
import { GroupService } from '../application/group.service.js';
import { StudentService } from '../application/student.service.js';
import {
  PaginatedEnrollmentsDto,
  PaginationQueryDto,
  ScheduleResponseDto,
  StudentResponseDto,
} from './dto/academic.dto.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';

/**
 * Vistas propias (R-011): el identificador del estudiante nunca viene del
 * cliente, sino de la sesión autenticada.
 */
@ApiTags('académico — vistas propias')
@ApiBearerAuth('bearerAuth')
@Controller('me')
export class MeAcademicController {
  constructor(
    @Inject(StudentService) private readonly students: StudentService,
    @Inject(EnrollmentService) private readonly enrollments: EnrollmentService,
    @Inject(GroupService) private readonly groups: GroupService,
  ) {}

  @Get('student')
  @RequirePermissions('academic:student:read_own')
  @ApiOperation({
    operationId: 'getMyStudent',
    summary: 'Ficha propia del estudiante',
    description: 'Un usuario sin vínculo de estudiante responde 404 `RESOURCE_NOT_FOUND`.',
  })
  @ApiOkResponse({ type: StudentResponseDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:student:read_own'],
    scope: 'own',
    auditEvent: '-',
    auditExempt: 'Consulta propia de datos sensibles; no se registra la PII en auditoría.',
    errorCodes: ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND'],
  })
  async getMyStudent(@Req() request: AuthenticatedRequest): Promise<StudentResponseDto> {
    return this.students.getMine(actorOf(request));
  }

  @Get('enrollments')
  @RequirePermissions('academic:enrollment:read_own')
  @ApiOperation({
    operationId: 'getMyEnrollments',
    summary: 'Matrículas propias',
    description: 'Un usuario sin vínculo de estudiante recibe una colección vacía.',
  })
  @ApiOkResponse({ type: PaginatedEnrollmentsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:enrollment:read_own'],
    scope: 'own',
    auditEvent: '-',
    auditExempt: 'Consulta propia paginada sin mutación de estado.',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async getMyEnrollments(
    @Query() query: PaginationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedEnrollmentsDto> {
    return this.enrollments.listMine(actorOf(request), {
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get('schedule')
  @RequirePermissions('academic:schedule:read_own')
  @ApiOperation({
    operationId: 'getMySchedule',
    summary: 'Horario propio',
    description: 'Solo las franjas de grupos con matrícula vigente del estudiante vinculado.',
  })
  @ApiOkResponse({ type: ScheduleResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:schedule:read_own'],
    scope: 'own',
    auditEvent: '-',
    auditExempt: 'Consulta propia de solo lectura.',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async getMySchedule(@Req() request: AuthenticatedRequest): Promise<ScheduleResponseDto> {
    return { items: await this.groups.mySchedule(actorOf(request)) };
  }
}
