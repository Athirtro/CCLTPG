import { expect } from '@playwright/test';
import { test } from './helpers/test.js';

import { loginAs } from './helpers/auth.js';

test('el estudiante consulta horario, evaluaciones y notificaciones', async ({ page }) => {
  await loginAs(page, 'estudiante');

  await page.goto('/mi-horario');
  await expect(page.getByRole('heading', { name: 'Mi horario de clases' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Horario de clases' })).toBeVisible();

  await page.goto('/mis-evaluaciones');
  await expect(page.getByRole('heading', { name: 'Mis evaluaciones' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Historial de evaluaciones' })).toBeVisible();

  await page.goto('/notificaciones');
  await expect(page.getByRole('heading', { name: 'Mis notificaciones' })).toBeVisible();
});

test('el estudiante consulta y guarda sus preferencias de notificación', async ({ page }) => {
  await loginAs(page, 'estudiante');
  await page.goto('/preferencias');
  await expect(page.getByRole('heading', { name: 'Preferencias de notificación' })).toBeVisible();
  await expect(page.getByText('Canales y eventos')).toBeVisible();
  await page.getByRole('switch', { name: 'reporte.generado por Notificaciones in-app' }).click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText(/Preferencias guardadas correctamente/)).toBeVisible();
});
