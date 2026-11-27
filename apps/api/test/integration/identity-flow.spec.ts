import { HttpException } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { Kysely, PostgresDialect, sql } from 'kysely';
import { NO_MIGRATIONS } from 'kysely/migration';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { KyselyAuditWriter } from '../../src/database/audit/kysely-audit.writer.js';
import { KyselyOutboxWriter } from '../../src/database/events/kysely-outbox.writer.js';
import { KyselyIdempotencyStore } from '../../src/database/idempotency/kysely-idempotency.store.js';
import { createMigrator } from '../../src/database/migrator/migrator-setup.js';
import type { Database } from '../../src/database/schema.js';
import { seedIdentity } from '../../src/database/seeds/identity.seed.js';
import { AuditService } from '../../src/modules/audit/application/audit.service.js';
import { KyselyAuditRepository } from '../../src/modules/audit/infrastructure/kysely-audit.repository.js';
import { KyselyAuditWriterFactory } from '../../src/modules/audit/infrastructure/kysely-audit-writer.factory.js';
import { ExportsService } from '../../src/modules/exports/application/exports.service.js';
import { DefaultExportRenderer } from '../../src/modules/exports/infrastructure/default-export-renderer.js';
import { KyselyExportsUnitOfWork } from '../../src/modules/exports/infrastructure/persistence/kysely-unit-of-work.js';
import { FileService } from '../../src/modules/files/application/file.service.js';
import { FileTypeInspector } from '../../src/modules/files/infrastructure/file-type-inspector.js';
import { KyselyFileRepository } from '../../src/modules/files/infrastructure/persistence/kysely-file.repository.js';
import { KyselyFilesUnitOfWork } from '../../src/modules/files/infrastructure/persistence/kysely-unit-of-work.js';
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
import { NotificationDispatcher } from '../../src/modules/notifications/application/notification-dispatcher.js';
import { OutboxWorker } from '../../src/modules/notifications/infrastructure/outbox-worker.js';
import type { AuthPrincipal } from '../../src/shared/auth/auth-principal.js';
import type { EmailMessage, EmailSender } from '../../src/shared/email/email-sender.port.js';
import type { RequestContext } from '../../src/shared/http/request-context.js';
import { StubMalwareScanner } from '../../src/shared/malware/stub-malware-scanner.js';
import { LocalObjectStorage } from '../../src/shared/storage/local-object-storage.js';
import { requireMigratorDatabaseUrl, env } from '../../src/shared/config/env.js';
import { generateTotp } from '../../src/shared/security/totp.js';
import { InMemoryRateLimiter, InMemorySessionCache } from './support/in-memory-adapters.js';

const hasDatabase = Boolean(process.env.DATABASE_MIGRATOR_URL);

