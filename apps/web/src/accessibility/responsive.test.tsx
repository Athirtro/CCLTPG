import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { AuthProvider, type User } from '../contexts/AuthContext';
import MainLayout, { DRAWER_COLLAPSED_WIDTH, DRAWER_WIDTH } from '../components/layout/MainLayout';
import { theme } from '../theme/theme';

const usuario: User = {
  id: 'U-001',
  email: 'estudiante@ccltpg.edu.co',
  fullName: 'Estudiante Prueba',
  role: 'Estudiante',
  profiles: ['estudiante'],
  permissions: ['academic:schedule:read_own'],
  mfaEnabled: true,
  mustChangePassword: false,
};

/**
 * MUI usa `theme.breakpoints.down('md')`, cuyo valor por defecto es 900 px.
 * Por eso 360 y 768 usan drawer temporal, y 1024 y 1440 drawer permanente.
 */
function simularAncho(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: width < 900,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderLayout() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <AuthProvider initialUser={usuario}>
          <MainLayout />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Responsividad del layout (ON-1)', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it.each([360, 768])('a %i px el menú es temporal y se abre con el botón', async (width) => {
    simularAncho(width);
    renderLayout();

    const abrir = screen.getByRole('button', { name: 'Abrir menú' });
    expect(abrir).toBeInTheDocument();
    expect(screen.queryByText('CCLTPG')).not.toBeInTheDocument();

    fireEvent.click(abrir);

    expect(await screen.findByText('CCLTPG')).toBeInTheDocument();
    // El drawer temporal es modal: MUI marca el resto de la página con aria-hidden.
    expect(screen.getByRole('button', { name: 'Cerrar menú', hidden: true })).toBeInTheDocument();
  });

  it.each([1024, 1440])('a %i px el menú es permanente y no hay botón hamburguesa', (width) => {
    simularAncho(width);
    renderLayout();

    expect(screen.queryByRole('button', { name: /menú/i })).not.toBeInTheDocument();
    expect(screen.getByText('CCLTPG')).toBeInTheDocument();
  });

  it('el drawer permanente precede al contenido y no solapa el área principal', () => {
    simularAncho(1440);
    const { container } = renderLayout();
    const drawer = container.querySelector('.MuiDrawer-root');
    const main = container.querySelector('main');

    expect(drawer).toBeInTheDocument();
    expect(main).toBeInTheDocument();
    expect(drawer!.compareDocumentPosition(main!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(window.getComputedStyle(main!).width).not.toContain('calc');
    expect(window.getComputedStyle(main!).marginLeft).toBe('0px');
  });

  it('el ancho del drawer sigue al estado expandido y contraído', () => {
    simularAncho(1440);
    const { container } = renderLayout();
    const drawer = container.querySelector('.MuiDrawer-root') as HTMLElement;
    const paper = container.querySelector('.MuiDrawer-paper') as HTMLElement;

    expect(window.getComputedStyle(drawer).width).toBe(`${DRAWER_WIDTH}px`);
    expect(window.getComputedStyle(paper).width).toBe(`${DRAWER_WIDTH}px`);

    fireEvent.click(screen.getByRole('button', { name: 'Contraer navegación' }));

    expect(window.getComputedStyle(drawer).width).toBe(`${DRAWER_COLLAPSED_WIDTH}px`);
    expect(window.getComputedStyle(paper).width).toBe(`${DRAWER_COLLAPSED_WIDTH}px`);
  });

  it('el drawer temporal cerrado no deja una columna reservada', () => {
    simularAncho(360);
    const { container } = renderLayout();

    expect(container.querySelector('.MuiDrawer-root')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeInTheDocument();
  });
});
