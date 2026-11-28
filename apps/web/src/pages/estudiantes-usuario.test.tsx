import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';

import { apiClient } from '../api/client';
import { AuthProvider, type User } from '../contexts/AuthContext';
import { theme } from '../theme/theme';
import Estudiantes from './Estudiantes';

const UID_USUARIO = '55555555-5555-7555-8555-555555555555';
const UID_ESTUDIANTE = '66666666-6666-7666-8666-666666666666';

const administrador: User = {
  id: 'admin-estudiantes',
  email: 'admin-estudiantes@ccltpg.org',
  fullName: 'Administrador Estudiantes',
  role: 'Administrador',
  profiles: ['administrador'],
  permissions: ['academic:student:manage', 'identity:user:manage'],
  mfaEnabled: false,
  mustChangePassword: false,
};

const usuario = {
  id: UID_USUARIO,
  email: 'vinculado@ccltpg.edu.co',
  nombre: 'Usuario Vinculado',
  estado: 'activo' as const,
  mfaHabilitado: false,
  debeCambiarPassword: false,
  creadoEn: '2026-01-01T00:00:00.000Z',
  actualizadoEn: '2026-01-01T00:00:00.000Z',
};

const estudianteBase = {
  id: UID_ESTUDIANTE,
  usuarioId: null as string | null,
  tipoDocumento: 'TI',
  nombres: 'Ana',
  apellidos: 'Pérez',
  municipio: null,
  barrio: null,
  consentimientoAceptado: true,
  creadoEn: '2026-01-01T00:00:00.000Z',
};

function mockLecturas(usuarioId: string | null = null) {
  const estudiante = { ...estudianteBase, usuarioId };
  vi.spyOn(apiClient, 'GET').mockImplementation(((path: string) => {
    if (path === '/identity/users') {
      return Promise.resolve({
        data: { items: [usuario], total: 1, limit: 200, offset: 0 },
        error: undefined,
        response: { status: 200 },
      });
    }
    if (path === '/academic/students') {
      return Promise.resolve({
        data: { page: 1, pageSize: 10, total: 1, data: [estudiante] },
        error: undefined,
        response: { status: 200 },
      });
    }
    return Promise.resolve({ data: undefined, error: undefined, response: { status: 200 } });
  }) as never);
}

function renderEstudiantes() {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider initialUser={administrador}>
        <MemoryRouter>
          <Estudiantes />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

async function abrirNuevoEstudiante() {
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo estudiante' }));
  await screen.findByRole('dialog', { name: 'Nuevo estudiante' });
}

describe('vinculación de usuario en la ficha de estudiante', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('envía usuarioId al crear una ficha vinculada', async () => {
    mockLecturas();
    const post = vi.spyOn(apiClient, 'POST').mockImplementation((() =>
      Promise.resolve({
        data: { ...estudianteBase, usuarioId: UID_USUARIO },
        error: undefined,
        response: { status: 201 },
      })) as never);

    renderEstudiantes();
    await abrirNuevoEstudiante();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Tipo de documento/u }));
    fireEvent.click(await screen.findByRole('option', { name: /Cédula de ciudadanía/u }));
    fireEvent.change(screen.getByLabelText(/Número de documento/u), {
      target: { value: '1020304050' },
    });
    fireEvent.change(screen.getByLabelText(/Nombres/u), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/Apellidos/u), { target: { value: 'Pérez' } });

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Usuario asociado (opcional)' }));
    fireEvent.click(await screen.findByRole('option', { name: /vinculado@ccltpg\.edu\.co/u }));

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'El estudiante autoriza el tratamiento de sus datos personales',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Crear estudiante' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]?.[0]).toBe('/academic/students');
    const body = post.mock.calls[0]?.[1] as { body: { usuarioId?: string | null } };
    expect(body.body.usuarioId).toBe(UID_USUARIO);
  }, 20000);

  it('permite desvincular el usuario al editar la ficha', async () => {
    mockLecturas(UID_USUARIO);
    const patch = vi.spyOn(apiClient, 'PATCH').mockImplementation((() =>
      Promise.resolve({
        data: { ...estudianteBase, usuarioId: null },
        error: undefined,
        response: { status: 200 },
      })) as never);

    renderEstudiantes();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar ficha' }));
    await screen.findByRole('dialog', { name: 'Editar ficha del estudiante' });

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Usuario asociado (opcional)' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Sin vincular' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const body = patch.mock.calls[0]?.[1] as { body: { usuarioId?: string | null } };
    expect(body.body.usuarioId).toBeNull();
  }, 20000);
});
