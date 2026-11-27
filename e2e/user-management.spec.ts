import { expect } from '@playwright/test';
import { test } from './helpers/test.js';

import { loginAs } from './helpers/auth.js';

const sufijo = () => Date.now().toString().slice(-8);

test('la UI crea, asigna perfil, cambia estado y edita un usuario real', async ({ page }) => {
  test.setTimeout(120_000);

  const unique = sufijo();
  const email = `e2e-gestion-${unique}@ccltpg.org`;
  const nombreInicial = `Usuario E2E ${unique}`;
  const nombreEditado = `Usuario Editado ${unique}`;
  const passwordInicial = 'GestionInicial#2026';
  const passwordReseteada = 'GestionNueva#2026';

  await loginAs(page, 'admin');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Administración' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Listado de usuarios' })).toBeVisible();

  // Filtramos por un correo único para que la fila creada sea inequívoca.
  await page.getByLabel('Buscar usuario').fill(email);
  const fila = page.getByRole('row').filter({ hasText: email });

  // Alta
  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  const dialogoCrear = page.getByRole('dialog', { name: 'Nuevo usuario' });
  await dialogoCrear.getByLabel('Correo electrónico').fill(email);
  await dialogoCrear.getByLabel('Nombre').fill(nombreInicial);
  await dialogoCrear.getByLabel('Contraseña inicial').fill(passwordInicial);
  await dialogoCrear.getByRole('combobox', { name: 'Perfil' }).click();
  await page.getByRole('option', { name: 'estudiante' }).click();
  await dialogoCrear.getByRole('button', { name: 'Crear usuario' }).click();
  await expect(page.getByText(new RegExp(`Usuario "${email}" creado correctamente`))).toBeVisible();
  await expect(fila).toContainText(nombreInicial);
  await expect(fila).toContainText('Pendiente');

  // Asignación de perfil
  await fila.getByRole('button', { name: 'Asignar perfil' }).click();
  const dialogoPerfil = page.getByRole('dialog', { name: 'Asignar perfil' });
  await dialogoPerfil.getByRole('combobox', { name: 'Perfil' }).click();
  await page.getByRole('option', { name: 'educador' }).click();
  await dialogoPerfil.getByRole('button', { name: 'Asignar perfil' }).click();
  await expect(page.getByText(new RegExp(`Perfil "educador" asignado a "${email}"`))).toBeVisible();

  // Transición de estado
  await fila.getByRole('button', { name: 'Cambiar estado' }).click();
  const dialogoEstado = page.getByRole('dialog', { name: 'Cambiar estado' });
  await dialogoEstado.getByLabel('Motivo (opcional)').fill('Prueba E2E de administración');
  await dialogoEstado.getByRole('combobox', { name: 'Estado destino' }).click();
  await page.getByRole('option', { name: 'inactivo' }).click();
  await dialogoEstado.getByRole('button', { name: 'Aplicar estado' }).click();
  await expect(page.getByText(new RegExp(`Estado de "${email}" cambiado a inactivo`))).toBeVisible();
  await expect(fila).toContainText('Inactivo');

  // Edición y reset de contraseña administrativo
  await fila.getByRole('button', { name: 'Editar' }).click();
  const dialogoEditar = page.getByRole('dialog', { name: 'Editar usuario' });
  await dialogoEditar.getByLabel('Nombre').fill(nombreEditado);
  await dialogoEditar.getByLabel('Nueva contraseña (opcional)').fill(passwordReseteada);
  await dialogoEditar.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText(new RegExp(`Usuario "${email}" actualizado correctamente`))).toBeVisible();

  // Persistencia comprobada tras recargar la página.
  await page.reload();
  await page.getByLabel('Buscar usuario').fill(email);
  const filaTrasRecargar = page.getByRole('row').filter({ hasText: email });
  await expect(filaTrasRecargar).toContainText(nombreEditado);
  await expect(filaTrasRecargar).toContainText('Inactivo');
  await expect(filaTrasRecargar).toContainText('Pendiente');
});
