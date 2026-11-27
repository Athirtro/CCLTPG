import { expect } from '@playwright/test';
import { test } from './helpers/test.js';

import { loginAs } from './helpers/auth.js';

test('el estado del sistema muestra disponibilidad real', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/estado');
  await expect(page.getByRole('heading', { name: 'Estado del sistema' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Estado de las dependencias' })).toBeVisible();
});

test('los indicadores KPI cargan con el periodo requerido', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/kpis');
  await expect(page.getByRole('heading', { name: 'Indicadores (KPIs)' })).toBeVisible();
  await expect(page.getByText('Detalle y desglose')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('el catálogo de reportes genera un archivo', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/reportes');
  await expect(page.getByRole('heading', { name: 'Reportes', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Catálogo de reportes' })).toBeVisible();

  await page.getByRole('button', { name: 'Seleccionar' }).first().click();
  await page.getByLabel('Parámetros (JSON)').fill('{"periodo":"2026-1"}');
  await page.getByRole('button', { name: 'Generar reporte' }).click();
  await expect(page.getByRole('heading', { name: 'Resultado', exact: true })).toBeVisible();
});

test('las exportaciones generan y permiten descargar un archivo', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/exportaciones');
  await expect(page.getByRole('heading', { name: 'Exportaciones' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Plantilla' }).click();
  await page.getByRole('option', { name: 'Estudiantes activos' }).click();
  await page.getByRole('combobox', { name: 'Formato' }).click();
  await page.getByRole('option', { name: 'CSV' }).click();
  await page
    .getByLabel('Parámetros (JSON)')
    .fill(
      '{"periodo":"2026-1","filas":[{"programa":"Programa E2E Estudiante","grupo":"G-E2E-MI","estado":"activa","total":1}]}',
    );
  await page.getByRole('button', { name: 'Generar exportación' }).click();
  await expect(page.getByRole('heading', { name: 'Resultado', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar archivo' })).toBeVisible();
});

test('la gestión de archivos sube un documento y muestra sus metadatos', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/archivos');
  await expect(page.getByRole('heading', { name: 'Gestión de archivos' })).toBeVisible();

  await page.locator('#archivo-input').setInputFiles({
    name: 'e2e.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% E2E\n%%EOF\n'),
  });
  await page.getByRole('button', { name: 'Subir archivo' }).click();
  await expect(page.getByText('Resultado de la última carga')).toBeVisible();
  await expect(page.getByText('e2e.pdf').first()).toBeVisible();
});

test('la administración lista usuarios reales del backend', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Administración' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Listado de usuarios' })).toBeVisible();

  await page.getByLabel('Buscar usuario').fill('e2e-admin@ccltpg.org');
  await expect(page.getByRole('row', { name: /e2e-admin@ccltpg\.org/ })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
