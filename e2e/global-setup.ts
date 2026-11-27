import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import type { FullConfig } from '@playwright/test';

import {
  E2E_EMISORA,
  E2E_EMISORA_E4,
  E2E_PASSWORD,
  E2E_TOTP_SECRET,
  E2E_USERS,
} from './fixtures.js';

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
          user.mfaHabilitado
            ? encrypt(E2E_TOTP_SECRET, `mfa:usuario:${user.id}`, encryptionKey)
            : null,
          user.debeCambiarPassword,
        ],
      );

      await client.query('DELETE FROM public.refresh_token WHERE usuario_id = $1', [user.id]);
      await client.query('DELETE FROM public.codigo_recuperacion_mfa WHERE usuario_id = $1', [
        user.id,
      ]);
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
    await seedEmisoraParaE2E(client);

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

/**
 * Estado determinista del recorrido E2E de la emisora. La convocatoria y la
 * rejilla sembradas se reutilizan; solo se limpian las filas que el recorrido
 * crea y se repone el acta PDF limpia que valida la aprobación de la rejilla.
 */
async function seedEmisoraParaE2E(client: QueryableClient): Promise<void> {
  const {
    anio,
    fechaProgramacion,
    fechaComite,
    actaArchivoId,
    contratoArchivoId,
    audioPromoArchivoId,
    incentivoId,
  } = E2E_EMISORA;
  const jefe = E2E_USERS.find((usuario) => usuario.key === 'jefe_emisora');
  if (!jefe) throw new Error('Falta la fixture jefe_emisora para preparar la emisora.');

  await client.query(
    `INSERT INTO emisora.convocatoria
       (id, anio, fecha_apertura, fecha_cierre, estado, bases_archivo_id)
     VALUES ('cccccccc-0000-4000-8000-000000000001', $1,
             DATE '2026-01-15', DATE '2026-02-05', 'abierta', NULL)
     ON CONFLICT (anio) DO UPDATE SET
       fecha_apertura = EXCLUDED.fecha_apertura,
       fecha_cierre = EXCLUDED.fecha_cierre,
       estado = 'abierta',
       bases_archivo_id = NULL`,
    [anio],
  );
  await client.query(
    `INSERT INTO emisora.rejilla_anual (id, anio, estado)
     VALUES ('cccccccc-0000-4000-8000-000000000002', $1, 'borrador')
     ON CONFLICT (anio) DO UPDATE SET
       estado = 'borrador', comite_id = NULL, aprobada_en = NULL`,
    [anio],
  );
  // La franja se repone por completo: un recorrido anterior pudo dejar horas
  // distintas y la verificación RF-01.3 daría un resultado no determinista.
  await client.query(
    `DELETE FROM emisora.rejilla_anual_item
      WHERE rejilla_anual_id = (SELECT id FROM emisora.rejilla_anual WHERE anio = $1)`,
    [anio],
  );
  await client.query(
    `INSERT INTO emisora.rejilla_anual_item
       (id, rejilla_anual_id, fecha, dia_semana, hora_inicio, hora_fin, tipo, nombre)
     SELECT 'cccccccc-0000-4000-8000-00000000000a', r.id, NULL, 1,
            TIME '06:00', TIME '07:00', 'programa', 'Franja E2E'
       FROM emisora.rejilla_anual r
       WHERE r.anio = $1`,
    [anio],
  );

  await client.query(
    `DELETE FROM emisora.asistencia_cabina WHERE sesion_id IN (
       SELECT g.id FROM emisora.sesion_grabacion g
       JOIN emisora.programacion_item pi ON pi.id = g.programacion_item_id
       JOIN emisora.programacion_diaria p ON p.id = pi.programacion_diaria_id
       WHERE p.fecha = $1::date
     )`,
    [fechaProgramacion],
  );
  await client.query(
    `DELETE FROM emisora.audio WHERE sesion_grabacion_id IN (
       SELECT g.id FROM emisora.sesion_grabacion g
       JOIN emisora.programacion_item pi ON pi.id = g.programacion_item_id
       JOIN emisora.programacion_diaria p ON p.id = pi.programacion_diaria_id
       WHERE p.fecha = $1::date
     )`,
    [fechaProgramacion],
  );
  await client.query(
    `DELETE FROM emisora.sesion_grabacion WHERE programacion_item_id IN (
       SELECT pi.id FROM emisora.programacion_item pi
       JOIN emisora.programacion_diaria p ON p.id = pi.programacion_diaria_id
       WHERE p.fecha = $1::date
     )`,
    [fechaProgramacion],
  );
  await client.query(
    `DELETE FROM emisora.programacion_item WHERE programacion_diaria_id IN (
       SELECT id FROM emisora.programacion_diaria WHERE fecha = $1::date
     )`,
    [fechaProgramacion],
  );
  await client.query('DELETE FROM emisora.programacion_diaria WHERE fecha = $1::date', [
    fechaProgramacion,
  ]);
  // La rejilla referencia al comité: primero se desvincula y luego se borra.
  await client.query(
    `UPDATE emisora.rejilla_anual
        SET estado = 'borrador', comite_id = NULL, aprobada_en = NULL
      WHERE anio = $1`,
    [anio],
  );
  await client.query(
    `DELETE FROM emisora.comite
      WHERE convocatoria_id = (SELECT id FROM emisora.convocatoria WHERE anio = $1)
        AND fecha = $2::date`,
    [anio, fechaComite],
  );

  await client.query(
    `INSERT INTO public.archivo
       (id, nombre_original, mime, tamano, hash_sha256, ruta_objeto, subido_por, estado_escaneo)
     VALUES ($1, 'acta-comite-e2e.pdf', 'application/pdf', 1024,
             repeat('b1', 32), 'e2e/acta-comite.pdf', $2, 'limpio')
     ON CONFLICT (id) DO UPDATE SET estado_escaneo = 'limpio', mime = 'application/pdf'`,
    [actaArchivoId, jefe.id],
  );

  await sembrarOperacionE3(
    client,
    jefe.id,
    anio,
    contratoArchivoId,
    audioPromoArchivoId,
    incentivoId,
  );
  await sembrarOperacionE4(client, audioPromoArchivoId);
}

