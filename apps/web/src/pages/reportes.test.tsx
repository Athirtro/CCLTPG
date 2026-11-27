import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';

import { apiClient } from '../api/client';
import { AuthProvider, type User } from '../contexts/AuthContext';
import { theme } from '../theme/theme';
import Reportes from './Reportes';

const usuario: User = {
  id: 'U-REP-1',
  email: 'reportes@ccltpg.edu.co',
  fullName: 'Usuario Reportes',
  role: 'Administrador',
  profiles: ['administrador'],
  permissions: ['exports:report:export', 'exports:report:create'],
  mfaEnabled: false,
  mustChangePassword: false,
};

const CATALOGO = {
  items: [
    {
      code: 'matricula',
      nombre: 'Matrículas por programa',
      descripcion: 'Reporte de matriculados',
      formatos: ['pdf'],
      columnas: [],
    },
  ],
};

const EXPORTACION = {
  archivoId: 'eeeeeeee-0000-4000-8000-000000000001',
  nombre: 'reporte-matricula.pdf',
  mime: 'application/pdf',
  tamano: 1024,
  formato: 'pdf',
  hashSha256: 'abc123',
  descargaUrl: '/api/v1/files/eeeeeeee-0000-4000-8000-000000000001/download',
};

describe('Descarga de reportes', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('descarga con el cliente autenticado en vez de abrir una URL con window.open', async () => {
    vi.spyOn(apiClient, 'GET').mockImplementation(((path: string) => {
      if (path === '/reports/catalog') {
        return Promise.resolve({ data: CATALOGO, error: undefined, response: { status: 200 } });
      }
      if (path === '/files/{id}/download') {
        return Promise.resolve({
          data: new Blob(['%PDF-1.4']),
          error: undefined,
          response: { status: 200 },
        });
      }
      throw new Error(`Ruta no esperada: ${path}`);
    }) as never);
    vi.spyOn(apiClient, 'POST').mockImplementation((() =>
      Promise.resolve({
        data: EXPORTACION,
        error: undefined,
        response: { status: 201 },
      })) as never);

    const descargas: string[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn(() => 'blob:reporte'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      descargas.push(this.download);
    });
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { container } = render(
      <ThemeProvider theme={theme}>
        <AuthProvider initialUser={usuario}>
          <MemoryRouter>
            <main>
              <Reportes />
            </main>
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar' }));
    fireEvent.change(container.querySelector('#reporte-parametros') as HTMLInputElement, {
      target: { value: '{"periodo":"2026-1"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generar reporte' }));
    await screen.findByRole('button', { name: 'Descargar archivo' });

    fireEvent.click(screen.getByRole('button', { name: 'Descargar archivo' }));

    await waitFor(() => expect(descargas).toEqual(['reporte-matricula.pdf']));
    expect(abrir).not.toHaveBeenCalled();
    expect(
      screen.getByText('Archivo "reporte-matricula.pdf" descargado correctamente.'),
    ).toBeTruthy();
  });
});
