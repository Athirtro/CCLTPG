import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';

import { apiClient } from '../api/client';
import { AuthProvider, type User } from '../contexts/AuthContext';
import type { MatriculaDto } from '../api/client';
import { theme } from '../theme/theme';
import SideDrawer from '../components/layout/SideDrawer';
import Home from './Home';
import Matriculas from './Matriculas';

const MATRICULA_ID = 'aaaaaaaa-0000-4000-8000-000000000004';
const ESTUDIANTE_ID = 'aaaaaaaa-0000-4000-8000-000000000003';

function matricula(estado: MatriculaDto['estado']): MatriculaDto {
  return {
    id: MATRICULA_ID,
    estudianteId: ESTUDIANTE_ID,
    estudianteNombres: 'E2E',
    estudianteApellidos: 'Estudiante',
    grupoId: 'aaaaaaaa-0000-4000-8000-000000000002',
    grupoCodigo: 'G-E2E-MI',
    programaId: 'aaaaaaaa-0000-4000-8000-000000000001',
    programaNombre: 'Programa E2E Estudiante',
    periodo: '2026-1',
    estado,
    fechaMatricula: '2026-01-01T00:00:00.000Z',
  };
}

function usuario(perfiles: string[], permissions: string[]): User {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'test-matriculas@ccltpg.org',
    fullName: 'Usuario de prueba',
    role: perfiles[0] ?? 'test',
    profiles: perfiles,
    permissions,
    mfaEnabled: false,
    mustChangePassword: false,
  };
}

const estudiante = usuario(
  ['estudiante'],
  ['academic:enrollment:read_own', 'academic:schedule:read_own'],
);
const educador = usuario(
  ['educador'],
  ['academic:enrollment:read', 'academic:enrollment:read_own'],
);
const administrador = usuario(
  ['administrador'],
  [
    'academic:enrollment:read',
    'academic:enrollment:read_own',
    'academic:enrollment:create',
    'academic:enrollment:update',
  ],
);

function mockLecturas(registros: MatriculaDto[]) {
  return vi.spyOn(apiClient, 'GET').mockImplementation(((path: string) => {
    if (path === '/academic/enrollments' || path === '/me/enrollments') {
      return Promise.resolve({
        data: { page: 1, pageSize: 10, total: registros.length, data: registros },
        error: undefined,
        response: { status: 200 },
      });
    }
    return Promise.resolve({
      data: { page: 1, pageSize: 10, total: 0, data: [] },
      error: undefined,
      response: { status: 200 },
    });
  }) as never);
}

function renderPagina(user: User) {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider initialUser={user}>
        <MemoryRouter>
          <Matriculas />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

function renderCon(user: User, ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider initialUser={user}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('acceso a matrículas según permisos', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('el estudiante carga sus matrículas propias sin acciones de gestión', async () => {
    const get = mockLecturas([matricula('activa')]);

    renderPagina(estudiante);

    expect(await screen.findByText('Programa E2E Estudiante')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/me/enrollments');
    expect(get).not.toHaveBeenCalledWith('/academic/enrollments');
    expect(screen.queryByRole('button', { name: 'Nueva matrícula' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mis matrículas' })).toBeInTheDocument();
  });

  it('el educador carga el listado global sin poder crear ni actualizar', async () => {
    const get = mockLecturas([matricula('confirmada')]);

    renderPagina(educador);

    expect(await screen.findByText('Programa E2E Estudiante')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/academic/enrollments');
    expect(get).not.toHaveBeenCalledWith('/me/enrollments');
    expect(screen.queryByRole('button', { name: 'Nueva matrícula' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
  });

  it('expone todas las transiciones canónicas al administrador', async () => {
    mockLecturas([matricula('activa')]);

    renderPagina(administrador);

    expect(await screen.findByText('Programa E2E Estudiante')).toBeInTheDocument();
    for (const nombre of ['Finalizar', 'Retirar', 'Cancelar']) {
      expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
  });

  it('ejecuta la transición Activar con el endpoint de transiciones', async () => {
    mockLecturas([matricula('confirmada')]);
    const post = vi.spyOn(apiClient, 'POST').mockImplementation((() =>
      Promise.resolve({
        data: matricula('activa'),
        error: undefined,
        response: { status: 200 },
      })) as never);

    renderPagina(administrador);

    fireEvent.click(await screen.findByRole('button', { name: 'Activar' }));
    expect(await screen.findByRole('dialog', { name: 'Activar matrícula' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activar matrícula' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/academic/enrollments/{id}/transitions', {
        params: { path: { id: MATRICULA_ID } },
        body: { to: 'activa' },
      }),
    );
  });

  it('muestra el estado sin permisos cuando solo falta el permiso de lectura', () => {
    renderPagina(usuario(['otro'], ['files:document:read_own']));

    expect(screen.getByRole('heading', { name: 'Sin permisos' })).toBeInTheDocument();
  });

  it('muestra Matrículas en el menú lateral del estudiante', () => {
    renderCon(
      estudiante,
      <SideDrawer
        user={{
          fullName: estudiante.fullName,
          email: estudiante.email,
          role: estudiante.role,
        }}
        onLogout={() => undefined}
      />,
    );

    expect(screen.getByRole('link', { name: 'Matrículas' })).toBeInTheDocument();
  });

  it('ofrece Mis matrículas en el inicio del estudiante', async () => {
    vi.spyOn(apiClient, 'GET').mockImplementation(((path: string) => {
      if (path === '/me/enrollments') {
        return Promise.resolve({
          data: { page: 1, pageSize: 10, total: 1, data: [matricula('activa')] },
          error: undefined,
          response: { status: 200 },
        });
      }
      if (path === '/me/evaluations') {
        return Promise.resolve({ data: [], error: undefined, response: { status: 200 } });
      }
      return Promise.resolve({ data: { items: [] }, error: undefined, response: { status: 200 } });
    }) as never);

    renderCon(estudiante, <Home />);

    expect(await screen.findByRole('link', { name: 'Mis matrículas' })).toBeInTheDocument();
  });
});
