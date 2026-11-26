import { beforeEach, describe, expect, it } from 'vitest';

import { hasSessionMarker, setSessionCredentials, setSessionCsrf } from './client';

describe('marcador de sesión del cliente', () => {
  beforeEach(() => {
    document.cookie = 'ccltpg_session=; Path=/; Max-Age=0';
    setSessionCredentials(null);
  });

  it('no marca una sesión mientras solo hay token parcial o CSRF', () => {
    setSessionCredentials({ csrfToken: 'csrf-parcial' });

    expect(hasSessionMarker()).toBe(false);
  });

  it('marca la sesión cuando hay access token', () => {
    setSessionCredentials({ accessToken: 'access', csrfToken: 'csrf' });

    expect(hasSessionMarker()).toBe(true);
  });

  it('limpia el marcador al cerrar sesión', () => {
    setSessionCredentials({ accessToken: 'access', csrfToken: 'csrf' });
    setSessionCredentials(null);

    expect(hasSessionMarker()).toBe(false);
  });

  it('preparar el CSRF del refresh no altera el marcador', () => {
    setSessionCredentials({ accessToken: 'access', csrfToken: 'csrf' });
    setSessionCsrf('csrf-refresh');

    expect(hasSessionMarker()).toBe(true);
  });
});