/**
 * Estado determinista del recorrido E3: soportes limpios y un incentivo ya
 * resuelto para generar el PDF con la plantilla de Exportaciones. Solo se
 * reemplazan las filas con IDs reservados para esta fixture.
 */
async function sembrarOperacionE3(
  client: QueryableClient,
  jefeId: string,
  anio: number,
  contratoArchivoId: string,
  audioPromoArchivoId: string,
  incentivoId: string,
): Promise<void> {
  const realizadorId = 'cccccccc-0000-4000-8000-00000000000e';
  const proyectoId = 'cccccccc-0000-4000-8000-00000000000f';
  const comiteId = 'cccccccc-0000-4000-8000-000000000010';
  const informeId = 'cccccccc-0000-4000-8000-000000000011';

  await client.query('DELETE FROM emisora.resolucion_incentivo WHERE incentivo_id = $1', [
    incentivoId,
  ]);
  await client.query('DELETE FROM emisora.incentivo WHERE id = $1', [incentivoId]);
  await client.query('DELETE FROM emisora.informe_realizador WHERE id = $1', [informeId]);
  await client.query('DELETE FROM emisora.proyecto_programa WHERE id = $1', [proyectoId]);
  await client.query('DELETE FROM emisora.comite WHERE id = $1', [comiteId]);
  await client.query('DELETE FROM emisora.realizador WHERE id = $1', [realizadorId]);

  for (const [id, nombre, mime, ruta] of [
    [contratoArchivoId, 'contrato-e2e.pdf', 'application/pdf', 'e2e/contrato.pdf'],
    [audioPromoArchivoId, 'promo-e2e.mp3', 'audio/mpeg', 'e2e/promo.mp3'],
  ] as const) {
    await client.query(
      `INSERT INTO public.archivo
         (id, nombre_original, mime, tamano, hash_sha256, ruta_objeto, subido_por, estado_escaneo)
       VALUES ($1, $2, $3, 1024, repeat('b2', 32), $4, $5, 'limpio')
       ON CONFLICT (id) DO UPDATE SET
         nombre_original = EXCLUDED.nombre_original,
         mime = EXCLUDED.mime,
         estado_escaneo = 'limpio'`,
      [id, nombre, mime, ruta, jefeId],
    );
  }

  await client.query(
    `INSERT INTO emisora.realizador
       (id, nombres, apellidos, tipo_documento, numero_documento_cifrado,
        numero_documento_hash, consentimiento_datos)
     VALUES ($1, 'Realizador', 'E2E', 'cc', 'cifrado-e2e', repeat('c2', 32), '{}'::jsonb)`,
    [realizadorId],
  );
  await client.query(
    `INSERT INTO emisora.proyecto_programa
       (id, convocatoria_id, realizador_id, titulo, archivo_id, fecha_recepcion, estado)
     VALUES ($1, (SELECT id FROM emisora.convocatoria WHERE anio = $2), $3,
             'Proyecto E3E', $4, DATE '2026-01-20', 'aprobado')`,
    [proyectoId, anio, realizadorId, contratoArchivoId],
  );
  // Fecha distinta de la del comité E2 para que la limpieza de ese recorrido
  // no alcance al comité que sostiene el incentivo de la resolución E3.
  await client.query(
    `INSERT INTO emisora.comite (id, convocatoria_id, fecha, acta_archivo_id, integrantes)
     VALUES ($1, (SELECT id FROM emisora.convocatoria WHERE anio = $2), DATE '2026-02-11', $3, '[]'::jsonb)`,
    [comiteId, anio, contratoArchivoId],
  );
  await client.query(
    `INSERT INTO emisora.informe_realizador
       (id, proyecto_id, realizador_id, fecha_informe, estado, archivo_id, calificacion)
     VALUES ($1, $2, $3, DATE '2026-10-15', 'evaluado', $4, 85)`,
    [informeId, proyectoId, realizadorId, contratoArchivoId],
  );
  await client.query(
    `INSERT INTO emisora.incentivo
       (id, informe_id, comite_id, realizador_id, estado, calificacion, referencia_cdp)
     VALUES ($1, $2, $3, $4, 'resuelto', 85, 'CDP-E2E-2026')`,
    [incentivoId, informeId, comiteId, realizadorId],
  );
}

