import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { apiClient } from '../api/client';
import { AuthProvider, type User } from '../contexts/AuthContext';
import { theme } from '../theme/theme';
import Admin from './Admin';

const administrador: User = {
  id: 'admin-uid',
  email: 'admin@ccltpg.org',
  fullName: 'Administrador Prueba',
  role: 'Administrador',
  profiles: ['administrador'],
  permissions: ['identity:user:manage'],
  mfaEnabled: false,
  mustChangePassword: false,
};

const usuario = {
  id: '11111111-1111-7111-8111-111111111111',
  email: 'estudiante@ccltpg.org',
  nombre: 'Estudiante Prueba',
  estado: 'activo' as const,
  mfaHabilitado: false,
  debeCambiarPassword: false,
  creadoEn: '2026-01-01T00:00:00.000Z',
  actualizadoEn: '2026-01-01T00:00:00.000Z',
};

function simularAncho(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: width <= 600,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderAdmin() {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider initialUser={administrador}>
        <MemoryRouter>
          <Admin />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('diálogos de Administración de usuarios', () => {
  beforeEach(() => {
    document.cookie = 'ccltpg_session=; Path=/; Max-Age=0';
    simularAncho(1024);
    vi.spyOn(apiClient, 'GET').mockResolvedValue({
      data: { items: [usuario], total: 1, limit: 10, offset: 0 },
      error: undefined,
      response: { status: 200 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('muestra el UID en la tabla y permite copiarlo', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: escribir },
    });

    renderAdmin();
    expect(await screen.findByText(usuario.id)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Copiar UID de ${usuario.email}` }));

    await waitFor(() => expect(escribir).toHaveBeenCalledWith(usuario.id));
    expect(await screen.findByText('UID copiado al portapapeles.')).toBeInTheDocument();
  });

  it.each([
    ['Nuevo usuario', 'Crear usuario'],
    ['Editar', 'Guardar cambios'],
    ['Cambiar estado', 'Aplicar estado'],
    ['Asignar perfil', 'Asignar perfil'],
  ])('el botón "%s" abre un diálogo con su acción visible a 768 px', async (boton, accion) => {
    simularAncho(768);
    renderAdmin();
    await screen.findByText(usuario.id);

    fireEvent.click(screen.getByRole('button', { name: boton }));

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toBeInTheDocument();
    const guardar = screen.getByRole('button', { name: accion });
    expect(guardar).toBeVisible();
    expect(document.querySelector('.MuiDialog-paperFullScreen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(dialogo).not.toBeInTheDocument());
  });

  it('los diálogos ocupan toda la pantalla en 360 px sin ocultar la acción', async () => {
    simularAncho(360);
    renderAdmin();
    await screen.findByText(usuario.id);

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toBeInTheDocument();
    expect(document.querySelector('.MuiDialog-paperFullScreen')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  });
});
