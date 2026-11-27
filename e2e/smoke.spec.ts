import { expect } from '@playwright/test';
import { test } from './helpers/test.js';

test('la API responde salud y la SPA sirve las rutas públicas', async ({ page, request }) => {
  const health = await request.get('http://localhost:3000/api/v1/health/ready');
  expect(health.status()).toBe(200);

  await page.goto('/login');
  await expect(page).toHaveTitle(/CCLTPG/);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  // `/estado` es privado: sin sesión el guard debe llevar al login.
  await page.goto('/estado');
  await expect(page).toHaveURL(/\/login/);
});

test('un deep-link privado sin sesión redirige al login', async ({ page }) => {
  await page.goto('/estudiantes');
  await expect(page).toHaveURL(/\/login/);
});
