import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';

import { apiClient } from '../api/client';
import { AuthProvider, type User } from '../contexts/AuthContext';
import { theme } from '../theme/theme';
import Archivos from './Archivos';

const usuarioConPermiso: User = {
  id: 'U-ARCH-1',
  email: 'archivos@ccltpg.edu.co',
  fullName: 'Usuario Archivos',
  role: 'Administrador',
  profiles: ['administrador'],
  permissions: ['files:document:create'],
  mfaEnabled: false,
  mustChangePassword: false,
};

const ARCHIVO_RESPUESTA = {
  id: 'cccccccc-0000-4000-8000-000000000001',
  nombreOriginal: 'bases.pdf',
  mime: 'application/pdf',
  tamano: 1024,
  hashSha256: 'abc123',
  estadoEscaneo: 'limpio',
  creadoEn: '2026-01-15T10:00:00.000Z',
};

function renderArchivos() {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider initialUser={usuarioConPermiso}>
        <MemoryRouter>
          <main>
            <Archivos />
          </main>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

function seleccionarArchivo(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(['%PDF-1.4 contenido'], 'bases.pdf', { type: 'application/pdf' })] },
  });
}

function cabecerasDe(post: { mock: { calls: unknown[][] } }) {
  const opciones = post.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined;
  return opciones?.headers ?? {};
}

function mockPost(data: unknown, error: unknown, status: number) {
  return vi.spyOn(apiClient, 'POST').mockImplementation((() =>
    Promise.resolve({
      data,
      error,
      response: { status },
    })) as never);
}

describe('Subida de archivos', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('envía una Idempotency-Key generada y acepta el 201 del contrato', async () => {
    const post = mockPost(ARCHIVO_RESPUESTA, undefined, 201);

    const { container } = renderArchivos();
    seleccionarArchivo(container);
    fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));
    const claveVisible = screen.getByLabelText<HTMLInputElement>(/Idempotency-Key/).value;

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]?.[0]).toBe('/files');
    const clave = cabecerasDe(post)['Idempotency-Key'];
    expect(typeof clave).toBe('string');
    expect(clave.length).toBeGreaterThan(0);
    expect(claveVisible).toBe(clave);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Archivo "bases.pdf" subido correctamente.',
    );
  });

  it('respeta la Idempotency-Key escrita por el usuario', async () => {
    const post = mockPost(ARCHIVO_RESPUESTA, undefined, 201);

    const { container } = renderArchivos();
    fireEvent.change(screen.getByLabelText(/Idempotency-Key/), {
      target: { value: 'clave-manual-123' },
    });
    seleccionarArchivo(container);
    fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(cabecerasDe(post)['Idempotency-Key']).toBe('clave-manual-123');
    expect(await screen.findByRole('alert')).toHaveTextContent('subido correctamente');
  });

  it('muestra el error del servicio cuando la respuesta no es 201', async () => {
    mockPost(undefined, { detail: 'No se pudo subir el archivo.' }, 200);

    const { container } = renderArchivos();
    seleccionarArchivo(container);
    fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo subir el archivo.');
  });

  it('rechaza el wrapper obsoleto con la clave "archivo"', async () => {
    mockPost({ archivo: ARCHIVO_RESPUESTA }, undefined, 201);

    const { container } = renderArchivos();
    seleccionarArchivo(container);
    fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El servicio no devolvió los metadatos del archivo.',
    );
  });
});
