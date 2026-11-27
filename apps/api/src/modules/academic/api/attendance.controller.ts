import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { AttendanceService } from '../application/attendance.service.js';
import { AttendanceListResponseDto, ReplaceAttendanceDto } from './dto/academic.dto.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';

@ApiTags('académico — asistencia')
@ApiBearerAuth('bearerAuth')
@Controller('academic/sessions/:sessionId/attendance')
export class AttendanceController {
  constructor(@Inject(AttendanceService) private readonly attendance: AttendanceService) {}

  @ApiBody({ type: ReplaceAttendanceDto })
  @Put()
  @RequirePermissions('academic:attendance:create')
  @ApiOperation({
    operationId: 'replaceAttendance',
    summary: 'Registrar o corregir la asistencia de una sesión',
    description:
      'R-010: el cuerpo reemplaza el conjunto completo y es idempotente por estado resultante. Solo sesiones `realizadas`.',
  })
  @ApiParam({ name: 'sessionId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AttendanceListResponseDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:attendance:create'],
    scope: 'group',
    auditEvent: 'asistencia.registrada',
    errorCodes: [
      'PERMISSION_DENIED',
      'RESOURCE_NOT_FOUND',
      'VALIDATION_FAILED',
      'INVALID_STATE_TRANSITION',
      'ATTENDANCE_INVALID_ENROLLMENT',
    ],
  })
  async replace(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() body: ReplaceAttendanceDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AttendanceListResponseDto> {
    const registros = await this.attendance.replace(sessionId, body.registros, actorOf(request));
    return { registros, total: registros.length };
  }

  @Get()
  @RequirePermissions('academic:attendance:read')
  @ApiOperation({
    operationId: 'getSessionAttendance',
    summary: 'Consultar la asistencia de una sesión',
  })
  @ApiParam({ name: 'sessionId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AttendanceListResponseDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:attendance:read'],
    scope: 'group',
    auditEvent: '-',
    auditExempt: 'Consulta de solo lectura dentro del grupo del educador.',
    errorCodes: ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'INVALID_STATE_TRANSITION'],
  })
  async list(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<AttendanceListResponseDto> {
    const registros = await this.attendance.listBySession(sessionId, actorOf(request));
    return { registros, total: registros.length };
  }
}
