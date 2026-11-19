import {
  Body,
  Controller,
  Get,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { buildRequestContext } from '../../../shared/http/request-context.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { IdentityAdminService } from '../application/identity-admin.service.js';
import { AssignProfileDto, CreateUserDto, TransitionDto, UpdateUserDto } from './dto/auth.dto.js';
import { ListUsersQueryDto } from './dto/auth-response.dto.js';

type AdminRequest = Request & { auth?: AuthPrincipal };

/**
 * Operaciones administrativas de identidad (OP-06…OP-10).
 * Todas comparten `identity:user:manage`; el ámbito es global (regla E7) y el
 * `actor_perfil` se atribuye al perfil que realmente otorgó el permiso.
 */
@ApiTags('identidad')
@ApiBearerAuth('bearerAuth')
@Controller('identity/users')
export class IdentityController {
  constructor(@Inject(IdentityAdminService) private readonly admin: IdentityAdminService) {}

  @Get()
  @RequirePermissions('identity:user:manage')
  @ApiOperation({
    operationId: 'listUsers',
    summary: 'Listado de usuarios',
    description:
      'Solo `identity:user:manage`. La consulta de PII genera `usuario.listado` con filtros y número de resultados, sin copiar filas.',
  })
  @ApiOkResponse({ description: 'Página de usuarios.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['identity:user:manage'],
    scope: 'global',
    auditEvent: 'usuario.listado',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  async list(@Query() query: ListUsersQueryDto, @Req() request: AdminRequest): Promise<unknown> {
    const page = await this.admin.list(
      {
        search: query.search,
        estado: query.estado,
        limit: query.limit,
        offset: query.offset,
      },
      request.auth!,
      buildRequestContext(request),
    );

    return { items: page.items, total: page.total, limit: query.limit, offset: query.offset };
  }

  @Post()
  @RequirePermissions('identity:user:manage')
  @ApiOperation({
    operationId: 'createUser',
    summary: 'Alta de usuario',
    description: 'El usuario nace con `debe_cambiar_password` y sin MFA.',
  })
  @ApiCreatedResponse({ description: 'Usuario creado.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['identity:user:manage'],
    scope: 'global',
    auditEvent: 'usuario.creado',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED', 'CONFLICT'],
  })
  async create(@Body() dto: CreateUserDto, @Req() request: AdminRequest): Promise<unknown> {
    const created = await this.admin.create(
      {
        email: dto.email,
        nombre: dto.nombre,
        password: dto.password,
        estado: dto.estado,
        profiles: dto.profiles.map((profile) => ({
          codigo: profile.codigo,
          validUntil: profile.validUntil ? new Date(profile.validUntil) : null,
        })),
      },
      request.auth!,
      buildRequestContext(request),
    );

    return this.present(created);
  }

  @Patch(':id')
  @RequirePermissions('identity:user:manage')
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOperation({
    operationId: 'updateUser',
    summary: 'Actualización administrativa',
    description:
      'Permite renombrar, resetear la contraseña (write-only, fuerza cambio) y resetear MFA.',
  })
  @ApiOkResponse({ description: 'Usuario actualizado.' })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['identity:user:manage'],
    scope: 'global',
    auditEvent: 'usuario.actualizado',
    errorCodes: ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'AUTH_PASSWORD_POLICY_VIOLATION'],
  })
  async update(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: AdminRequest,
  ): Promise<unknown> {
    const updated = await this.admin.update(
      id,
      { nombre: dto.nombre, password: dto.password, resetMfa: dto.resetMfa },
      request.auth!,
      buildRequestContext(request),
    );

    return this.present(updated);
  }

  @Post(':id/transitions')
  @RequirePermissions('identity:user:manage')
  @HttpCode(200)
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOperation({
    operationId: 'transitionUser',
    summary: 'Transición de estado',
    description:
      'Activa, desactiva o bloquea. Cualquier estado distinto de `activo` revoca sesiones.',
  })
  @ApiOkResponse({ description: 'Usuario con el nuevo estado.' })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['identity:user:manage'],
    scope: 'global',
    auditEvent: 'usuario.<estado>',
    errorCodes: ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'VALIDATION_FAILED'],
  })
  async transition(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: TransitionDto,
    @Req() request: AdminRequest,
  ): Promise<unknown> {
    const updated = await this.admin.transition(
      id,
      dto.to,
      dto.motivo ?? null,
      request.auth!,
      buildRequestContext(request),
    );

    return this.present(updated);
  }

  @Post(':id/profiles')
  @RequirePermissions('identity:user:manage')
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOperation({
    operationId: 'assignProfile',
    summary: 'Asignación de perfil',
    description:
      'Con `validUntil` crea una identidad temporal; el usuario queda obligado a MFA mientras esté vigente.',
  })
  @ApiCreatedResponse({ description: 'Perfil asignado.' })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['identity:user:manage'],
    scope: 'global',
    auditEvent: 'usuario.perfil_asignado',
    errorCodes: ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'VALIDATION_FAILED'],
  })
  async assignProfile(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: AssignProfileDto,
    @Req() request: AdminRequest,
  ): Promise<{ ok: true }> {
    await this.admin.assignProfile(
      id,
      dto.codigo,
      dto.validUntil ? new Date(dto.validUntil) : null,
      request.auth!,
      buildRequestContext(request),
    );

    return { ok: true };
  }

  /** Proyección pública: nunca expone hashes ni el secreto MFA. */
  private present(usuario: {
    id: string;
    email: string;
    nombre: string;
    estado: string;
    mfaHabilitado: boolean;
    debeCambiarPassword: boolean;
    creadoEn: Date;
    actualizadoEn: Date;
  }): Record<string, unknown> {
    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      estado: usuario.estado,
      mfaHabilitado: usuario.mfaHabilitado,
      debeCambiarPassword: usuario.debeCambiarPassword,
      creadoEn: usuario.creadoEn,
      actualizadoEn: usuario.actualizadoEn,
    };
  }
}
