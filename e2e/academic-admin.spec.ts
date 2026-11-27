import { expect } from '@playwright/test';
import { test } from './helpers/test.js';

import { E2E_USERS } from './fixtures.js';
import { loginAs } from './helpers/auth.js';

const suffix = () => Date.now().toString().slice(-8);

test('la administración crea programa, grupo, estudiante y matrícula desde la UI', async ({
  page,
}) => {
  await loginAs(page, 'admin');
  const unique = suffix();
  const programName = `Programa E2E ${unique}`;
  const groupCode = `G-E2E-${unique}`;
  const studentDoc = `900${unique}`;

  // Programa
  await page.goto('/programas');
  await expect(page.getByRole('heading', { name: 'Programas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo programa' }).click();
  await page.getByLabel('Nombre del programa').fill(programName);
  await page.getByRole('combobox', { name: 'Área artística' }).click();
  await page.getByRole('option', { name: 'Danza' }).click();
  await page.getByLabel('Descripción').fill('Programa determinista de prueba E2E');
  await page.getByLabel('Cupo máximo').fill('12');
  await page.getByRole('button', { name: 'Crear programa' }).click();
  await expect(page.getByText(new RegExp(`Programa "${programName}" creado`))).toBeVisible();

  // El listado está ordenado y paginado: filtramos para que la fila nueva sea inequívoca.
  await page.getByLabel('Buscar programa').fill(programName);
  await page
    .getByRole('row', { name: new RegExp(programName) })
    .getByRole('button', { name: 'Publicar' })
    .click();
  await page.getByRole('button', { name: 'Publicar', exact: true }).last().click();
  await expect(
    page.getByText(new RegExp(`Estado del programa "${programName}" cambiado a publicado`)),
  ).toBeVisible();

  // Grupo
  await page.goto('/grupos');
  await expect(page.getByRole('heading', { name: 'Grupos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo grupo' }).click();
  await page.getByLabel('Código del grupo (ej. G-01)').fill(groupCode);
  await page.getByRole('combobox', { name: 'Programa' }).click();
  await page.getByRole('option', { name: new RegExp(programName) }).click();
  const educador = E2E_USERS.find((user) => user.key === 'educador')!;
  await page.getByLabel('ID del educador (UUID)').fill(educador.id);
  await page.getByLabel('Periodo (ej. 2026-1)').fill('2026-1');
  await page.getByLabel('Cupo máximo').fill('10');
  await page.getByRole('button', { name: 'Crear grupo' }).click();
  await expect(page.getByText(new RegExp(`Grupo "${groupCode}" creado`))).toBeVisible();

  // Estudiante
  await page.goto('/estudiantes');
  await expect(page.getByRole('heading', { name: 'Estudiantes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo estudiante' }).click();
  await page.getByRole('combobox', { name: 'Tipo de documento' }).click();
  await page.getByRole('option', { name: 'Cédula de ciudadanía (CC)' }).click();
  await page.getByLabel('Número de documento').fill(studentDoc);
  await page.getByLabel('Nombres').fill('E2E');
  await page.getByLabel('Apellidos').fill(`Prueba ${unique}`);
  await page
    .getByRole('checkbox', {
      name: 'El estudiante autoriza el tratamiento de sus datos personales',
    })
    .check();
  await page.getByRole('button', { name: 'Crear estudiante' }).click();
  await expect(page.getByText(new RegExp('creado correctamente'))).toBeVisible();

  // Matrícula
  await page.goto('/matriculas');
  await expect(page.getByRole('heading', { name: 'Matrículas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva matrícula' }).click();
  await page.getByRole('combobox', { name: 'Estudiante' }).click();
  await page.getByRole('option', { name: new RegExp(`Prueba ${unique}`) }).click();
  await page.getByRole('combobox', { name: 'Grupo abierto' }).click();
  await page.getByRole('option', { name: new RegExp(groupCode) }).click();
  await page.getByRole('button', { name: 'Crear matrícula' }).click();
  await expect(page.getByText(/matrícula .* creada|Matrícula creada/i)).toBeVisible();
});
