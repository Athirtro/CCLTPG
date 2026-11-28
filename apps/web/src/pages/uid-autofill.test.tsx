import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { apiClient } from '../api/client';
import { AuthProvider, type User } from '../contexts/AuthContext';
import { theme } from '../theme/theme';
import Grupos from './Grupos';
import Matriculas from './Matriculas';

const EDU_UID = '22222222-2222-7222-8222-222222222222';
const EST_UID = '33333333-3333-7333-8333-333333333333';

const educador: User = {
  id: EDU_UID,
  email: 'temporal@ccltpg.org',
  fullName: 'Educador Prueba',
  role: 'Educador',
  profiles: ['educador'],
  permissions: ['academic:group:manage', 'academic:group:read'],
  mfaEnabled: false,
  mustChangePassword: false,
};

const estudianteGestor: User = {
  id: '44444444-4444-7444-8444-444444444444',
  email: 'gestor@ccltpg.org',
  fullName: 'Gestor Estudiante',
  role: 'Gestor',
  profiles: ['estudiante', 'administrador'],
  permissions: [
    'academic:enrollment:read',
    'academic:enrollment:read_own',
    'academic:enrollment:create',
    'academic:enrollment:update',
  ],
  mfaEnabled: false,
  mustChangePassword: false,
};

function renderPagina(pagina: React.ReactElement, usuario: User) {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider initialUser={usuario}>
        <MemoryRouter>{pagina}</MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('autorelleno de UID', () => {
  beforeEach(() => {
    document.cookie = 'ccltpg_session=; Path=/; Max-Age=0';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('prerellena el UID del educador al crear un grupo y permite restaurarlo', async () => {
    vi.spyOn(apiClient, 'GET').mockImplementation(((path: string) =>
      Promise.resolve({
        data: path === '/academic/programs' ? { data: [] } : { data: [] },
        error: undefined,
        response: { status: 200 },
      })) as never);

    renderPagina(<Grupos />, educador);
    const abrir = await screen.findByRole('button', { name: 'Nuevo grupo' });
    await waitFor(() => expect(abrir).toBeEnabled());
    fireEvent.click(abrir);

    const campo = await screen.findByLabelText(/ID del educador/u);
    expect(campo).toHaveValue(EDU_UID);
    expect(screen.getByRole('button', { name: 'Usar mi UID' })).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: 'otro-educador' } });
    expect(campo).toHaveValue('otro-educador');
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi UID' }));
    expect(campo).toHaveValue(EDU_UID);
  });

  it('preselecciona el UID propio en Matrículas aunque el usuario pueda gestionar', async () => {
    vi.spyOn(apiClient, 'GET').mockImplementation(((path: string) => {
      if (path === '/me/student') {
        return Promise.resolve({
          data: {
            id: EST_UID,
            nombres: 'Ana',
            apellidos: 'Pérez',
          },
          error: undefined,
          response: { status: 200 },
        });
      }
      if (path === '/academic/students') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: EST_UID,
                usuarioId: estudianteGestor.id,
                tipoDocumento: 'TI',
                nombres: 'Ana',
                apellidos: 'Pérez',
                municipio: null,
                barrio: null,
                consentimientoAceptado: true,
                creadoEn: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
          error: undefined,
          response: { status: 200 },
        });
      }
      return Promise.resolve({
        data: { data: [] },
        error: undefined,
        response: { status: 200 },
      });
    }) as never);

    renderPagina(<Matriculas />, estudianteGestor);
    const abrir = await screen.findByRole('button', { name: 'Nueva matrícula' });
    await waitFor(() => expect(abrir).toBeEnabled());
    fireEvent.click(abrir);

    const selector = await screen.findByRole('combobox', { name: 'Estudiante' });
    expect(selector).toHaveTextContent('Ana Pérez');
    expect(screen.getByText(`Tu UID: ${EST_UID}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Usar mi UID' }));
    expect(selector).toHaveTextContent('Ana Pérez');
  });
});