const SEED_PASSWORD = 'SemillaInicial#2026-test';
const NEW_PASSWORD = 'NuevaClaveSegura#2026-test';
const INITIAL_USER_PASSWORD = 'ClaveInicialDePrueba#2026-test';
const RENEWED_USER_PASSWORD = 'ClaveRenovadaSegura#2026-test';

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
      'auxiliar_administrativo',
      'comite_programacion',
      'contratista_prensa',
      'educador',
      'estudiante',
      'ingeniero_mantenimiento',
      'jefe_emisora',
      'locutor',
      'operador_transmisor',
      'programador',
      'realizador_externo',
      'secretario_cultura',
      'tecnico_contenidos',
      'tecnico_emision',
      'tecnico_grabacion',
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

  describe('Flujos de C3 sobre el mismo esquema (RB1-20…RB1-25)', () => {
    let root: string;
    let storage: LocalObjectStorage;
    let idempotency: KyselyIdempotencyStore;
    let files: FileService;

    const fileActor = {
      userId: '',
      actorProfile: 'administrador',
      permissions: ['files:document:create', 'files:document:read', 'files:document:read_own'],
    };

    beforeAll(async () => {
      root = await mkdtemp(path.join(tmpdir(), 'ccltpg-c3-'));
      storage = new LocalObjectStorage(root);
      idempotency = new KyselyIdempotencyStore(db);
      fileActor.userId = adminId;

      files = new FileService(
        new KyselyFileRepository(db),
        new KyselyFilesUnitOfWork(db),
        new FileTypeInspector(),
        storage,
        new StubMalwareScanner(),
        idempotency,
        new KyselyAuditWriter(db),
      );
    }, 60_000);

    afterAll(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it('reserva, repite, detecta conflicto y purga claves de idempotencia (R-032)', async () => {
      const base = {
        usuarioId: adminId,
        operacion: 'prueba:integracion',
        clave: uuidv7(),
        hashSolicitud: 'a'.repeat(64),
        ttlSeconds: 60,
      };

      const first = await idempotency.reserve(base);
      expect(first.status).toBe('nuevo');
      await expect(idempotency.reserve(base)).resolves.toMatchObject({ status: 'en_proceso' });

      await idempotency.complete((first as { id: string }).id, 201, { resultado: 'original' });
      await expect(idempotency.reserve(base)).resolves.toEqual({
        status: 'repetir',
        responseStatus: 201,
        responseBody: { resultado: 'original' },
      });

      await expect(
        idempotency.reserve({ ...base, hashSolicitud: 'b'.repeat(64) }),
      ).resolves.toMatchObject({ status: 'conflicto' });

      const expired = { ...base, clave: uuidv7() };
      const reserved = await idempotency.reserve(expired);
      expect(reserved.status).toBe('nuevo');
      await sql`
        update public.idempotency_key
        set expira_en = now() - interval '1 minute'
        where clave = ${expired.clave}
      `.execute(db);

      const renewed = await idempotency.reserve(expired);
      expect(renewed.status).toBe('nuevo');
      expect((renewed as { id: string }).id).not.toBe((reserved as { id: string }).id);

      await expect(
        idempotency.purgeExpired(new Date(Date.now() + 120_000)),
      ).resolves.toBeGreaterThan(0);
    });

    it('carga un PDF, deduplica por Idempotency-Key y audita la descarga (RB1-21/22)', async () => {
      const buffer = Buffer.from('%PDF-1.7\ncontenido de integración\n', 'ascii');
      const key = uuidv7();

      const view = await files.upload({
        buffer,
        nombreOriginal: 'integracion.pdf',
        mime: 'application/pdf',
        idempotencyKey: key,
        actor: fileActor,
        context: context(),
      });

      expect(view).toMatchObject({ estadoEscaneo: 'limpio', mime: 'application/pdf' });

      const repeated = await files.upload({
        buffer,
        nombreOriginal: 'integracion.pdf',
        mime: 'application/pdf',
        idempotencyKey: key,
        actor: fileActor,
        context: context(),
      });
      expect(repeated.id).toBe(view.id);

      const rows = await sql<{ total: string }>`
        select count(*) as total from public.archivo where id = ${view.id}
      `.execute(db);
      expect(Number(rows.rows[0]?.total)).toBe(1);

      await expect(
        files.download({
          id: view.id,
          actor: {
            userId: uuidv7(),
            actorProfile: 'estudiante',
            permissions: ['files:document:read_own'],
          },
          context: context(),
        }),
      ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });

      // La descarga propia se audita antes de responder.
      const own = await files.download({
        id: view.id,
        actor: { ...fileActor, permissions: ['files:document:read_own'] },
        context: context(),
      });
      expect(own.body).toEqual(buffer);

      const audit = await sql<{ total: string }>`
        select count(*) as total
        from public.evento_auditoria
        where accion = 'archivo.descargado' and recurso_id = ${view.id}
      `.execute(db);
      expect(Number(audit.rows[0]?.total)).toBe(1);

      const keyConflict = await files
        .upload({
          buffer: Buffer.from('%PDF-1.7 otro\n', 'ascii'),
          nombreOriginal: 'integracion.pdf',
          mime: 'application/pdf',
          idempotencyKey: key,
          actor: fileActor,
          context: context(),
        })
        .then(
          () => null,
          (error: { code?: string }) => error.code,
        );
      expect(keyConflict).toBe('IDEMPOTENCY_KEY_REUSED');
    }, 60_000);

    it('rechaza MIME falsificado, exceso de tamaño y pone EICAR en cuarentena (RB1-21)', async () => {
      const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d]),
        Buffer.from('IHDR', 'ascii'),
        Buffer.alloc(8),
      ]);

      await expect(
        files.upload({
          buffer: png,
          nombreOriginal: 'falsa.pdf',
          mime: 'application/pdf',
          idempotencyKey: uuidv7(),
          actor: fileActor,
          context: context(),
        }),
      ).rejects.toMatchObject({ code: 'FILE_MIME_MISMATCH' });

      await expect(
        files.upload({
          buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
          nombreOriginal: 'grande.pdf',
          mime: 'application/pdf',
          idempotencyKey: uuidv7(),
          actor: fileActor,
          context: context(),
        }),
      ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });

      const eicar = Buffer.concat([
        Buffer.from('%PDF-1.7\n', 'ascii'),
        Buffer.from(
          'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
          'ascii',
        ),
      ]);

      const infected = await files.upload({
        buffer: eicar,
        nombreOriginal: 'infectado.pdf',
        mime: 'application/pdf',
        idempotencyKey: uuidv7(),
        actor: fileActor,
        context: context(),
      });
      expect(infected.estadoEscaneo).toBe('infectado');

      await expect(
        files.download({
          id: infected.id,
          actor: fileActor,
          context: context(),
        }),
      ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });

      const audit = await sql<{ total: string }>`
        select count(*) as total
        from public.evento_auditoria
        where accion = 'archivo.cuarentena' and recurso_id = ${infected.id}
      `.execute(db);
      expect(Number(audit.rows[0]?.total)).toBe(1);
    }, 60_000);

    it('procesa la outbox una sola vez y entrega notificaciones con auditoría (RB1-23)', async () => {
      const delivered: EmailMessage[] = [];
      const email: EmailSender = {
        send: (message) => {
          delivered.push(message);
          return Promise.resolve();
        },
      };
      const worker = new OutboxWorker(db, new NotificationDispatcher(email));

      const eventId = uuidv7();
      await db.transaction().execute(async (trx) => {
        await new KyselyOutboxWriter(trx).enqueue({
          id: eventId,
          tipo: 'reporte.generado',
          agregado: 'archivo',
          ocurridoEn: new Date(),
          payload: { archivoId: uuidv7(), plantilla: 'matriculas-por-programa' },
          usuarioIds: [adminId],
        });
      });

      await worker.tick();

      const outbox = await sql<{ estado: string }>`
        select estado from public.evento_outbox where id = ${eventId}
      `.execute(db);
      expect(outbox.rows[0]?.estado).toBe('procesada');

      const notifications = await sql<{ canal: string; estado: string }>`
        select canal, estado
        from public.notificacion
        where evento_id = ${eventId} and usuario_id = ${adminId}
        order by canal
      `.execute(db);
      expect(notifications.rows).toEqual([
        { canal: 'app', estado: 'enviada' },
        { canal: 'email', estado: 'enviada' },
      ]);

      // Solo el canal de correo llama al proveedor; el stub no expone PII.
      expect(delivered).toHaveLength(1);

      const sentAudit = await sql<{ total: string }>`
        select count(*) as total
        from public.evento_auditoria
        where accion = 'notificacion.enviada' and request_id = ${eventId}
      `.execute(db);
      expect(Number(sentAudit.rows[0]?.total)).toBe(2);

      // Un segundo ciclo no reentrega el evento ya procesado.
      await worker.tick();
      const again = await sql<{ total: string }>`
        select count(*) as total
        from public.notificacion
        where evento_id = ${eventId} and usuario_id = ${adminId}
      `.execute(db);
      expect(Number(again.rows[0]?.total)).toBe(2);
      expect(delivered).toHaveLength(1);
    }, 60_000);

    it('reintenta la outbox y la marca fallida al agotar los intentos (RB1-23)', async () => {
      const failing = {
        dispatch: () => Promise.reject(new Error('fallo simulado de outbox')),
      } as unknown as NotificationDispatcher;
      const worker = new OutboxWorker(db, failing);

      const eventId = uuidv7();
      await db.transaction().execute(async (trx) => {
        await new KyselyOutboxWriter(trx).enqueue({
          id: eventId,
          tipo: 'reporte.generado',
          agregado: 'archivo',
          ocurridoEn: new Date(),
          payload: { archivoId: uuidv7(), plantilla: 'matriculas-por-programa' },
          usuarioIds: [adminId],
        });
      });

      for (let attempt = 0; attempt < env.OUTBOX_MAX_ATTEMPTS; attempt += 1) {
        await worker.tick();
        await sql`
          update public.evento_outbox
          set disponible_en = now() - interval '1 second'
          where id = ${eventId}
        `.execute(db);
      }

      const outbox = await sql<{ estado: string; intentos: number; ultimo_error: string }>`
        select estado, intentos, ultimo_error
        from public.evento_outbox
        where id = ${eventId}
      `.execute(db);
      expect(outbox.rows[0]).toMatchObject({
        estado: 'fallida',
        intentos: env.OUTBOX_MAX_ATTEMPTS,
      });
      expect(outbox.rows[0]?.ultimo_error).toBe('Error');

      const notifications = await sql<{ total: number }>`
        select count(*)::int as total
        from public.notificacion
        where evento_id = ${eventId}
      `.execute(db);
      expect(notifications.rows[0]?.total).toBe(0);
    }, 60_000);

    it('exporta CSV, lo registra como archivo y audita reporte.generado (RB1-24/RB1-25)', async () => {
      const exportsService = new ExportsService(
        new KyselyExportsUnitOfWork(db),
        new DefaultExportRenderer(),
        storage,
        idempotency,
      );
      const key = uuidv7();
      const request = {
        plantilla: 'matriculas-por-programa',
        formato: 'csv',
        parametros: {
          periodo: '2026-1',
          filas: [{ programa: 'Artes', matriculados: 4, activos: 3 }],
        },
        idempotencyKey: key,
        actor: { userId: adminId, actorProfile: 'administrador' },
        context: context(),
      };

      const view = await exportsService.create(request);
      expect(view).toMatchObject({
        formato: 'csv',
        nombre: 'matriculas-por-programa-v1.csv',
        mime: 'text/csv; charset=utf-8',
      });

      const repeated = await exportsService.create(request);
      expect(repeated.archivoId).toBe(view.archivoId);

      const stored = await sql<{ ruta_objeto: string }>`
        select ruta_objeto from public.archivo where id = ${view.archivoId}
      `.execute(db);
      const body = await storage.get(stored.rows[0].ruta_objeto);
      expect(body.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      expect(body.toString('utf8')).toContain('Artes');

      const audit = await sql<{ total: string }>`
        select count(*) as total
        from public.evento_auditoria
        where accion = 'reporte.generado' and recurso_id = ${view.archivoId}
      `.execute(db);
      expect(Number(audit.rows[0]?.total)).toBe(1);

      const outbox = await sql<{ total: string }>`
        select count(*) as total
        from public.evento_outbox
        where tipo = 'reporte.generado'
          and payload ->> 'archivoId' = ${view.archivoId}
      `.execute(db);
      expect(Number(outbox.rows[0]?.total)).toBe(1);
    }, 60_000);
  });
});
