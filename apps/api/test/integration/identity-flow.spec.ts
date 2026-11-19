import { HttpException } from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { NO_MIGRATIONS } from 'kysely/migration';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { KyselyAuditWriter } from '../../src/database/audit/kysely-audit.writer.js';
import { createMigrator } from '../../src/database/migrator/migrator-setup.js';
import type { Database } from '../../src/database/schema.js';
import { seedIdentity } from '../../src/database/seeds/identity.seed.js';
import { AuditService } from '../../src/modules/audit/application/audit.service.js';
import { KyselyAuditRepository } from '../../src/modules/audit/infrastructure/kysely-audit.repository.js';
import { KyselyAuditWriterFactory } from '../../src/modules/audit/infrastructure/kysely-audit-writer.factory.js';
import { AuthStateService } from '../../src/modules/identity/application/auth-state.service.js';
import { IdentityAdminService } from '../../src/modules/identity/application/identity-admin.service.js';
import { LoginService } from '../../src/modules/identity/application/login.service.js';
import { MfaService } from '../../src/modules/identity/application/mfa.service.js';
import { PasswordService } from '../../src/modules/identity/application/password.service.js';
import { SessionService } from '../../src/modules/identity/application/session.service.js';
import { KyselyIdentityRepository } from '../../src/modules/identity/infrastructure/persistence/kysely-identity.repository.js';
import { KyselySessionRepository } from '../../src/modules/identity/infrastructure/persistence/kysely-session.repository.js';
import { KyselyUnitOfWork } from '../../src/modules/identity/infrastructure/persistence/kysely-unit-of-work.js';
import { AesFieldEncryption } from '../../src/modules/identity/infrastructure/security/aes-field-encryption.js';
import { Argon2PasswordHasher } from '../../src/modules/identity/infrastructure/security/argon2-password-hasher.js';
import { JoseTokenService } from '../../src/modules/identity/infrastructure/security/jose-token.service.js';
import { RfcTotpService } from '../../src/modules/identity/infrastructure/security/rfc-totp.service.js';
import { SystemClock } from '../../src/modules/identity/infrastructure/system-clock.js';
import type { AuthPrincipal } from '../../src/shared/auth/auth-principal.js';
import type { RequestContext } from '../../src/shared/http/request-context.js';
import { requireMigratorDatabaseUrl } from '../../src/shared/config/env.js';
import { generateTotp } from '../../src/shared/security/totp.js';
import { InMemoryRateLimiter, InMemorySessionCache } from './support/in-memory-adapters.js';

const hasDatabase = Boolean(process.env.DATABASE_MIGRATOR_URL);

const SEED_PASSWORD = 'SemillaInicial#2026';
const NEW_PASSWORD = 'NuevaClaveSegura#2026';
const INITIAL_USER_PASSWORD = 'ClaveInicialDePrueba#2026';
const RENEWED_USER_PASSWORD = 'ClaveRenovadaSegura#2026';

function context(): RequestContext {
  return { ip: '127.0.0.1', userAgent: 'vitest-integration', requestId: uuidv7() };
}

