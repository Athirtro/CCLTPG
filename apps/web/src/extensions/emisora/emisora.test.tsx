import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import axe from 'axe-core';
import { apiClient } from '../../api/client';
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

const usuarioOperador: User = {
  ...usuarioConPermiso,
  permissions: [
    'emisora:programacion:read',
    'emisora:programacion:create',
    'emisora:programacion:update',
    'emisora:rejilla:read',
    'emisora:rejilla:update',
    'emisora:comite:create',
    'emisora:grabacion:read',
    'emisora:grabacion:create',
    'emisora:asistencia-cabina:create',
    'emisora:audio:read',
    'emisora:audio:create',
  ],
};

const usuarioOperadorE3: User = {
  ...usuarioConPermiso,
  permissions: [
    'emisora:patrocinio:read',
    'emisora:patrocinio:create',
    'emisora:patrocinio:update',
    'emisora:promo:create',
    'emisora:promo:update',
    'emisora:publicacion:create',
    'emisora:publicacion:update',
    'emisora:transmision:create',
    'emisora:transmision:update',
    'emisora:prestamo:create',
    'emisora:prestamo:update',
    'emisora:viatico:create',
    'emisora:resolucion:create',
  ],
};

const usuarioOperadorE4: User = {
  ...usuarioConPermiso,
  permissions: [
    'emisora:turno:create',
    'emisora:turno:update',
    'emisora:lectura:create',
    'emisora:lectura:read',
    'emisora:bitacora:create',
    'emisora:obra:create',
    'emisora:derecho:create',
    'emisora:equipo:create',
    'emisora:equipo:update',
    'emisora:proyeccion:create',
    'emisora:proyeccion:update',
    'emisora:inversion:create',
    'emisora:inversion:update',
    'emisora:actividad:create',
    'emisora:actividad:read',
    'emisora:permiso-salida:create',
    'emisora:archivo-emisora:create',
    'emisora:planilla:create',
    'emisora:tramite:create',
    'emisora:tramite:read',
    'emisora:tramite:update',
  ],
};

