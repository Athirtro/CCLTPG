import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import type { FullConfig } from '@playwright/test';

import { E2E_PASSWORD, E2E_TOTP_SECRET, E2E_USERS } from './fixtures.js';

/**
 * Prepara un estado determinista para la suite E2E sin destruir los datos del
 * usuario: solo inserta/actualiza las identidades `e2e-*` y limpia sus sesiones.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  const apiModules = resolve(process.cwd(), 'apps/api/node_modules');
  const pg = require(`${apiModules}/pg`);
  const argon2 = require(`${apiModules}/argon2`);
  const dotenv = require(`${apiModules}/dotenv`);
  const Ioredis = require(`${apiModules}/ioredis`);

  dotenv.config({ path: resolve(process.cwd(), '.env') });

  const connectionString = process.env.DATABASE_URL;
  const encryptionKey = process.env.MFA_ENCRYPTION_KEY;
  if (!connectionString || !encryptionKey) {
    throw new Error('Faltan DATABASE_URL o MFA_ENCRYPTION_KEY en .env');
  }

  const passwordHash = await argon2.hash(E2E_PASSWORD, {
    type: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const pool = new pg.Pool({ connectionString, max: 2 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const user of E2E_USERS) {
      await client.query(
        `INSERT INTO public.usuario
           (id, email, password_hash, nombre, estado, mfa_habilitado,
            mfa_secret_cifrado, debe_cambiar_password)
         VALUES ($1, $2, $3, $4, 'activo', $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           nombre = EXCLUDED.nombre,
           estado = 'activo',
           mfa_habilitado = EXCLUDED.mfa_habilitado,
           mfa_secret_cifrado = EXCLUDED.mfa_secret_cifrado,
           debe_cambiar_password = EXCLUDED.debe_cambiar_password,
           actualizado_en = now()`,
        [
          user.id,
          user.email,
          passwordHash,
          user.nombre,
          user.mfaHabilitado,
          user.mfaHabilitado ? encrypt(E2E_TOTP_SECRET, `mfa:usuario:${user.id}`, encryptionKey) : null,
          user.debeCambiarPassword,
        ],
      );

      await client.query('DELETE FROM public.refresh_token WHERE usuario_id = $1', [user.id]);
      await client.query('DELETE FROM public.codigo_recuperacion_mfa WHERE usuario_id = $1', [user.id]);
      await client.query('DELETE FROM public.usuario_perfil WHERE usuario_id = $1', [user.id]);
      await client.query(
        `INSERT INTO public.usuario_perfil
           (id, usuario_id, perfil_id, valid_until, asignado_por)
         VALUES (
           $1, $2,
           (SELECT id FROM public.perfil WHERE codigo = $3),
           NULL, NULL
         )`,
        [uuidV5(`usuario_perfil:${user.email}:${user.perfil}`), user.id, user.perfil],
      );
    }

    await seedAcademicAndPreferences(client);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  const redis = new Ioredis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  try {
    const keys = await redis.keys('ccltpg:rate:*');
    if (keys.length > 0) await redis.del(...keys);
  } finally {
    await redis.quit();
  }

  console.log('[e2e] Fixtures deterministas listas y contadores de rate limit limpiados.');
}

/**
 * Datos académicos mínimos para que los flujos del estudiante tengan contenido
 * real: un programa publicado, un grupo con horario, una matrícula activa, una
 * evaluación cualitativa y preferencias no críticas editables.
 */
type QueryableClient = {
  query: (sql: string, values?: readonly unknown[]) => Promise<unknown>;
};

