import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axe from 'axe-core';
import { AuthProvider, type User } from '../contexts/AuthContext';
import Home from '../pages/Home';
import Login from '../pages/Login';
import Notificaciones from '../pages/Notificaciones';
import Preferencias from '../pages/Preferencias';
import Exportaciones from '../pages/Exportaciones';
import MiHorario from '../pages/MiHorario';
import MisEvaluaciones from '../pages/MisEvaluaciones';
import VistaEducador from '../pages/VistaEducador';
import Kpis from '../pages/Kpis';
import Reportes from '../pages/Reportes';

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

function renderWithProviders(ui: React.ReactElement, user?: User) {
  return render(
    <AuthProvider initialUser={user ?? mockEstudiante}>
      <BrowserRouter>{ui}</BrowserRouter>
    </AuthProvider>,
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

describe('Accesibilidad WCAG 2.1 AA — Páginas principales', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('Página Home no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<Home />);
    await checkAccessibility(container, 'Home');
  });

  it('Página Login no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<Login />);
    await checkAccessibility(container, 'Login');
  });

  it('Página Notificaciones no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<Notificaciones />);
    await checkAccessibility(container, 'Notificaciones');
  });

  it('Página Preferencias no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<Preferencias />);
    await checkAccessibility(container, 'Preferencias');
  });

  it('Página Exportaciones no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<Exportaciones />);
    await checkAccessibility(container, 'Exportaciones');
  });

  it('Página MiHorario no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<MiHorario />);
    await checkAccessibility(container, 'MiHorario');
  });

  it('Página MisEvaluaciones no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<MisEvaluaciones />);
    await checkAccessibility(container, 'MisEvaluaciones');
  });

  it('Página VistaEducador no tiene violaciones de accesibilidad (educador)', async () => {
    const { container } = renderWithProviders(<VistaEducador />, mockEducador);
    await checkAccessibility(container, 'VistaEducador');
  });

  it('Página KPIs no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<Kpis />);
    await checkAccessibility(container, 'KPIs');
  });

  it('Página Reportes no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<Reportes />);
    await checkAccessibility(container, 'Reportes');
  });
});

describe('Navegación por teclado', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('Página Login tiene botones con nombre accesible', () => {
    renderWithProviders(<Login />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      const hasAriaLabel = button.hasAttribute('aria-label');
      const hasText = (button.textContent?.trim().length ?? 0) > 0;
      expect(hasAriaLabel || hasText).toBe(true);
    }
  });

  it('Página VistaEducador (educador) tiene botones con nombre accesible', () => {
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
