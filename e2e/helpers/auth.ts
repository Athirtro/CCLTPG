import { expect, type Page } from '@playwright/test';

import {
  E2E_NEW_PASSWORD,
  E2E_PASSWORD,
  E2E_TOTP_SECRET,
  type E2eUserKey,
  userByKey,
} from '../fixtures.js';
import { clearRateLimits } from './rate-limits.js';
import { totpCode } from './totp.js';

/** Extrae el secreto TOTP mostrado por la UI de inscripción. */
export function extractSecretFromUri(uri: string): string {
  const match = /[?&]secret=([A-Z2-7]+)/i.exec(uri);
  if (!match) throw new Error(`No se encontró el secreto en: ${uri}`);
  return match[1]!.toUpperCase();
}

/**
 * Inicia sesión por la interfaz real y completa los estados intermedios
 * (cambio de contraseña, inscripción y verificación MFA) hasta llegar al home.
 */
export async function loginAs(
  page: Page,
  key: E2eUserKey,
  options: { password?: string; newPassword?: string } = {},
): Promise<void> {
  const user = userByKey(key);
  const password = options.password ?? E2E_PASSWORD;

  // Cada login de la suite debe ser independiente de los contadores previos.
  await clearRateLimits();
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await completePendingAuthStates(page, {
    currentPassword: password,
    newPassword: options.newPassword ?? E2E_NEW_PASSWORD,
  });

  await expect(page).not.toHaveURL(/\/login|\/mfa-verify|\/mfa-enroll|\/password-change/);
}

/** Completa cualquier estado de autenticación pendiente según la ruta visible. */
export async function completePendingAuthStates(
  page: Page,
  options: { currentPassword: string; newPassword: string } = {
    currentPassword: E2E_PASSWORD,
    newPassword: E2E_NEW_PASSWORD,
  },
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    // Esperamos a que el login cambie de ruta; de lo contrario leeríamos
    // `/login` antes de que `AuthRedirect` navegue al estado real.
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 15_000 });
    const path = new URL(page.url()).pathname;

    if (path === '/password-change') {
      await page.getByLabel('Contraseña actual').fill(options.currentPassword);
      await page.getByLabel('Nueva contraseña').fill(options.newPassword);
      await page.getByLabel('Confirmar contraseña').fill(options.newPassword);
      await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
      // Tras el cambio puede aparecer la inscripción MFA o el home.
      await page.waitForURL((url) => url.pathname !== '/password-change', { timeout: 15_000 });
      continue;
    }

    if (path === '/mfa-enroll') {
      await page.getByRole('button', { name: 'Generar secreto TOTP' }).click();
      const uri = await page.getByText(/otpauth:\/\/totp/).textContent();
      if (!uri) throw new Error('La UI no mostró la URI otpauth');
      const secret = extractSecretFromUri(uri);
      await page.getByLabel('Código de verificación (6 dígitos)').fill(totpCode(secret));
      await page.getByRole('button', { name: 'Activar MFA' }).click();
      // AuthRedirect puede llevar al home antes de que se observe el estado "done".
      await page.waitForURL(/\/$/, { timeout: 15_000 });
      return;
    }

    if (path === '/mfa-verify') {
      await page.getByLabel('Código MFA').fill(totpCode(E2E_TOTP_SECRET));
      await page.getByRole('button', { name: 'Verificar' }).click();
      await page.waitForURL(/\/$/, { timeout: 15_000 });
      return;
    }

    return;
  }
  throw new Error('No se pudo completar el flujo de autenticación');
}

/** Cierra sesión desde la interfaz (botón del cajón lateral). */
export async function logoutFromUi(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Cerrar sesión' });
  if (await button.count()) {
    await button.first().click();
  } else {
    await page.getByRole('button', { name: 'Opciones de usuario' }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  }
  await expect(page).toHaveURL(/\/login/);
}
