import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
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
import { SessionService } from '../application/session.service.js';
import { PaginatedSessionsDto, PaginationQueryDto } from './dto/academic.dto.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';

@ApiTags('académico — sesiones de clase')
@ApiBearerAuth('bearerAuth')
@Controller('academic/groups/:groupId/sessions')
export class GroupSessionsController {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  @Get()
  @RequirePermissions('academic:group:manage', 'academic:group:read_own')
  @ApiOperation({
    operationId: 'listGroupSessions',
    summary: 'Listar sesiones de un grupo',
    description: 'Administración, educador dueño o estudiante matriculado; ajeno responde 404.',
  })
  @ApiParam({ name: 'groupId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: PaginatedSessionsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['academic:group:manage', 'academic:group:read_own'],
    scope: 'mixed',
    auditEvent: '-',
    auditExempt: 'Listado de solo lectura filtrado por ámbito.',
    errorCodes: ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'VALIDATION_FAILED'],
  })
  async list(
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Query() query: PaginationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedSessionsDto> {
    return this.sessions.listByGroup(
      groupId,
      { page: query.page, pageSize: query.pageSize },
      actorOf(request),
    );
  }
}
