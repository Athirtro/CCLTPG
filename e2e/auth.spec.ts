import { expect } from '@playwright/test';
import { test } from './helpers/test.js';

import { E2E_NEW_PASSWORD, E2E_PASSWORD, userByKey } from './fixtures.js';
import { completePendingAuthStates, loginAs, logoutFromUi } from './helpers/auth.js';
import { clearRateLimits } from './helpers/rate-limits.js';
import { totpCode } from './helpers/totp.js';
import { E2E_TOTP_SECRET } from './fixtures.js';

test('rechaza credenciales inválidas con un mensaje visible', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('e2e-estudiante@ccltpg.org');
  await page.getByLabel('Contraseña').fill('clave-incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('agota el límite de intentos fallidos de login desde la UI', async ({ page }) => {
  // El `beforeEach` ya limpia los contadores; repetirlo deja claro que este
  // caso empieza con el límite intacto y no depende del orden de las specs.
  await clearRateLimits();
  await page.goto('/login');

  for (let intento = 0; intento < 6; intento += 1) {
    await page.getByLabel('Correo electrónico').fill('e2e-rate-limit@ccltpg.org');
    await page.getByLabel('Contraseña').fill('clave-incorrecta');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  }

  await expect(page.getByRole('alert')).toContainText(/Demasiados intentos/i);
  await expect(page).toHaveURL(/\/login/);
});

test('el estudiante inicia sesión sin MFA y ve su panel', async ({ page }) => {
  await loginAs(page, 'estudiante');
  await expect(page.getByRole('heading', { name: /Bienvenido,/ })).toBeVisible();
  await expect(page.getByText('Accesos rápidos')).toBeVisible();
});

test('el administrador verifica MFA, recarga la sesión y cierra sesión', async ({ page }) => {
  await loginAs(page, 'admin');
  await expect(page.getByRole('heading', { name: /Bienvenido,/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /Bienvenido,/ })).toBeVisible();

  await logoutFromUi(page);
  await expect(page).toHaveURL(/\/login/);
});

test('rechaza un código TOTP incorrecto', async ({ page }) => {
  const admin = userByKey('admin');
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(admin.email);
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/mfa-verify/);

  await page
    .getByLabel('Código MFA')
    .fill('000000' === totpCode(E2E_TOTP_SECRET) ? '111111' : '000000');
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/mfa-verify/);
});

test('valida la longitud de la nueva contraseña antes de llamar a la API', async ({ page }) => {
  const user = userByKey('cambio');
  const passwordRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/auth/password')) passwordRequests.push(request.method());
  });

  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/password-change/);

  await page.getByLabel('Contraseña actual').fill(E2E_PASSWORD);
  await page.getByLabel('Nueva contraseña').fill('Corta123#');
  await page.getByLabel('Confirmar contraseña').fill('Corta123#');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

  await expect(page.getByRole('alert')).toContainText('entre 12 y 128 caracteres');
  expect(passwordRequests).toHaveLength(0);
});

test('el cambio forzado de contraseña continúa hasta la inscripción MFA', async ({ page }) => {
  const user = userByKey('cambio');
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/password-change/);

  await page.getByLabel('Contraseña actual').fill(E2E_PASSWORD);
  await page.getByLabel('Nueva contraseña').fill(E2E_NEW_PASSWORD);
  await page.getByLabel('Confirmar contraseña').fill(E2E_NEW_PASSWORD);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

  await expect(page).toHaveURL(/\/mfa-enroll/, { timeout: 15_000 });
  await completePendingAuthStates(page, {
    currentPassword: E2E_NEW_PASSWORD,
    newPassword: E2E_NEW_PASSWORD,
  });
  await expect(page.getByRole('heading', { name: /Bienvenido,/ })).toBeVisible();
});
