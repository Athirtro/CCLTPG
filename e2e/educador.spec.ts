import { expect } from '@playwright/test';
import { test } from './helpers/test.js';

import { loginAs } from './helpers/auth.js';

test('el educador accede a la vista de grupos, sesión y asistencia', async ({ page }) => {
  await loginAs(page, 'educador');
  await page.goto('/vista-educador');
  await expect(page.getByRole('heading', { name: 'Vista del educador' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actualizar grupos' })).toBeVisible();
  await expect(page.getByText('1. Selecciona un grupo')).toBeVisible();
});
