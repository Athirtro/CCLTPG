import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { AUDIT_PORT, type AuditPort } from '../../../shared/audit/audit.port.js';
import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { AUTH_ERRORS } from '../../../shared/auth/error-codes.js';
import { emailHmac } from '../../../shared/security/hmac.js';
import { validatePassword } from '../domain/password-policy.js';
import type { EstadoUsuario, RequestContext, UsuarioSnapshot } from '../domain/identity.types.js';
import { AuthError } from './auth-error.js';
import { Clock } from './ports/clock.js';
import {
  IdentityRepository,
  type UserListFilter,
  type UserListRow,
} from './ports/identity.repository.js';
import { PasswordHasher } from './ports/password-hasher.js';
import { UnitOfWork } from './ports/unit-of-work.js';

export interface CreateUserCommand {
  email: string;
  nombre: string;
  password: string;
  estado?: EstadoUsuario;
  profiles: Array<{ codigo: string; validUntil?: Date | null }>;
}

export interface UpdateUserCommand {
  nombre?: string;
  password?: string;
  resetMfa?: boolean;
}

@Injectable()
export class IdentityAdminService {
  constructor(
    @Inject(IdentityRepository) private readonly identity: IdentityRepository,
    @Inject(PasswordHasher) private readonly hasher: PasswordHasher,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  async list(
    filter: Omit<UserListFilter, 'limit' | 'offset'> & { limit: number; offset: number },
    actor: AuthPrincipal,
    context: RequestContext,
  ): Promise<{ items: UserListRow[]; total: number }> {
    const [items, total] = await Promise.all([
      this.identity.listUsers(filter),
      this.identity.countUsers(filter),
    ]);

    await this.audit.record({
      accion: 'usuario.listado',
      recurso: 'usuario',
      actorId: actor.userId,
      actorPerfil: actor.actorProfile,
      ip: context.ip,
      dispositivo: context.userAgent,
      datosDespues: {
        filtros: {
          search: filter.search ?? null,
          estado: filter.estado ?? null,
          limit: filter.limit,
          offset: filter.offset,
        },
        resultados: total,
      },
      requestId: context.requestId,
    });

    return { items, total };
  }

  async create(
    command: CreateUserCommand,
    actor: AuthPrincipal,
    context: RequestContext,
  ): Promise<UsuarioSnapshot> {
    const email = command.email.trim().toLowerCase();
    const existing = await this.identity.findByEmail(email);
    if (existing) {
      throw new AuthError(
        AUTH_ERRORS.validationFailed,
        HttpStatus.BAD_REQUEST,
        'Ya existe un usuario con ese correo.',
      );
    }

    const violations = validatePassword(command.password, email);
    if (violations.length > 0) {
      throw AuthError.passwordPolicy(violations);
    }

    const profiles: Array<{ id: string; codigo: string; validUntil: Date | null }> = [];
    for (const profile of command.profiles) {
      const found = await this.identity.findPerfilByCodigo(profile.codigo);
      if (!found) {
        throw new AuthError(
          AUTH_ERRORS.validationFailed,
          HttpStatus.BAD_REQUEST,
          'Perfil inexistente.',
        );
      }
      profiles.push({ ...found, validUntil: profile.validUntil ?? null });
    }

    const id = uuidv7();
    const passwordHash = await this.hasher.hash(command.password);
    const estado = command.estado ?? 'activo';

    await this.unitOfWork.run(async (tx) => {
      await tx.identity.createUser({
        id,
        email,
        nombre: command.nombre.trim(),
        passwordHash,
        estado,
        debeCambiarPassword: true,
      });

      for (const profile of profiles) {
        await tx.identity.assignProfile({
          id: uuidv7(),
          usuarioId: id,
          perfilId: profile.id,
          validUntil: profile.validUntil,
          asignadoPor: actor.userId,
        });
      }

      await tx.audit.record({
        accion: 'usuario.creado',
        recurso: 'usuario',
        recursoId: id,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: context.ip,
        dispositivo: context.userAgent,
        datosDespues: {
          email_hmac: emailHmac(email),
          estado,
          perfiles: profiles.map((profile) => profile.codigo),
        },
        requestId: context.requestId,
      });
    });

    const created = await this.identity.findById(id);
    if (!created) {
      throw new Error('El usuario recién creado no se pudo leer.');
    }
    return created;
  }

  async update(
    usuarioId: string,
    command: UpdateUserCommand,
    actor: AuthPrincipal,
    context: RequestContext,
  ): Promise<UsuarioSnapshot> {
    const usuario = await this.identity.findById(usuarioId);
    if (!usuario) {
      throw new AuthError(
        AUTH_ERRORS.resourceNotFound,
        HttpStatus.NOT_FOUND,
        'Usuario inexistente.',
      );
    }

    if (command.password) {
      const violations = validatePassword(command.password, usuario.email);
      if (violations.length > 0) {
        throw AuthError.passwordPolicy(violations);
      }
      const passwordHash = await this.hasher.hash(command.password);

      await this.unitOfWork.run(async (tx) => {
        await tx.identity.updatePasswordHash(usuario.id, passwordHash, this.clock.now());
        await tx.identity.setMustChangePassword(usuario.id, true, this.clock.now());
        const revoked = await tx.sessions.revokeUserFamilies(usuario.id, null, this.clock.now());
        await tx.audit.record({
          accion: 'usuario.password_reseteada',
          recurso: 'usuario',
          recursoId: usuario.id,
          actorId: actor.userId,
          actorPerfil: actor.actorProfile,
          ip: context.ip,
          dispositivo: context.userAgent,
          datosDespues: { sesiones_revocadas: revoked, forzado: true },
          requestId: context.requestId,
        });
      });
    }

    if (command.resetMfa) {
      await this.unitOfWork.run(async (tx) => {
        await tx.identity.disableMfa(usuario.id, this.clock.now());
        await tx.identity.setMfaSecretCifrado(usuario.id, null, this.clock.now());
        await tx.identity.deleteRecoveryCodes(usuario.id);
        await tx.audit.record({
          accion: 'usuario.mfa_reset',
          recurso: 'usuario',
          recursoId: usuario.id,
          actorId: actor.userId,
          actorPerfil: actor.actorProfile,
          ip: context.ip,
          dispositivo: context.userAgent,
          datosAntes: { mfa_habilitado: usuario.mfaHabilitado },
          datosDespues: { mfa_habilitado: false, motivo: 'reset_administrativo' },
          requestId: context.requestId,
        });
      });
    }

    if (command.nombre && command.nombre.trim() !== usuario.nombre) {
      await this.unitOfWork.run(async (tx) => {
        await tx.identity.updateNombre(usuario.id, command.nombre!.trim(), this.clock.now());
        await tx.audit.record({
          accion: 'usuario.actualizado',
          recurso: 'usuario',
          recursoId: usuario.id,
          actorId: actor.userId,
          actorPerfil: actor.actorProfile,
          ip: context.ip,
          dispositivo: context.userAgent,
          datosAntes: { nombre: usuario.nombre },
          datosDespues: { nombre: command.nombre!.trim() },
          requestId: context.requestId,
        });
      });
    }

    const updated = await this.identity.findById(usuario.id);
    if (!updated) {
      throw new Error('El usuario actualizado no se pudo leer.');
    }
    return updated;
  }

  async transition(
    usuarioId: string,
    to: EstadoUsuario,
    motivo: string | null,
    actor: AuthPrincipal,
    context: RequestContext,
  ): Promise<UsuarioSnapshot> {
    const usuario = await this.identity.findById(usuarioId);
    if (!usuario) {
      throw new AuthError(
        AUTH_ERRORS.resourceNotFound,
        HttpStatus.NOT_FOUND,
        'Usuario inexistente.',
      );
    }

    if (usuario.estado === to) {
      return usuario;
    }

    await this.unitOfWork.run(async (tx) => {
      await tx.identity.setEstado(usuario.id, to, this.clock.now());
      if (to !== 'activo') {
        await tx.sessions.revokeUserFamilies(usuario.id, null, this.clock.now());
      }
      const accion =
        to === 'activo'
          ? usuario.estado === 'bloqueado'
            ? 'usuario.desbloqueado'
            : 'usuario.activado'
          : to === 'inactivo'
            ? 'usuario.desactivado'
            : 'usuario.bloqueado';

      await tx.audit.record({
        accion,
        recurso: 'usuario',
        recursoId: usuario.id,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: context.ip,
        dispositivo: context.userAgent,
        datosAntes: { estado: usuario.estado },
        datosDespues: { estado: to, motivo },
        requestId: context.requestId,
      });
    });

    const updated = await this.identity.findById(usuario.id);
    if (!updated) {
      throw new Error('El usuario actualizado no se pudo leer.');
    }
    return updated;
  }

  async assignProfile(
    usuarioId: string,
    codigo: string,
    validUntil: Date | null,
    actor: AuthPrincipal,
    context: RequestContext,
  ): Promise<void> {
    const usuario = await this.identity.findById(usuarioId);
    if (!usuario) {
      throw new AuthError(
        AUTH_ERRORS.resourceNotFound,
        HttpStatus.NOT_FOUND,
        'Usuario inexistente.',
      );
    }

    const perfil = await this.identity.findPerfilByCodigo(codigo);
    if (!perfil) {
      throw new AuthError(
        AUTH_ERRORS.validationFailed,
        HttpStatus.BAD_REQUEST,
        'Perfil inexistente.',
      );
    }

    await this.unitOfWork.run(async (tx) => {
      await tx.identity.assignProfile({
        id: uuidv7(),
        usuarioId,
        perfilId: perfil.id,
        validUntil,
        asignadoPor: actor.userId,
      });
      await tx.audit.record({
        accion: 'usuario.perfil_asignado',
        recurso: 'usuario',
        recursoId: usuarioId,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: context.ip,
        dispositivo: context.userAgent,
        datosDespues: { perfil: perfil.codigo, valid_until: validUntil?.toISOString() ?? null },
        requestId: context.requestId,
      });
    });
  }
}