describe.runIf(hasDatabase)('Flujos de identidad contra PostgreSQL (C2 — RB1-16…RB1-19)', () => {
  let db: Kysely<Database>;
  let identity: KyselyIdentityRepository;
  let cache: InMemorySessionCache;
  let login: LoginService;
  let mfa: MfaService;
  let passwords: PasswordService;
  let sessions: SessionService;
  let identityAdmin: IdentityAdminService;
  let auditService: AuditService;
  let adminId: string;

  /** Actor administrador para las operaciones de gestión de identidad. */
  function adminActor(): AuthPrincipal {
    return {
      userId: adminId,
      sid: 'sid-admin-integracion',
      jti: 'jti-admin-integracion',
      amr: ['pwd', 'totp'],
      email: 'admin@ccltpg.org',
      nombre: 'Administrador inicial',
      estado: 'activo',
      mfaEnabled: true,
      mustChangePassword: false,
      profiles: [
        {
          id: 'perfil-administrador',
          codigo: 'administrador',
          nombre: 'Administrador',
          validUntil: null,
        },
      ],
      permissions: ['audit:event:read', 'identity:user:manage'],
      grants: [
        {
          profileId: 'perfil-administrador',
          profileCode: 'administrador',
          permissions: ['audit:event:read', 'identity:user:manage'],
        },
      ],
      actorProfile: 'administrador',
      activeProfile: 'administrador',
      accessTokenExpiresAt: new Date(Date.now() + 900_000),
    };
  }

  async function createUser(
    email: string,
    profile: 'educador' | 'estudiante',
    validUntil: Date | null = null,
  ): Promise<string> {
    const created = await identityAdmin.create(
      {
        email,
        nombre: `Persona de prueba ${profile}`,
        password: INITIAL_USER_PASSWORD,
        profiles: [{ codigo: profile, validUntil }],
      },
      adminActor(),
      context(),
    );
    return created.id;
  }

  /** Completa el cambio obligatorio y devuelve el siguiente estado del login. */
  async function changeInitialPassword(usuarioId: string, email: string) {
    const first = await login.login(email, INITIAL_USER_PASSWORD, context());
    expect(first.status).toBe('password_change_required');

    return passwords.change({
      usuarioId,
      currentPassword: INITIAL_USER_PASSWORD,
      newPassword: RENEWED_USER_PASSWORD,
      keepFamiliaId: null,
      partialToken: first.sessionToken!,
      context: context(),
    });
  }

  beforeAll(async () => {
    db = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString: requireMigratorDatabaseUrl(), max: 4 }),
      }),
    });

    const migrator = createMigrator(db as Kysely<unknown>, 'public');
    await migrator.migrateToLatest();
    await migrator.migrateTo(NO_MIGRATIONS);
    const latest = await migrator.migrateToLatest();
    expect(latest.error).toBeUndefined();

    await seedIdentity(db, { password: SEED_PASSWORD, withTemporaryIdentity: true });

    identity = new KyselyIdentityRepository(db);
    cache = new InMemorySessionCache();
    const limiter = new InMemoryRateLimiter(false);
    const clock = new SystemClock();
    const tokens = new JoseTokenService();
    const hasher = new Argon2PasswordHasher();
    const uow = new KyselyUnitOfWork(db);
    const audit = new KyselyAuditWriter(db);
    const sessionRepository = new KyselySessionRepository(db);

    sessions = new SessionService(uow, identity, sessionRepository, tokens, cache, clock);
    const authState = new AuthStateService(sessions, cache);
    login = new LoginService(identity, hasher, authState, limiter, tokens, uow, clock, audit);
    mfa = new MfaService(
      identity,
      hasher,
      new RfcTotpService(),
      new AesFieldEncryption(),
      authState,
      cache,
      limiter,
      tokens,
      uow,
      clock,
      audit,
    );
    passwords = new PasswordService(identity, hasher, authState, limiter, cache, uow, clock);
    identityAdmin = new IdentityAdminService(identity, hasher, uow, clock, audit);
    auditService = new AuditService(
      new KyselyAuditRepository(db),
      new KyselyAuditWriterFactory(db),
    );

    const admin = await identity.findByEmail('admin@ccltpg.org');
    expect(admin).not.toBeNull();
    adminId = admin!.id;
  }, 60_000);

  afterAll(async () => {
    if (db) {
      await db.destroy();
    }
  });

  it('la semilla es idempotente y crea perfiles, permisos e identidad temporal', async () => {
    await seedIdentity(db, { password: SEED_PASSWORD, withTemporaryIdentity: true });

    const perfiles = await sql<{
      codigo: string;
    }>`select codigo from public.perfil order by codigo`.execute(db);
    expect(perfiles.rows.map((row) => row.codigo)).toEqual([
      'administrador',
      'educador',
      'estudiante',
    ]);

    const admin = await identity.findByEmail('admin@ccltpg.org');
    expect(admin?.debeCambiarPassword).toBe(true);

    const temporal = await identity.findByEmail('temporal@ccltpg.org');
    expect(temporal).not.toBeNull();
    const profiles = await identity.listProfiles(temporal!.id, new Date());
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.codigo).toBe('educador');
    expect(profiles[0]?.validUntil).toBeInstanceOf(Date);
  });

  it('rechaza credenciales inválidas sin revelar si la cuenta existe', async () => {
    await expect(login.login('admin@ccltpg.org', 'incorrecta', context())).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
    await expect(login.login('nadie@ccltpg.org', 'incorrecta', context())).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  let adminSessionToken = '';
  let enrolledSecret = '';
  let recoveryCodes: string[] = [];

  it('encadena contraseña inicial → inscripción MFA → sesión completa', async () => {
    const first = await login.login('admin@ccltpg.org', SEED_PASSWORD, context());
    expect(first.status).toBe('password_change_required');
    expect(first.sessionToken).toBeDefined();
    adminSessionToken = first.sessionToken!;

    const afterPassword = await passwords.change({
      usuarioId: adminId,
      currentPassword: SEED_PASSWORD,
      newPassword: NEW_PASSWORD,
      keepFamiliaId: null,
      partialToken: adminSessionToken,
      context: context(),
    });

    expect(afterPassword?.status).toBe('mfa_enrollment_required');
    expect(afterPassword?.sessionToken).toBeDefined();
    adminSessionToken = afterPassword!.sessionToken!;

    // AC-AUD-01: una operación, un evento (no duplica el cambio parcial).
    const passwordEvents = await sql<{ total: string }>`
      select count(*) as total
      from public.evento_auditoria
      where accion = 'usuario.password_cambiada' and recurso_id = ${adminId}
    `.execute(db);
    expect(Number(passwordEvents.rows[0]?.total)).toBe(1);

    const enrollment = await mfa.enroll(adminId);
    expect(enrollment.secret).toMatch(/^[A-Z2-7]+$/u);
    expect(enrollment.otpauthUri).toContain('otpauth://totp/');
    enrolledSecret = enrollment.secret;

    const confirmed = await mfa.confirm({
      usuarioId: adminId,
      code: generateTotp(enrolledSecret),
      context: context(),
    });

    expect(confirmed.auth.status).toBe('authenticated');
    expect(confirmed.auth.session).toBeDefined();
    expect(confirmed.recoveryCodes).toHaveLength(10);
    recoveryCodes = confirmed.recoveryCodes;

    const stored = await identity.findById(adminId);
    expect(stored?.mfaHabilitado).toBe(true);
    expect(stored?.mfaSecretCifrado).not.toContain(enrolledSecret);
    expect(stored?.debeCambiarPassword).toBe(false);
  }, 60_000);

  it('rota el refresh y revoca la familia si se reutiliza el token anterior', async () => {
    const started = await login.login('admin@ccltpg.org', NEW_PASSWORD, context());
    expect(started.status).toBe('mfa_required');

    const verified = await mfa.verify({
      usuarioId: adminId,
      partialToken: started.sessionToken!,
      code: generateTotp(enrolledSecret),
      method: 'totp',
      context: context(),
    });
    const session = verified.session!;

    const rotated = await sessions.refresh(session.refreshToken, context());
    expect(rotated.accessToken).not.toBe(session.accessToken);
    expect(rotated.refreshToken).not.toBe(session.refreshToken);

    await expect(sessions.refresh(session.refreshToken, context())).rejects.toMatchObject({
      code: 'AUTH_TOKEN_REUSED',
    });

    // La familia completa quedó revocada, incluido el token recién emitido.
    await expect(sessions.refresh(rotated.refreshToken, context())).rejects.toMatchObject({
      code: 'AUTH_TOKEN_REUSED',
    });

    // AC-AUD-02: la reutilización y la verificación MFA quedan auditadas.
    const events = await sql<{ accion: string }>`
      select accion
      from public.evento_auditoria
      where recurso_id = ${adminId}
        and accion in ('sesion.refresh_reutilizado', 'sesion.mfa_verificada')
    `.execute(db);
    const actions = events.rows.map((row) => row.accion);
    expect(actions).toContain('sesion.refresh_reutilizado');
    expect(actions).toContain('sesion.mfa_verificada');
  }, 60_000);

  it('permite un código de recuperación y lo consume', async () => {
    const started = await login.login('admin@ccltpg.org', NEW_PASSWORD, context());
    const recovered = await mfa.verify({
      usuarioId: adminId,
      partialToken: started.sessionToken!,
      code: recoveryCodes[0],
      method: 'recovery',
      context: context(),
    });

    expect(recovered.status).toBe('authenticated');
    expect(recovered.session).toBeDefined();

    const remaining = await identity.listRecoveryCodes(adminId);
    expect(remaining).toHaveLength(9);

    const startedAgain = await login.login('admin@ccltpg.org', NEW_PASSWORD, context());
    await expect(
      mfa.verify({
        usuarioId: adminId,
        partialToken: startedAgain.sessionToken!,
        code: recoveryCodes[0],
        method: 'recovery',
        context: context(),
      }),
    ).rejects.toMatchObject({ code: 'AUTH_MFA_INVALID_CODE' });
  }, 60_000);

  it('cierra sesión de forma idempotente', async () => {
    const started = await login.login('admin@ccltpg.org', NEW_PASSWORD, context());
    const verified = await mfa.verify({
      usuarioId: adminId,
      partialToken: started.sessionToken!,
      code: generateTotp(enrolledSecret),
      method: 'totp',
      context: context(),
    });

    await expect(
      sessions.logout(null, verified.session!.refreshToken, context()),
    ).resolves.toBeUndefined();
    await expect(sessions.logout(null, null, context())).resolves.toBeUndefined();
    await expect(sessions.refresh(verified.session!.refreshToken, context())).rejects.toMatchObject(
      { code: 'AUTH_TOKEN_REUSED' },
    );

    // AC-AUD-02: el cierre queda auditado aunque no hubiera access token.
    const closed = await sql<{ total: string }>`
      select count(*) as total
      from public.evento_auditoria
      where accion = 'sesion.cerrada' and recurso_id = ${adminId}
    `.execute(db);
    expect(Number(closed.rows[0]?.total ?? 0)).toBeGreaterThan(0);
  }, 60_000);

  it('bloquea la cuenta tras cinco fallos y lo audita', async () => {
    const temporal = await identity.findByEmail('temporal@ccltpg.org');
    expect(temporal).not.toBeNull();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        login.login('temporal@ccltpg.org', 'incorrecta', context()),
      ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    }

    const blocked = await identity.findByEmail('temporal@ccltpg.org');
    expect(blocked?.estado).toBe('bloqueado');

    const audit = await sql<{ total: string }>`
      select count(*) as total from public.evento_auditoria
      where accion = 'usuario.bloqueado' and recurso_id = ${temporal!.id}
    `.execute(db);
    expect(Number(audit.rows[0]?.total ?? 0)).toBeGreaterThan(0);
  }, 120_000);

  it('registra auditoría correlacionada por requestId y sin secretos', async () => {
    const ctx = context();
    await login.login('admin@ccltpg.org', NEW_PASSWORD, ctx);

    const rows = await sql<{ accion: string; datos: unknown; actor_id: string | null }>`
      select accion, datos_despues as datos, actor_id
      from public.evento_auditoria
      where request_id = ${ctx.requestId}
      order by ocurrido_en
    `.execute(db);

    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.some((row) => row.accion === 'sesion.credenciales_verificadas')).toBe(true);

    const serialized = JSON.stringify(rows.rows);
    expect(serialized).not.toContain(NEW_PASSWORD);
    expect(serialized).not.toContain(enrolledSecret);
    expect(serialized).not.toContain('admin@ccltpg.org');

    const failed = await sql<{ datos: unknown }>`
      select datos_despues as datos from public.evento_auditoria
      where accion = 'sesion.fallida'
      limit 1
    `.execute(db);
    expect(JSON.stringify(failed.rows[0]?.datos)).toContain('email_hmac');
    expect(JSON.stringify(failed.rows[0]?.datos)).not.toContain('nadie@ccltpg.org');
  }, 60_000);

  it('impide actualizar, borrar o truncar la auditoría', async () => {
    await expect(
      sql`update public.evento_auditoria set accion = 'x.y'`.execute(db),
    ).rejects.toThrow(/solo inserción/u);
    await expect(sql`delete from public.evento_auditoria`.execute(db)).rejects.toThrow(
      /solo inserción/u,
    );
    await expect(sql`truncate public.evento_auditoria`.execute(db)).rejects.toThrow(
      /solo inserción/u,
    );

    // El rol de aplicación solo tiene SELECT e INSERT (AC-AUD-06/07).
    const grants = await sql<{ privilege_type: string }>`
      select privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'evento_auditoria'
        and grantee = 'ccltpg_app'
    `.execute(db);
    const privileges = grants.rows.map((row) => row.privilege_type.toUpperCase());
    expect(privileges).toContain('SELECT');
    expect(privileges).toContain('INSERT');
    expect(privileges).not.toContain('UPDATE');
    expect(privileges).not.toContain('DELETE');
    expect(privileges).not.toContain('TRUNCATE');
  });

  it('aplica la máquina de estados de login por perfil (AC-SEC-06)', async () => {
    // Educador: MFA obligatorio por perfil tras el cambio inicial.
    const educatorId = await createUser('educador.c2@ccltpg.org', 'educador');
    const educator = await changeInitialPassword(educatorId, 'educador.c2@ccltpg.org');
    expect(educator?.status).toBe('mfa_enrollment_required');
    expect(educator?.partialScope).toBe('mfa_enroll');

    // Estudiante: MFA opcional; el primer login completo no lo exige.
    const studentId = await createUser('estudiante.c2@ccltpg.org', 'estudiante');
    const student = await changeInitialPassword(studentId, 'estudiante.c2@ccltpg.org');
    expect(student?.status).toBe('authenticated');
    expect(student?.session).toBeDefined();

    // Inscripción voluntaria desde una sesión completa.
    const enrollment = await mfa.enroll(studentId);
    const confirmed = await mfa.confirm({
      usuarioId: studentId,
      code: generateTotp(enrollment.secret),
      context: context(),
    });
    expect(confirmed.auth.status).toBe('authenticated');
    expect(confirmed.recoveryCodes).toHaveLength(10);

    // Con MFA inscrito, el estudiante debe verificarlo en el siguiente login.
    const studentLogin = await login.login(
      'estudiante.c2@ccltpg.org',
      RENEWED_USER_PASSWORD,
      context(),
    );
    expect(studentLogin.status).toBe('mfa_required');
    const verified = await mfa.verify({
      usuarioId: studentId,
      partialToken: studentLogin.sessionToken!,
      code: generateTotp(enrollment.secret),
      method: 'totp',
      context: context(),
    });
    expect(verified.status).toBe('authenticated');

    // Identidad temporal: `valid_until` obliga MFA aunque el perfil no lo exija.
    const temporalEmail = 'temporal.c2@ccltpg.org';
    const temporalId = await createUser(
      temporalEmail,
      'estudiante',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );
    const temporal = await changeInitialPassword(temporalId, temporalEmail);
    expect(temporal?.status).toBe('mfa_enrollment_required');
    expect(temporal?.partialScope).toBe('mfa_enroll');
  }, 120_000);

  it('entrega 10 códigos de recuperación de un solo uso y la regeneración invalida los anteriores (AC-SEC-07)', async () => {
    const email = 'recuperacion.c2@ccltpg.org';
    const userId = await createUser(email, 'estudiante');
    await changeInitialPassword(userId, email);

    const enrollment = await mfa.enroll(userId);
    const confirmed = await mfa.confirm({
      usuarioId: userId,
      code: generateTotp(enrollment.secret),
      context: context(),
    });
    expect(confirmed.recoveryCodes).toHaveLength(10);
    expect(new Set(confirmed.recoveryCodes).size).toBe(10);
    const firstCodes = confirmed.recoveryCodes;

    const started = await login.login(email, RENEWED_USER_PASSWORD, context());
    const consumed = await mfa.verify({
      usuarioId: userId,
      partialToken: started.sessionToken!,
      code: firstCodes[0],
      method: 'recovery',
      context: context(),
    });
    expect(consumed.status).toBe('authenticated');
    expect(await identity.listRecoveryCodes(userId)).toHaveLength(9);

    // Un código consumido no se puede reutilizar.
    const again = await login.login(email, RENEWED_USER_PASSWORD, context());
    await expect(
      mfa.verify({
        usuarioId: userId,
        partialToken: again.sessionToken!,
        code: firstCodes[0],
        method: 'recovery',
        context: context(),
      }),
    ).rejects.toMatchObject({ code: 'AUTH_MFA_INVALID_CODE' });

    // Regenerar invalida todos los códigos anteriores.
    const regenerated = await mfa.regenerateRecoveryCodes({
      usuarioId: userId,
      code: generateTotp(enrollment.secret),
      context: context(),
    });
    expect(regenerated.recoveryCodes).toHaveLength(10);
    expect(regenerated.recoveryCodes).not.toEqual(firstCodes);

    const stale = await login.login(email, RENEWED_USER_PASSWORD, context());
    await expect(
      mfa.verify({
        usuarioId: userId,
        partialToken: stale.sessionToken!,
        code: firstCodes[1],
        method: 'recovery',
        context: context(),
      }),
    ).rejects.toMatchObject({ code: 'AUTH_MFA_INVALID_CODE' });

    const fresh = await login.login(email, RENEWED_USER_PASSWORD, context());
    await expect(
      mfa.verify({
        usuarioId: userId,
        partialToken: fresh.sessionToken!,
        code: regenerated.recoveryCodes[0],
        method: 'recovery',
        context: context(),
      }),
    ).resolves.toMatchObject({ status: 'authenticated' });
  }, 120_000);

  it('corta el acceso y revoca familias al desactivar y al vencer los perfiles (AC-SEC-11)', async () => {
    const email = 'revocacion.c2@ccltpg.org';
    const userId = await createUser(email, 'estudiante');
    const started = await changeInitialPassword(userId, email);
    const session = started!.session!;

    await expect(sessions.resolvePrincipal(session.accessToken, null)).resolves.toMatchObject({
      userId,
    });

    await identityAdmin.transition(userId, 'inactivo', 'prueba AC-SEC-11', adminActor(), context());

    await expect(sessions.resolvePrincipal(session.accessToken, null)).rejects.toMatchObject({
      code: 'AUTH_TOKEN_REVOKED',
    });
    await expect(sessions.refresh(session.refreshToken, context())).rejects.toMatchObject({
      code: 'AUTH_TOKEN_REUSED',
    });

    // Todos los perfiles vencidos: el token deja de ser aceptado.
    const expiredEmail = 'vencido.c2@ccltpg.org';
    const expiredId = await createUser(expiredEmail, 'estudiante');
    const expiredSession = (await changeInitialPassword(expiredId, expiredEmail))!.session!;

    await sql`
      update public.usuario_perfil
      set valid_until = now() - interval '1 minute'
      where usuario_id = ${expiredId}
    `.execute(db);

    await expect(sessions.resolvePrincipal(expiredSession.accessToken, null)).rejects.toMatchObject(
      { code: 'AUTH_TOKEN_REVOKED' },
    );
    await expect(sessions.refresh(expiredSession.refreshToken, context())).rejects.toMatchObject({
      code: 'AUTH_TOKEN_REUSED',
    });
  }, 120_000);

  it('todo evento contiene los campos obligatorios y hora UTC (AC-AUD-05)', async () => {
    const rows = await sql<{
      actor_id: string | null;
      actor_perfil: string | null;
      recurso: string;
      recurso_id: string | null;
      accion: string;
      ocurrido_en: Date;
      request_id: string | null;
    }>`
      select actor_id, actor_perfil, recurso, recurso_id, accion, ocurrido_en, request_id
      from public.evento_auditoria
      where request_id is not null
    `.execute(db);

    expect(rows.rows.length).toBeGreaterThan(20);

    for (const row of rows.rows) {
      expect(row.accion).toMatch(/^[a-z_]+\.[a-z_]+$/u);
      expect(row.recurso).toMatch(/^[a-z_]+$/u);
      expect(row.ocurrido_en).toBeInstanceOf(Date);
      expect(Number.isNaN(row.ocurrido_en.getTime())).toBe(false);
      expect(row.ocurrido_en.toISOString()).toMatch(/Z$/u);
      expect(row.request_id).toBeTruthy();
    }

    // Las mutaciones administrativas registran actor y perfil.
    const adminRows = rows.rows.filter(
      (row) =>
        row.accion === 'usuario.creado' ||
        row.accion === 'usuario.desactivado' ||
        row.accion === 'auditoria.consultada',
    );
    expect(adminRows.length).toBeGreaterThan(0);
    for (const row of adminRows) {
      expect(row.actor_id).toBeTruthy();
      expect(row.actor_perfil).toBe('administrador');
    }

    const created = rows.rows.filter((row) => row.accion === 'usuario.creado');
    expect(created.length).toBeGreaterThan(0);
    expect(created.every((row) => row.recurso_id !== null)).toBe(true);
  });

  it('registra correcciones sin editar el pasado (AC-AUD-07)', async () => {
    const original = await sql<{ id: string; accion: string }>`
      select id, accion
      from public.evento_auditoria
      where accion = 'usuario.creado'
      order by ocurrido_en desc
      limit 1
    `.execute(db);
    const event = original.rows[0];
    const justificacion = 'Corrección de prueba: el evento original se conserva';

    await auditService.correct(event.id, justificacion, adminActor(), context());

    const correction = await sql<{
      recurso: string;
      recurso_id: string | null;
      actor_id: string | null;
      datos_despues: { justificacion?: string } | null;
    }>`
      select recurso, recurso_id, actor_id, datos_despues
      from public.evento_auditoria
      where accion = 'auditoria.correccion' and recurso_id = ${event.id}
      order by ocurrido_en desc
      limit 1
    `.execute(db);

    expect(correction.rows).toHaveLength(1);
    expect(correction.rows[0]).toMatchObject({
      recurso: 'evento_auditoria',
      recurso_id: event.id,
      actor_id: adminId,
    });
    expect(correction.rows[0]?.datos_despues?.justificacion).toBe(justificacion);

    const still = await sql<{ accion: string }>`
      select accion from public.evento_auditoria where id = ${event.id}
    `.execute(db);
    expect(still.rows[0]?.accion).toBe(event.accion);
  });

  it('revierte el cambio y responde 503 si la auditoría no se puede escribir (AC-AUD-10)', async () => {
    const before = await identity.findById(adminId);
    const beforeCount = await sql<{ total: string }>`
      select count(*) as total from public.evento_auditoria where accion = 'usuario.actualizado'
    `.execute(db);

    await sql`
      create or replace function public.prueba_fallo_auditoria() returns trigger as $$
      begin
        raise exception 'fallo forzado de auditoría';
      end;
      $$ language plpgsql
    `.execute(db);
    await sql`
      create trigger prueba_fallo_auditoria
      before insert on public.evento_auditoria
      for each row execute function public.prueba_fallo_auditoria()
    `.execute(db);

    let failure: unknown = null;
    try {
      await identityAdmin.update(
        adminId,
        { nombre: 'Nombre que no debe persistir' },
        adminActor(),
        context(),
      );
    } catch (error) {
      failure = error;
    } finally {
      await sql`drop trigger if exists prueba_fallo_auditoria on public.evento_auditoria`.execute(
        db,
      );
      await sql`drop function if exists public.prueba_fallo_auditoria()`.execute(db);
    }

    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(503);

    // La transacción revirtió el cambio y no dejó un evento huérfano.
    const after = await identity.findById(adminId);
    expect(after?.nombre).toBe(before?.nombre);

    const afterCount = await sql<{ total: string }>`
      select count(*) as total from public.evento_auditoria where accion = 'usuario.actualizado'
    `.execute(db);
    expect(Number(afterCount.rows[0]?.total)).toBe(Number(beforeCount.rows[0]?.total));
  }, 60_000);

  it('registra cada consulta de auditoría con filtros y resultados (AC-AUD-12)', async () => {
    const ctx = context();
    const filter = { accion: 'usuario.creado', limit: 5, offset: 0 };

    const page = await auditService.query(filter, adminActor(), ctx);

    const rows = await sql<{
      actor_id: string | null;
      request_id: string | null;
      datos_despues: {
        filtros?: Record<string, unknown>;
        resultados?: number;
      } | null;
    }>`
      select actor_id, request_id, datos_despues
      from public.evento_auditoria
      where accion = 'auditoria.consultada' and request_id = ${ctx.requestId}
      limit 1
    `.execute(db);

    expect(rows.rows).toHaveLength(1);
    const meta = rows.rows[0];
    expect(meta.actor_id).toBe(adminId);
    expect(meta.request_id).toBe(ctx.requestId);
    expect(meta.datos_despues?.filtros).toMatchObject({
      accion: 'usuario.creado',
      limit: 5,
      offset: 0,
    });
    expect(meta.datos_despues?.resultados).toBe(page.total);

    // La meta-auditoría no copia las filas consultadas.
    const serialized = JSON.stringify(meta.datos_despues);
    expect(serialized).not.toContain('items');
    expect(serialized).not.toContain('@ccltpg.org');
    expect(serialized).not.toContain('password');
  });
});
