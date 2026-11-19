import { Controller, Get, Inject, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { AllowPasswordChange, AuthenticatedOnly } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { MeService } from '../application/me.service.js';
import { MeResponseDto } from './dto/auth-response.dto.js';

@ApiTags('identidad')
@ApiBearerAuth('bearerAuth')
@Controller('me')
export class MeController {
  constructor(@Inject(MeService) private readonly me: MeService) {}

  @Get()
  @AuthenticatedOnly()
  @AllowPasswordChange()
  @ApiOperation({
    operationId: 'getMe',
    summary: 'Perfil efectivo del usuario autenticado',
    description:
      'Devuelve la identidad, los perfiles vigentes y los permisos expandidos. No concede permisos: solo informa lo calculado en el servidor.',
  })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'authenticated',
    scope: 'own',
    auditEvent: '-',
    auditExempt: 'Consulta de solo lectura sobre la propia identidad; no muta estado.',
    errorCodes: ['AUTH_TOKEN_INVALID', 'AUTH_TOKEN_EXPIRED', 'AUTH_TOKEN_REVOKED'],
  })
  get(@Req() request: Request & { auth?: AuthPrincipal }): MeResponseDto {
    return this.me.build(request.auth!);
  }
}
