import { expect } from '@playwright/test';

import { E2E_EMISORA } from './fixtures.js';
import { loginAs } from './helpers/auth.js';
import { test } from './helpers/test.js';

/** MP3 mínimo reconocido por `file-type` por sus bytes mágicos. */
const AUDIO_MP3 = Buffer.concat([Buffer.from('fffb9064', 'hex'), Buffer.alloc(400)]);

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