describe('Extensión Emisora R.A.C.', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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

  it('la ruta operativa muestra el recorrido E2 con los datos del contrato', async () => {
    vi.spyOn(apiClient, 'GET').mockImplementation(((path: string) => {
      const data =
        path === '/emisora/convocatorias'
          ? [
              {
                id: 'convocatoria-e2e',
                anio: 2026,
                fechaApertura: '2026-01-15',
                fechaCierre: '2026-02-05',
                estado: 'abierta',
              },
            ]
          : path === '/emisora/rejilla-anual'
            ? { id: 'rejilla-e2e', anio: 2026, estado: 'borrador', aprobadaEn: null, items: [] }
            : path === '/emisora/programacion-diaria'
              ? null
              : [];
      return Promise.resolve({ data, error: undefined, response: { status: 200 } });
    }) as never);

    const { container } = renderEmisora('/emisora/operacion', usuarioOperador);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Operación E2 de la emisora' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Convocatorias de la emisora' })).toHaveTextContent(
        '2026-01-15',
      );
    });
    expect(screen.getByRole('table', { name: 'Rejilla anual' })).toHaveTextContent('Borrador');
    expect(screen.getByRole('button', { name: 'Registrar comité' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Aprobar rejilla' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Crear programación' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await checkAccessibility(container, 'EmisoraOperacion con permisos');
  });

  it('la landing enlaza con la operación E3', () => {
    renderEmisora();

    expect(screen.getByRole('link', { name: 'Abrir operación E3' })).toHaveAttribute(
      'href',
      '/emisora/operacion-e3',
    );
  });

  it('la ruta E3 muestra los formularios y respeta los permisos', async () => {
    const { container } = renderEmisora('/emisora/operacion-e3', usuarioOperadorE3);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Operación E3 de la emisora' }),
    ).toBeInTheDocument();
    for (const titulo of [
      'Patrocinios y promos',
      'Orden de emisión y publicación',
      'Transmisiones y soportes',
      'Mifi y viáticos',
      'Resolución de incentivos',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: titulo })).toBeInTheDocument();
    }
    for (const boton of [
      'Proponer patrocinio',
      'Registrar promo',
      'Crear orden',
      'Programar publicación',
      'Programar transmisión',
    ]) {
      expect(screen.getByRole('button', { name: boton })).toBeEnabled();
    }
    for (const boton of [
      'Aprobar patrocinio',
      'Producir promo',
      'Programar orden',
      'Emitir orden',
      'Publicar',
      'Autorizar transmisión',
      'Solicitar mifi',
      'Autorizar mifi',
      'Solicitar viático',
      'Generar resolución',
    ]) {
      expect(screen.getByRole('button', { name: boton })).toBeDisabled();
    }
    await checkAccessibility(container, 'EmisoraOperacionE3 con permisos');
  });

  it('la ruta E3 deshabilita las acciones del usuario sin permisos', () => {
    renderEmisora('/emisora/operacion-e3', usuarioSinPermiso);

    for (const boton of [
      'Proponer patrocinio',
      'Registrar promo',
      'Crear orden',
      'Programar publicación',
      'Programar transmisión',
      'Solicitar mifi',
      'Solicitar viático',
      'Generar resolución',
    ]) {
      expect(screen.getByRole('button', { name: boton })).toBeDisabled();
    }
  });

  it('la landing enlaza con la operación E4', () => {
    renderEmisora();

    expect(screen.getByRole('link', { name: 'Abrir operación E4' })).toHaveAttribute(
      'href',
      '/emisora/operacion-e4',
    );
  });

  it('la ruta E4 muestra las seis agrupaciones y respeta los permisos', async () => {
    const { container } = renderEmisora('/emisora/operacion-e4', usuarioOperadorE4);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Operación E4 de la emisora' }),
    ).toBeInTheDocument();
    for (const titulo of [
      'Sede de transmisores',
      'Derechos de autor',
      'Tecnología e inversión',
      'Oferta cultural y permisos',
      'Emisión y archivo',
      'Trámites externos',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: titulo })).toBeInTheDocument();
    }
    for (const boton of [
      'Asignar turno',
      'Registrar lectura',
      'Incluir obra',
      'Registrar equipo',
      'Registrar proyección',
      'Registrar actividad',
      'Archivar audio',
      'Radicar trámite',
    ]) {
      expect(screen.getByRole('button', { name: boton })).toBeEnabled();
    }
    for (const boton of [
      'Confirmar turno',
      'Registrar pago',
      'Aprobar proyección',
      'Emitir permiso',
      'Adjuntar soporte',
    ]) {
      expect(screen.getByRole('button', { name: boton })).toBeDisabled();
    }
    await checkAccessibility(container, 'EmisoraOperacionE4 con permisos');
  });

  it('la ruta E4 deshabilita todas las acciones del usuario sin permisos', () => {
    renderEmisora('/emisora/operacion-e4', usuarioSinPermiso);

    for (const boton of [
      'Asignar turno',
      'Registrar lectura',
      'Incluir obra',
      'Registrar equipo',
      'Registrar actividad',
      'Archivar audio',
      'Radicar trámite',
    ]) {
      expect(screen.getByRole('button', { name: boton })).toBeDisabled();
    }
  });

  it('la ruta E4 asigna un turno con Idempotency-Key', async () => {
    const POST = vi.spyOn(apiClient, 'POST').mockResolvedValue({
      data: { id: 'turno-e4-ui' },
      error: undefined,
      response: { status: 201 },
    });

    renderEmisora('/emisora/operacion-e4', usuarioOperadorE4);
    fireEvent.click(screen.getByRole('button', { name: 'Asignar turno' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Turno asignado.');
    });
    expect(POST).toHaveBeenCalledTimes(1);
    // `POST` es genérico: Vitest infiere sus argumentos como `never`, por eso
    // se inspeccionan como `unknown` y se estrechan explícitamente.
    const argumentos = POST.mock.calls[0] as unknown[] | undefined;
    const opciones = argumentos?.[1];
    const cabeceras =
      typeof opciones === 'object' && opciones !== null
        ? (opciones as { headers?: unknown }).headers
        : undefined;
    expect(
      typeof cabeceras === 'object' &&
        cabeceras !== null &&
        typeof (cabeceras as Record<string, unknown>)['Idempotency-Key'] === 'string',
    ).toBe(true);
    expect(screen.getByText(/Turno activo: turno-e4-ui/)).toBeInTheDocument();
  });
});
