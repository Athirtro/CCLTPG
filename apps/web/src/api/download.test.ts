import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiClient,
  descargarArchivo,
  hasSessionMarker,
  setSessionCredentials,
  type ProblemDetailsDto,
} from './client';

type Descarga = { href: string; download: string };

const problema: ProblemDetailsDto = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  detail: 'La sesión no es válida. Inicie sesión de nuevo.',
  instance: '/api/v1/files/x/download',
  code: 'AUTH_TOKEN_INVALID',
  errors: [],
  requestId: 'req-descarga',
};

function cuerpoError401(): Blob {
  return new Blob([JSON.stringify(problema)], { type: 'application/json' });
}

describe('descarga autorizada de archivos', () => {
  let descargas: Descarga[];
  let revocar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.cookie = 'ccltpg_session=; Path=/; Max-Age=0';
    setSessionCredentials(null);
    descargas = [];

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn(() => 'blob:archivo'),
    });
    revocar = vi.fn();
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      configurable: true,
      value: revocar,
    });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      descargas.push({ href: this.href, download: this.download });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setSessionCredentials(null);
  });

  it('pide el archivo con parseAs blob y dispara una descarga local', async () => {
    setSessionCredentials({ accessToken: 'access', csrfToken: 'csrf' });
    const contenido = new Blob(['a,b\n1,2'], { type: 'text/csv' });
    const obtener = vi
      .spyOn(apiClient, 'GET')
      .mockResolvedValue({ data: contenido, error: undefined, response: { status: 200 } });

    const resultado = await descargarArchivo('archivo-1', 'reporte.csv');

    expect(resultado).toEqual({ ok: true, nombre: 'reporte.csv' });
    expect(obtener).toHaveBeenCalledWith('/files/{id}/download', {
      params: { path: { id: 'archivo-1' } },
      parseAs: 'blob',
    });
    expect(descargas).toEqual([{ href: 'blob:archivo', download: 'reporte.csv' }]);
    expect(revocar).toHaveBeenCalledWith('blob:archivo');
  });

  it('refresca una vez y reintenta cuando el token expiró', async () => {
    setSessionCredentials({ accessToken: 'viejo', csrfToken: 'csrf' });
    const obtener = vi
      .spyOn(apiClient, 'GET')
      .mockResolvedValueOnce({
        data: undefined,
        error: cuerpoError401(),
        response: { status: 401 },
      })
      .mockResolvedValueOnce({
        data: new Blob(['contenido']),
        error: undefined,
        response: { status: 200 },
      });
    const refrescar = vi.spyOn(apiClient, 'POST').mockResolvedValue({
      data: {
        status: 'authenticated',
        accessToken: 'nuevo',
        csrfToken: 'csrf-nuevo',
        mustChangePassword: false,
        profiles: [],
      },
      error: undefined,
      response: { status: 200 },
    });

    const resultado = await descargarArchivo('archivo-2', 'reporte.pdf');

    expect(resultado).toEqual({ ok: true, nombre: 'reporte.pdf' });
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(refrescar).toHaveBeenCalledTimes(1);
    expect(hasSessionMarker()).toBe(true);
  });

  it('un 401 persistente devuelve el detail sin invalidar la sesión', async () => {
    setSessionCredentials({ accessToken: 'access', csrfToken: 'csrf' });
    vi.spyOn(apiClient, 'GET').mockResolvedValue({
      data: undefined,
      error: cuerpoError401(),
      response: { status: 401 },
    });
    vi.spyOn(apiClient, 'POST').mockResolvedValue({
      data: {
        status: 'authenticated',
        accessToken: 'nuevo',
        csrfToken: 'csrf-nuevo',
        mustChangePassword: false,
        profiles: [],
      },
      error: undefined,
      response: { status: 200 },
    });

    const resultado = await descargarArchivo('archivo-3', 'reporte.xlsx');

    expect(resultado).toEqual({
      ok: false,
      code: 'AUTH_TOKEN_INVALID',
      detail: problema.detail,
      status: 401,
    });
    expect(descargas).toEqual([]);
    expect(hasSessionMarker()).toBe(true);
  });
});