async function seedAcademicAndPreferences(client: QueryableClient): Promise<void> {
  const estudianteId = 'aaaaaaaa-0000-4000-8000-000000000003';
  const matriculaId = 'aaaaaaaa-0000-4000-8000-000000000004';
  const grupoId = 'aaaaaaaa-0000-4000-8000-000000000002';
  const programaId = 'aaaaaaaa-0000-4000-8000-000000000001';
  const educadorId = '22222222-2222-4222-8222-222222222222';
  const estudianteUsuarioId = '33333333-3333-4333-8333-333333333333';

  // Limpieza de nuestros propios registros para que el setup sea idempotente.
  await client.query(
    `DELETE FROM academic.evaluacion_cualitativa WHERE matricula_id = $1`,
    [matriculaId],
  );
  await client.query(`DELETE FROM academic.asistencia WHERE matricula_id = $1`, [matriculaId]);
  await client.query(`DELETE FROM academic.matricula WHERE id = $1`, [matriculaId]);
  await client.query(`DELETE FROM academic.horario_grupo WHERE grupo_id = $1`, [grupoId]);
  await client.query(`DELETE FROM academic.estudiante WHERE id = $1`, [estudianteId]);
  await client.query(
    `DELETE FROM academic.grupo WHERE id = $1 OR (periodo = '2026-1' AND codigo = 'G-E2E-MI')`,
    [grupoId],
  );
  await client.query(`DELETE FROM academic.programa_formativo WHERE id = $1`, [programaId]);
  await client.query(
    `DELETE FROM public.preferencia_notificacion
      WHERE usuario_id = $1 AND evento IN ('notificacion.leida', 'reporte.generado')`,
    [estudianteUsuarioId],
  );

  await client.query(
    `INSERT INTO academic.programa_formativo (id, nombre, descripcion, area, cupo_maximo, estado)
     VALUES ($1, 'Programa E2E Estudiante', 'Programa determinista para el estudiante E2E',
             'musica', 30, 'publicado')`,
    [programaId],
  );
  await client.query(
    `INSERT INTO academic.grupo
       (id, programa_id, codigo, educador_id, salon, periodo, cupo_maximo, estado)
     VALUES ($1, $2, 'G-E2E-MI', $3, 'Salón 101', '2026-1', 10, 'abierto')`,
    [grupoId, programaId, educadorId],
  );
  await client.query(
    `INSERT INTO academic.estudiante
       (id, usuario_id, tipo_documento, numero_documento, numero_documento_hash,
        nombres, apellidos, fecha_nacimiento, municipio, consentimiento_datos)
     VALUES ($1, $2, 'CC', '9000000001', repeat('a1', 32), 'E2E', 'Estudiante',
             DATE '2010-01-01', 'Pereira', '{"consentimiento":true}'::jsonb)`,
    [estudianteId, estudianteUsuarioId],
  );
  await client.query(
    `INSERT INTO academic.matricula (id, estudiante_id, grupo_id, estado, fecha_matricula, periodo)
     VALUES ($1, $2, $3, 'activa', now(), '2026-1')`,
    [matriculaId, estudianteId, grupoId],
  );
  await client.query(
    `INSERT INTO academic.horario_grupo (id, grupo_id, dia_semana, hora_inicio, hora_fin)
     VALUES ('aaaaaaaa-0000-4000-8000-000000000005', $1, 1, '09:00:00', '11:00:00'),
            ('aaaaaaaa-0000-4000-8000-000000000006', $1, 3, '14:00:00', '16:00:00')`,
    [grupoId],
  );
  await client.query(
    `INSERT INTO academic.indicador_evaluacion
       (id, programa_id, nombre, descripcion, escala)
     VALUES ('00000000-0000-4000-8000-000000000001', NULL, 'Participación',
             'Participación activa del estudiante en la sesión.',
             'excelente,bueno,regular,deficiente')
     ON CONFLICT (id) DO NOTHING`,
  );
  await client.query(
    `INSERT INTO academic.evaluacion_cualitativa
       (id, matricula_id, indicador_id, periodo, valor, observacion, evaluado_por)
     VALUES ('aaaaaaaa-0000-4000-8000-000000000007', $1,
             '00000000-0000-4000-8000-000000000001', '2026-1', 'bueno',
             'Evaluación determinista de prueba E2E.', $2)`,
    [matriculaId, educadorId],
  );

  for (const [index, evento, canal, habilitado] of [
    [1, 'notificacion.leida', 'app', true],
    [2, 'notificacion.leida', 'email', true],
    [3, 'reporte.generado', 'app', false],
    [4, 'reporte.generado', 'email', true],
  ] as const) {
    await client.query(
      `INSERT INTO public.preferencia_notificacion (id, usuario_id, evento, canal, habilitado)
       VALUES ($1, $2, $3, $4, $5)`,
      [`bbbbbbbb-0000-4000-8000-00000000000${index}`, estudianteUsuarioId, evento, canal, habilitado],
    );
  }
}

/** UUID v5 determinista (RFC 4122) derivado del namespace de la semilla. */
function uuidV5(name: string): string {
  const namespace = Buffer.from('6f1a7d2c3b4e5f608a1b2c3d4e5f6071', 'hex');
  const digest = createHash('sha1').update(namespace).update(name, 'utf8').digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** AES-256-GCM con el mismo formato que `shared/security/encryption.ts`. */
function encrypt(plain: string, aad: string, secret: string): string {
  const key = createHash('sha256').update(secret, 'utf8').digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export default globalSetup;
