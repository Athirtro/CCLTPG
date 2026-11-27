import { expect } from '@playwright/test';

import { E2E_EMISORA, E2E_EMISORA_E4, E2E_USERS } from './fixtures.js';
import { loginAs } from './helpers/auth.js';
import { test } from './helpers/test.js';

/** MP3 mínimo reconocido por `file-type` por sus bytes mágicos. */
const AUDIO_MP3 = Buffer.concat([Buffer.from('fffb9064', 'hex'), Buffer.alloc(400)]);

/** La regla RF-06.5 usa días calendario de Bogotá, no fechas UTC. */
function fechaBogota(instante: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(instante)
      .filter((parte) => parte.type !== 'literal')
      .map((parte) => [parte.type, parte.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

test('la operación E2 de la emisora recorre convocatoria, rejilla, programación y audio', async ({
  page,
}) => {
  await loginAs(page, 'jefe_emisora');
  await page.goto('/emisora/operacion');

  await expect(page.getByRole('heading', { name: 'Operación E2 de la emisora' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Convocatorias de la emisora' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Rejilla anual' })).toContainText('Borrador');
  await expect(page.getByRole('alert')).toHaveCount(0);

  // RF-03.3: el comité con acta PDF limpia se vincula a la rejilla del año.
  await page.getByLabel('ID del acta PDF').fill(E2E_EMISORA.actaArchivoId);
  await page.getByRole('button', { name: 'Registrar comité' }).click();
  await expect(page.getByRole('alert')).toHaveText('Comité registrado y vinculado a la rejilla.');

  await page.getByRole('button', { name: 'Aprobar rejilla' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Aprobar rejilla anual');
  await page.getByRole('dialog').getByRole('button', { name: 'Aprobar rejilla' }).click();
  await expect(page.getByRole('alert')).toHaveText('Rejilla aprobada con acta de comité.');
  await expect(page.getByRole('table', { name: 'Rejilla anual' })).toContainText('Aprobada');

  // RF-01: la programación se verifica contra la rejilla sin modificarla.
  await page.getByRole('button', { name: 'Crear programación' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Programación creada y verificada contra la rejilla.',
  );
  await expect(page.getByRole('table', { name: 'Programación diaria' })).toContainText('Sí');
  await page.getByRole('button', { name: 'Aprobar programación' }).click();
  await expect(page.getByRole('alert')).toHaveText('Programación aprobada correctamente.');

  // RF-02: asistencia en cabina y archivo de audio con política opt-in.
  await page.getByRole('button', { name: 'Agendar grabación' }).click();
  await expect(page.getByRole('alert')).toHaveText('Sesión de grabación agendada.');
  await page.getByRole('button', { name: 'Registrar asistencia' }).click();
  await expect(page.getByRole('alert')).toHaveText('Asistencia registrada.');

  await page.locator('#audio-emisora').setInputFiles({
    name: 'e2e-emisora.mp3',
    mimeType: 'audio/mpeg',
    buffer: AUDIO_MP3,
  });
  await page.getByRole('button', { name: 'Subir audio' }).click();
  await expect(page.getByRole('alert')).toHaveText('Audio archivado con metadatos.');
  await expect(page.getByRole('table', { name: 'Audios archivados' })).toContainText(
    'e2e-emisora.mp3',
  );
  await expect(page.getByRole('table', { name: 'Audios archivados' })).toContainText('Limpio');
});

test('la operación E3 de la emisora recorre soportes, transmisiones y resolución PDF', async ({
  page,
}) => {
  const jefe = E2E_USERS.find((usuario) => usuario.key === 'jefe_emisora');
  if (!jefe) throw new Error('Falta la fixture jefe_emisora para el recorrido E3.');
  const fechaTransmision = fechaBogota(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
  // Mañana en Bogotá: solo un día de antelación, siempre insuficiente.
  const fechaCorta = fechaBogota(new Date(Date.now() + 24 * 60 * 60 * 1000));

  await loginAs(page, 'jefe_emisora');
  await page.goto('/emisora/operacion-e3');

  await expect(page.getByRole('heading', { name: 'Operación E3 de la emisora' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  // RF-04: el patrocinio en borrador no se aprueba sin contrato PDF limpio.
  await page.getByRole('button', { name: 'Proponer patrocinio' }).click();
  await expect(page.getByRole('alert')).toHaveText('Patrocinio propuesto.');
  await page.getByRole('button', { name: 'Aprobar patrocinio' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Aprobar un patrocinio exige un contrato PDF limpio.',
  );
  await page.getByLabel('ID del contrato PDF').fill(E2E_EMISORA.contratoArchivoId);
  await page.getByRole('button', { name: 'Aprobar patrocinio' }).click();
  await expect(page.getByRole('alert')).toHaveText('Patrocinio aprobado con contrato.');

  // RF-05: la promo exige audio limpio antes de producirse.
  await page.getByRole('button', { name: 'Registrar promo' }).click();
  await expect(page.getByRole('alert')).toHaveText('Promo registrada en borrador.');
  // Un PDF limpio no sirve como audio: se comprueba el MIME en Archivos.
  await page.getByLabel('ID del audio limpio').fill(E2E_EMISORA.actaArchivoId);
  await page.getByRole('button', { name: 'Producir promo' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Audio de la promo debe ser un archivo limpio y compatible.',
  );
  await page.getByLabel('ID del audio limpio').fill(E2E_EMISORA.audioPromoArchivoId);
  await page.getByRole('button', { name: 'Producir promo' }).click();
  await expect(page.getByRole('alert')).toHaveText('Promo producida con audio verificado.');

  // RF-04.3/RF-05: orden de emisión y publicación encadenadas a la promo.
  await page.getByRole('button', { name: 'Crear orden' }).click();
  await expect(page.getByRole('alert')).toHaveText('Orden de emisión creada.');
  await page.getByRole('button', { name: 'Programar orden' }).click();
  await expect(page.getByRole('alert')).toHaveText('Orden de emisión programada.');
  await page.getByRole('button', { name: 'Emitir orden' }).click();
  await expect(page.getByRole('alert')).toHaveText('Orden de emisión emitida.');
  await page.getByRole('button', { name: 'Programar publicación' }).click();
  await expect(page.getByRole('alert')).toHaveText('Publicación programada.');
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Publicación realizada.');

  // RF-06: la transmisión no se autoriza sin salida de equipo y desplazamiento.
  await page.getByLabel('Fecha de transmisión').fill(fechaTransmision);
  await page.getByRole('button', { name: 'Programar transmisión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Transmisión programada.');
  await page.getByRole('button', { name: 'Autorizar transmisión' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'La transmisión exige salida de equipo y reporte de desplazamiento.',
  );

  await page.getByLabel('Responsable del equipo').fill(jefe.id);
  await page.getByRole('button', { name: 'Registrar salida' }).click();
  await expect(page.getByRole('alert')).toHaveText('Salida de equipo registrada.');
  await page.getByRole('button', { name: 'Registrar desplazamiento' }).click();
  await expect(page.getByRole('alert')).toHaveText('Desplazamiento registrado.');
  await page.getByRole('button', { name: 'Autorizar transmisión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Transmisión autorizada.');

  // RF-06.5: dos días calendario de antelación en Bogotá y autorización del mifi.
  await page.getByLabel('Usuario del mifi').fill(jefe.id);
  await page.getByRole('button', { name: 'Solicitar mifi' }).click();
  await expect(page.getByRole('alert')).toHaveText('Préstamo de mifi solicitado.');
  await page.getByRole('button', { name: 'Autorizar mifi' }).click();
  await expect(page.getByRole('alert')).toHaveText('Préstamo de mifi autorizado.');

  // RF-06.6: el viático solo se solicita cuando la transmisión es fuera de la ciudad.
  await page.getByLabel('Usuario del viático').fill(jefe.id);
  await page.getByRole('button', { name: 'Solicitar viático' }).click();
  await expect(page.getByRole('alert')).toHaveText('Viático solicitado.');

  await page.getByLabel('Fecha de transmisión').fill(fechaCorta);
  await page.getByRole('button', { name: 'Programar transmisión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Transmisión programada.');
  await page.getByRole('button', { name: 'Solicitar mifi' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'El préstamo de mifi debe solicitarse al menos dos días antes de la transmisión.',
  );

  await page.getByLabel('Fuera de la ciudad').uncheck();
  await page.getByRole('button', { name: 'Programar transmisión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Transmisión programada.');
  await page.getByRole('button', { name: 'Solicitar viático' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Los viáticos solo aplican a transmisiones fuera de la ciudad.',
  );

  // RF-03.7: PDF con la plantilla de Exportaciones, descargable por Archivos.
  await page.getByLabel('ID del incentivo').fill(E2E_EMISORA.incentivoId);
  await page.getByRole('button', { name: 'Generar resolución' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Resolución PDF generada.' }),
  ).toBeVisible();
  const descargar = page.getByRole('button', { name: 'Descargar resolución generada' });
  await expect(descargar).toBeVisible();
  const esperada = page.waitForEvent('download');
  await descargar.click();
  const archivo = await esperada;
  expect(archivo.suggestedFilename()).toBe('resolucion-incentivos.pdf');
  const ruta = await archivo.path();
  expect(ruta).not.toBeNull();
  const contenido = await import('node:fs/promises').then((fs) => fs.readFile(ruta!));
  expect(contenido.subarray(0, 5).toString('ascii')).toBe('%PDF-');
});

test('la operación E4 recorre sede, derechos, tecnología, archivo y trámites', async ({ page }) => {
  await loginAs(page, 'jefe_emisora');
  await page.goto('/emisora/operacion-e4');

  await expect(page.getByRole('heading', { name: 'Operación E4 de la emisora' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('ID del transmisor')).toHaveValue(E2E_EMISORA_E4.transmisorId);
  await expect(page.getByLabel('Fecha de operación')).toHaveValue(E2E_EMISORA_E4.fechaOperacion);

  // RF-07: turno, lectura única por transmisor/fecha y bitácora con actor.
  await page.getByRole('button', { name: 'Asignar turno' }).click();
  await expect(page.getByRole('alert')).toHaveText('Turno asignado.');
  await page.getByRole('button', { name: 'Confirmar turno' }).click();
  await expect(page.getByRole('alert')).toHaveText('Turno confirmado.');
  await page.getByRole('button', { name: 'Registrar lectura' }).click();
  await expect(page.getByRole('alert')).toHaveText('Lectura registrada.');
  await page.getByRole('button', { name: 'Registrar lectura' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Ya existe una lectura para este transmisor en la fecha indicada.',
  );
  await page.getByRole('button', { name: 'Registrar bitácora' }).click();
  await expect(page.getByRole('alert')).toHaveText('Bitácora registrada.');
  await page.getByRole('button', { name: 'Listar lecturas' }).click();
  await expect(page.getByRole('alert')).toHaveText('1 lectura(s) consultada(s).');

  // RF-08: el reporte PDF se genera sobre la obra incluida en el periodo.
  await page.getByRole('button', { name: 'Incluir obra' }).click();
  await expect(page.getByRole('alert')).toHaveText('Obra incluida.');
  await page.getByRole('button', { name: 'Generar reporte de obras' }).click();
  await expect(page.getByRole('alert')).toHaveText('Reporte de obras generado.');
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(page.getByRole('alert')).toHaveText('Pago de derechos registrado.');

  // RF-09: hoja de vida, actualización, proyección, inversión y software.
  await page.getByRole('button', { name: 'Registrar equipo' }).click();
  await expect(page.getByRole('alert')).toHaveText('Equipo registrado.');
  await page.getByRole('button', { name: 'Actualizar equipo' }).click();
  await expect(page.getByRole('alert')).toHaveText('Equipo actualizado.');
  await page.getByRole('button', { name: 'Solicitar actualización' }).click();
  await expect(page.getByRole('alert')).toHaveText('Actualización solicitada.');
  await page.getByRole('button', { name: 'Aprobar actualización' }).click();
  await expect(page.getByRole('alert')).toHaveText('Actualización aprobada.');
  await page.getByRole('button', { name: 'Registrar proyección' }).click();
  await expect(page.getByRole('alert')).toHaveText('Proyección registrada.');
  await page.getByRole('button', { name: 'Aprobar proyección' }).click();
  await expect(page.getByRole('alert')).toHaveText('Proyección aprobada.');
  await page.getByRole('button', { name: 'Registrar inversión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Inversión registrada.');
  await page.getByRole('button', { name: 'Aprobar inversión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Inversión aprobada.');
  await page.getByRole('button', { name: 'Registrar software' }).click();
  await expect(page.getByRole('alert')).toHaveText('Versión de software registrada.');
  await page.getByRole('button', { name: 'Asignar equipo' }).click();
  await expect(page.getByRole('alert')).toHaveText('Equipo asignado.');

  // RF-10/RF-11: oficio de salida, archivo sonoro y planilla única.
  await page.getByRole('button', { name: 'Registrar actividad' }).click();
  await expect(page.getByRole('alert')).toHaveText('Actividad registrada.');
  await page.getByRole('button', { name: 'Listar actividades' }).click();
  await expect(page.getByRole('alert')).toContainText('actividad(es) consultada(s).');
  await page.getByRole('button', { name: 'Emitir permiso' }).click();
  await expect(page.getByRole('alert')).toHaveText('Permiso de salida emitido.');
  await page.getByRole('button', { name: 'Archivar audio' }).click();
  await expect(page.getByRole('alert')).toHaveText('Audio archivado.');
  await page.getByRole('button', { name: 'Generar planilla' }).click();
  await expect(page.getByRole('alert')).toHaveText('Planilla generada.');

  // RF-12: ciclo completo de radicación, soporte PDF, respuesta y archivo.
  await page.getByRole('button', { name: 'Radicar trámite' }).click();
  await expect(page.getByRole('alert')).toHaveText('Trámite radicado.');
  await page.getByRole('button', { name: 'Listar trámites' }).click();
  await expect(page.getByRole('alert')).toContainText('trámite(s) consultado(s).');
  await page.getByRole('button', { name: 'Adjuntar soporte' }).click();
  await expect(page.getByRole('alert')).toHaveText('Soporte adjuntado.');
  await page.getByRole('button', { name: 'Poner en trámite' }).click();
  await expect(page.getByRole('alert')).toHaveText('Trámite en trámite.');
  await page.getByRole('button', { name: 'Registrar respuesta' }).click();
  await expect(page.getByRole('alert')).toHaveText('Respuesta registrada.');
  await page.getByRole('button', { name: 'Archivar trámite' }).click();
  await expect(page.getByRole('alert')).toHaveText('Trámite archivado.');
});
