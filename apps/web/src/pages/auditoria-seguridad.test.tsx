import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import axe from 'axe-core';

import { apiClient } from '../api/client';
import { AuthProvider, type User } from '../contexts/AuthContext';
import { theme } from '../theme/theme';
import Auditoria from './Auditoria';
import Seguridad from './Seguridad';

const usuarioAuditor: User = {
  id: 'U-AUD-1',
  email: 'auditor@ccltpg.edu.co',
  fullName: 'Auditor Prueba',
  role: 'Administrador',
  profiles: ['administrador'],
  permissions: ['audit:event:read'],
  mfaEnabled: true,
  mustChangePassword: false,
};

const usuarioSinAuditoria: User = {
  ...usuarioAuditor,
  permissions: ['academic:enrollment:read_own'],
};

function renderPagina(pagina: ReactNode, usuario: User = usuarioAuditor) {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider initialUser={usuario}>
        <MemoryRouter>
          <main>{pagina}</main>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

async function checkAccessibility(container: HTMLElement, etiqueta: string) {
  const resultados = await axe.run(container, {
    rules: {
      'button-name': { enabled: true },
      label: { enabled: true },
      'landmark-one-main': { enabled: true },
      'page-has-heading-one': { enabled: true },
      'nested-interactive': { enabled: true },
    },
  });

  if (resultados.violations.length > 0) {
    const detalles = resultados.violations
      .map(
        (violacion) =>
          `${violacion.id}: ${violacion.nodes.map((nodo) => nodo.target.join(', ')).join('; ')}`,
      )
      .join('\n');
    throw new Error(`Violaciones de accesibilidad en ${etiqueta}:\n${detalles}`);
  }
}

describe('Vistas nuevas del núcleo', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Auditoria muestra eventos y es accesible', async () => {
    vi.spyOn(apiClient, 'GET').mockImplementation((() =>
      Promise.resolve({
        data: {
          items: [
            {
              id: 'evt-1',
              actorId: 'U-1',
              actorPerfil: 'Administrador',
              ip: '127.0.0.1',
              dispositivo: null,
              recurso: 'user',
              recursoId: 'U-2',
              accion: 'usuario.creado',
              datosAntes: null,
              datosDespues: { id: 'U-2' },
              ocurridoEn: '2026-01-15T10:00:00.000Z',
              requestId: 'req-1',
            },
          ],
          total: 1,
          limit: 25,
          offset: 0,
        },
        error: undefined,
        response: { ok: true, status: 200 },
      })) as never);

    const { container } = renderPagina(<Auditoria />);

    expect(screen.getByRole('heading', { level: 1, name: 'Auditoría' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Eventos de auditoría' })).toHaveTextContent(
        'usuario.creado',
      );
    });
    expect(screen.getByRole('button', { name: 'Detalle' })).toBeEnabled();
    await checkAccessibility(container, 'Auditoria con permisos');
  });

  it('Auditoria comunicó la falta de permisos', async () => {
    const { container } = renderPagina(<Auditoria />, usuarioSinAuditoria);

    expect(screen.getByText('Sin permisos')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await checkAccessibility(container, 'Auditoria sin permisos');
  });

  it('Seguridad regenera códigos y es accesible', async () => {
    const post = vi.spyOn(apiClient, 'POST').mockImplementation((() =>
      Promise.resolve({
        data: { recoveryCodes: ['ABCD-EFGH', 'IJKL-MNOP'] },
        error: undefined,
        response: { ok: true, status: 200 },
      })) as never);

    const { container } = renderPagina(<Seguridad />);

    expect(screen.getByRole('heading', { level: 1, name: 'Seguridad' })).toBeInTheDocument();
    const boton = screen.getByRole('button', { name: 'Regenerar códigos' });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Código TOTP o de recuperación'), {
      target: { value: '123456' },
    });
    expect(boton).toBeEnabled();
    fireEvent.click(boton);
    await waitFor(() => {
      expect(screen.getByText('ABCD-EFGH')).toBeInTheDocument();
    });
    expect(post).toHaveBeenCalledWith('/auth/mfa/recovery-codes', {
      body: { code: '123456' },
    });
    await checkAccessibility(container, 'Seguridad con códigos');
  });
});
