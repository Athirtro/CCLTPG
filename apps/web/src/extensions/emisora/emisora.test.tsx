import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import axe from 'axe-core';
import { theme } from '../../theme/theme';
import { AuthProvider, type User } from '../../contexts/AuthContext';
import EmisoraRoutes from './routes';

const AGRUPACIONES = [
  'Programación',
  'Grabación',
  'Rejilla y realizadores',
  'Patrocinios y promos',
  'Transmisiones',
  'Transmisores',
  'Derechos',
  'Tecnología',
  'Archivo y trámites',
];

const usuarioConPermiso: User = {
  id: 'U-EMI-1',
  email: 'jefe.emisora@ccltpg.edu.co',
  fullName: 'Jefe Emisora Prueba',
  role: 'Jefe emisora',
  profiles: ['jefe_emisora'],
  permissions: ['emisora:programacion:read', 'emisora:rejilla:read'],
  mfaEnabled: false,
  mustChangePassword: false,
};

const usuarioSinPermiso: User = {
  id: 'U-EMI-2',
  email: 'sin.emisora@ccltpg.edu.co',
  fullName: 'Usuario Sin Emisora Prueba',
  role: 'Estudiante',
  profiles: ['estudiante'],
  permissions: ['academic:enrollment:read_own'],
  mfaEnabled: false,
  mustChangePassword: false,
};

function renderEmisora(ruta = '/emisora', usuario: User = usuarioConPermiso) {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider initialUser={usuario}>
        <MemoryRouter initialEntries={[ruta]}>
          <main>
            <Routes>
              <Route path="/emisora/*" element={<EmisoraRoutes />} />
            </Routes>
          </main>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

async function checkAccessibility(container: HTMLElement, etiqueta: string) {
  const resultados = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: true },
      'aria-required-attr': { enabled: true },
      'aria-allowed-attr': { enabled: true },
      'button-name': { enabled: true },
      'link-name': { enabled: true },
      'image-alt': { enabled: true },
      label: { enabled: true },
      'landmark-one-main': { enabled: true },
      'page-has-heading-one': { enabled: true },
      tabindex: { enabled: true },
      'nested-interactive': { enabled: true },
    },
  });

  if (resultados.violations.length > 0) {
    const detalles = resultados.violations
      .map(
        (violacion) =>
          `${violacion.id}: ${violacion.description} (${violacion.nodes
            .map((nodo) => nodo.target.join(', '))
            .join('; ')})`,
      )
      .join('\n');
    throw new Error(`Violaciones de accesibilidad en ${etiqueta}:\n${detalles}`);
  }
}

describe('Extensión Emisora R.A.C.', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('la landing renderiza un único h1 y las agrupaciones funcionales', () => {
    renderEmisora();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Emisora R.A.C.' })).toBeInTheDocument();
    for (const agrupacion of AGRUPACIONES) {
      expect(screen.getByRole('heading', { level: 3, name: agrupacion })).toBeInTheDocument();
    }
  });

  it('la ruta comodín muestra la misma landing', () => {
    renderEmisora('/emisora/seccion-desconocida');

    expect(screen.getByRole('heading', { level: 1, name: 'Emisora R.A.C.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Programación' })).toBeInTheDocument();
  });

  it('muestra el aviso informativo solo al usuario sin permisos emisora', () => {
    const conPermiso = renderEmisora();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    conPermiso.unmount();

    renderEmisora('/emisora', usuarioSinPermiso);
    expect(screen.getByRole('alert')).toHaveTextContent('emisora:programacion:read');
    expect(screen.getByRole('heading', { level: 1, name: 'Emisora R.A.C.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Programación' })).toBeInTheDocument();
  });

  it('la landing con permisos no tiene violaciones de accesibilidad', async () => {
    const { container } = renderEmisora();
    await checkAccessibility(container, 'EmisoraHome con permisos');
  });

  it('la landing sin permisos no tiene violaciones de accesibilidad', async () => {
    const { container } = renderEmisora('/emisora', usuarioSinPermiso);
    await checkAccessibility(container, 'EmisoraHome sin permisos');
  });
});
