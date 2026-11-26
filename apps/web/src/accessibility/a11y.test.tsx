import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import axe from 'axe-core';
import { theme } from '../theme/theme';
import { AuthProvider, type User } from '../contexts/AuthContext';
import Home from '../pages/Home';
import Login from '../pages/Login';
import MfaVerify from '../pages/MfaVerify';
import MfaEnroll from '../pages/MfaEnroll';
import PasswordChange from '../pages/PasswordChange';
import Estudiantes from '../pages/Estudiantes';
import Programas from '../pages/Programas';
import Grupos from '../pages/Grupos';
import Matriculas from '../pages/Matriculas';
import Admin from '../pages/Admin';
import Archivos from '../pages/Archivos';
import Notificaciones from '../pages/Notificaciones';
import Preferencias from '../pages/Preferencias';
import Exportaciones from '../pages/Exportaciones';
import MiHorario from '../pages/MiHorario';
import MisEvaluaciones from '../pages/MisEvaluaciones';
import VistaEducador from '../pages/VistaEducador';
import Kpis from '../pages/Kpis';
import Reportes from '../pages/Reportes';
import Health from '../pages/Health';
import NotFound from '../pages/NotFound';

const mockEstudiante: User = {
  id: 'U-001',
  email: 'estudiante@ccltpg.edu.co',
  fullName: 'Estudiante Prueba',
  role: 'Estudiante',
  profiles: ['estudiante'],
  permissions: [
    'academic:enrollment:read_own',
    'academic:schedule:read_own',
    'academic:evaluation:read_own',
    'notifications:notification:read_own',
    'notifications:preference:read_own',
    'notifications:preference:update_own',
    'files:document:read_own',
    'analytics:kpi:read',
    'exports:report:export',
  ],
  mfaEnabled: true,
  mustChangePassword: false,
};

const mockEducador: User = {
  id: 'U-002',
  email: 'educador@ccltpg.edu.co',
  fullName: 'Educador Prueba',
  role: 'Educador',
  profiles: ['educador'],
  permissions: [
    'academic:group:read_own',
    'academic:attendance:create',
    'academic:evaluation:create',
    'academic:evaluation:read_own',
    'files:document:create',
    'notifications:notification:read_own',
  ],
  mfaEnabled: false,
  mustChangePassword: false,
};

const mockAdmin: User = {
  id: 'U-003',
  email: 'admin@ccltpg.edu.co',
  fullName: 'Administrador Prueba',
  role: 'Administrador',
  profiles: ['administrador'],
  permissions: [
    'academic:student:manage',
    'academic:program:manage',
    'academic:group:manage',
    'academic:enrollment:manage',
    'academic:enrollment:read_own',
    'academic:schedule:read_own',
    'academic:evaluation:read_own',
    'academic:attendance:create',
    'academic:evaluation:create',
    'identity:user:manage',
    'files:document:create',
    'files:document:read_own',
    'notifications:notification:read_own',
    'notifications:notification:update_own',
    'notifications:preference:read_own',
    'notifications:preference:update_own',
    'exports:report:export',
    'exports:report:create',
    'analytics:kpi:read',
  ],
  mfaEnabled: false,
  mustChangePassword: false,
};

function renderWithProviders(ui: React.ReactElement, user?: User, sessionToken?: string) {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider initialUser={user ?? mockEstudiante} initialSessionToken={sessionToken}>
        <BrowserRouter>{ui}</BrowserRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

async function checkAccessibility(container: HTMLElement, label: string) {
  const results = await axe.run(container, {
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

  if (results.violations.length > 0) {
    const details = results.violations
      .map(
        (v) => `${v.id}: ${v.description} (${v.nodes.map((n) => n.target.join(', ')).join('; ')})`,
      )
      .join('\n');
    throw new Error(`Violaciones de accesibilidad en ${label}:\n${details}`);
  }
}

describe('Accesibilidad WCAG 2.1 AA — todas las páginas', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  const paginas: Array<[string, React.ReactElement, User | undefined, string | undefined]> = [
    ['Home', <Home />, undefined, undefined],
    ['Login', <Login />, undefined, undefined],
    ['MfaVerify', <MfaVerify />, undefined, 'token-de-prueba'],
    ['MfaEnroll', <MfaEnroll />, undefined, undefined],
    ['PasswordChange', <PasswordChange />, undefined, undefined],
    ['Estudiantes', <Estudiantes />, mockAdmin, undefined],
    ['Programas', <Programas />, mockAdmin, undefined],
    ['Grupos', <Grupos />, mockAdmin, undefined],
    ['Matriculas', <Matriculas />, mockAdmin, undefined],
    ['Admin', <Admin />, mockAdmin, undefined],
    ['Archivos', <Archivos />, mockAdmin, undefined],
    ['Notificaciones', <Notificaciones />, undefined, undefined],
    ['Preferencias', <Preferencias />, undefined, undefined],
    ['Exportaciones', <Exportaciones />, undefined, undefined],
    ['MiHorario', <MiHorario />, undefined, undefined],
    ['MisEvaluaciones', <MisEvaluaciones />, undefined, undefined],
    ['VistaEducador', <VistaEducador />, mockEducador, undefined],
    ['Kpis', <Kpis />, undefined, undefined],
    ['Reportes', <Reportes />, undefined, undefined],
    ['Health', <Health />, undefined, undefined],
    ['NotFound', <NotFound />, undefined, undefined],
  ];

  it.each(paginas)('%s no tiene violaciones de accesibilidad', async (label, ui, user, token) => {
    const { container } = renderWithProviders(ui, user, token);
    await checkAccessibility(container, label);
  });
});

describe('Navegación por teclado', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('Login tiene botones con nombre accesible', () => {
    renderWithProviders(<Login />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      const hasAriaLabel = button.hasAttribute('aria-label');
      const hasText = (button.textContent?.trim().length ?? 0) > 0;
      expect(hasAriaLabel || hasText).toBe(true);
    }
  });

  it('Login permite recorrer email, contraseña y botón con Tab', async () => {
    const usuario = userEvent.setup();
    renderWithProviders(<Login />);

    // El campo de correo recibe el foco al montar (autoFocus).
    expect(screen.getByLabelText(/Correo electrónico/)).toHaveFocus();

    await usuario.tab();
    expect(screen.getByLabelText(/Contraseña/)).toHaveFocus();

    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toHaveFocus();
  });

  it('VistaEducador (educador) tiene botones con nombre accesible', () => {
    renderWithProviders(<VistaEducador />, mockEducador);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      const hasAriaLabel = button.hasAttribute('aria-label');
      const hasText = (button.textContent?.trim().length ?? 0) > 0;
      expect(hasAriaLabel || hasText).toBe(true);
    }
  });
});