/**
 * Estado determinista del recorrido E4: un transmisor reservado y limpieza de
 * las filas únicas por fecha/año/serie que el recorrido crea. Los soportes PDF
 * y el audio limpio se reutilizan de las fixtures E3.
 */
async function sembrarOperacionE4(
  client: QueryableClient,
  audioPromoArchivoId: string,
): Promise<void> {
  const { transmisorId, transmisorCodigo, fechaOperacion, anio, serieEquipo } = E2E_EMISORA_E4;

  await client.query('DELETE FROM emisora.bitacora_sede WHERE transmisor_id = $1', [transmisorId]);
  await client.query(
    `DELETE FROM emisora.lectura_transmisor WHERE transmisor_id = $1 AND fecha = $2::date`,
    [transmisorId, fechaOperacion],
  );
  await client.query(
    `DELETE FROM emisora.turno_operador WHERE transmisor_id = $1 AND fecha = $2::date`,
    [transmisorId, fechaOperacion],
  );
  await client.query(`DELETE FROM emisora.planilla_emision WHERE fecha = $1::date`, [
    fechaOperacion,
  ]);
  await client.query(`DELETE FROM emisora.pago_derechos WHERE referencia = 'PAGO-E2E-2026-01'`);
  await client.query(
    `DELETE FROM emisora.reporte_obra WHERE periodo = '2026-01' AND entidad = 'sayco'`,
  );
  await client.query(
    `DELETE FROM emisora.obra WHERE titulo = 'Obra E4 de prueba' AND fecha_inclusion = $1::date`,
    [fechaOperacion],
  );
  await client.query(
    `DELETE FROM emisora.permiso_gobierno WHERE actividad_id IN (
       SELECT id FROM emisora.actividad_cultural
       WHERE nombre = 'Festival E4' AND fecha = $1::date
     )`,
    [fechaOperacion],
  );
  await client.query(
    `DELETE FROM emisora.actividad_cultural WHERE nombre = 'Festival E4' AND fecha = $1::date`,
    [fechaOperacion],
  );
  await client.query(
    `DELETE FROM emisora.tramite_externo WHERE asunto = 'Solicitud E4' AND fecha_radicacion = $1::date`,
    [fechaOperacion],
  );
  await client.query(`DELETE FROM emisora.archivo_emisora WHERE archivo_id = $1`, [
    audioPromoArchivoId,
  ]);

  await client.query(
    `DELETE FROM emisora.actualizacion_tecnologica WHERE equipo_id IN (
       SELECT id FROM emisora.hoja_vida_equipo WHERE numero_serie = $1
     )`,
    [serieEquipo],
  );
  await client.query(
    `DELETE FROM emisora.version_software WHERE nombre = 'Firmware E4' AND version = '1.0.0'`,
  );
  await client.query(
    `DELETE FROM emisora.asignacion_equipo WHERE equipo_id IN (
       SELECT id FROM emisora.hoja_vida_equipo WHERE numero_serie = $1
     )`,
    [serieEquipo],
  );
  await client.query(`DELETE FROM emisora.hoja_vida_equipo WHERE numero_serie = $1`, [serieEquipo]);
  await client.query(`DELETE FROM emisora.proyeccion_anual WHERE anio = $1`, [anio]);

  await client.query(`DELETE FROM emisora.transmisor WHERE id = $1 OR codigo = $2`, [
    transmisorId,
    transmisorCodigo,
  ]);
  await client.query(
    `INSERT INTO emisora.transmisor (id, codigo, nombre, sede, frecuencia, activo)
     VALUES ($1, $2, 'Transmisor E2E', 'Sede E2E', '107.9', true)`,
    [transmisorId, transmisorCodigo],
  );
}

async function seedAcademicAndPreferences(client: QueryableClient): Promise<void> {
  const estudianteId = 'aaaaaaaa-0000-4000-8000-000000000003';
  const matriculaId = 'aaaaaaaa-0000-4000-8000-000000000004';
  const grupoId = 'aaaaaaaa-0000-4000-8000-000000000002';
  const programaId = 'aaaaaaaa-0000-4000-8000-000000000001';
  const educadorId = '22222222-2222-4222-8222-222222222222';
  const estudianteUsuarioId = '33333333-3333-4333-8333-333333333333';

  // Limpieza de nuestros propios registros para que el setup sea idempotente.
  await client.query(`DELETE FROM academic.evaluacion_cualitativa WHERE matricula_id = $1`, [
    matriculaId,
  ]);
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
      [
        `bbbbbbbb-0000-4000-8000-00000000000${index}`,
        estudianteUsuarioId,
        evento,
        canal,
        habilitado,
      ],
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
