import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { apiClient } from '../api/client';
import { AuthProvider } from '../contexts/AuthContext';
import { theme } from '../theme/theme';
import MfaEnroll from './MfaEnroll';

const URI =
  'otpauth://totp/CCLTPG:estudiante%40ccltpg.org?secret=JBSWY3DPEHPK3PXP&issuer=CCLTPG&algorithm=SHA1&digits=6&period=30';
const SECRETO = 'JBSWY3DPEHPK3PXP';

function renderEnroll() {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider initialSessionToken="session-mfa">
        <MemoryRouter>
          <MfaEnroll />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('inscripción MFA', () => {
  beforeEach(() => {
    document.cookie = 'ccltpg_session=; Path=/; Max-Age=0';
    cleanup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('muestra un QR generado localmente a partir del otpauthUri', async () => {
    vi.spyOn(apiClient, 'POST').mockResolvedValue({
      data: { secret: SECRETO, otpauthUri: URI },
      error: undefined,
      response: { status: 200 },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderEnroll();
    fireEvent.click(screen.getByRole('button', { name: 'Generar secreto TOTP' }));

    const qr = await screen.findByRole('img', { name: 'Código QR para configurar MFA' });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByText(SECRETO)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/^https?:/u),
      expect.anything(),
    );
  });
});
