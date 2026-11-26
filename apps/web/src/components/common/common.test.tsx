import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import axe from 'axe-core';
import PageHeader from './PageHeader';
import StatCard from './StatCard';
import StatusChip from './StatusChip';
import DataTable, { type DataTableColumn } from './DataTable';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import SectionCard from './SectionCard';
import { theme } from '../../theme/theme';

function renderConTema(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}

type Fila = { id: string; nombre: string; estado: string };
const columnas: DataTableColumn<Fila>[] = [
  { id: 'nombre', label: 'Nombre', render: (fila) => fila.nombre },
  { id: 'estado', label: 'Estado', render: (fila) => <StatusChip status={fila.estado} /> },
];
const filas: Fila[] = [{ id: '1', nombre: 'Ana Pérez', estado: 'activo' }];

describe('Componentes comunes reutilizables', () => {
  it('PageHeader renderiza un único encabezado h1 con descripción y acciones', () => {
    renderConTema(
      <PageHeader
        title="Estudiantes"
        description="Listado de estudiantes"
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Estudiantes' }]}
        actions={<button type="button">Nuevo</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Estudiantes' })).toBeInTheDocument();
    expect(screen.getByText('Listado de estudiantes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Ruta de navegación' })).toBeInTheDocument();
  });

  it('StatusChip mantiene etiquetas y tonos coherentes', () => {
    const { container } = renderConTema(
      <>
        <StatusChip status="presente" />
        <StatusChip status="ausente" />
        <StatusChip status="tarde" />
        <StatusChip status="excusa" />
        <StatusChip status="estado-desconocido" />
      </>,
    );

    expect(screen.getByText('Presente')).toBeInTheDocument();
    expect(screen.getByText('Ausente')).toBeInTheDocument();
    expect(screen.getByText('Tarde')).toBeInTheDocument();
    expect(screen.getByText('Excusa')).toBeInTheDocument();
    expect(screen.getByText('estado-desconocido')).toBeInTheDocument();
    const chips = container.querySelectorAll('.MuiChip-root');
    expect(new Set(Array.from(chips).map((chip) => getComputedStyle(chip).color)).size).toBeGreaterThan(1);
  });

  it('DataTable diferencia carga, vacío y datos', () => {
    const { rerender } = renderConTema(
      <DataTable ariaLabel="Prueba" columns={columnas} rows={[]} rowKey={(fila) => fila.id} loading />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Cargando información');

    rerender(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <DataTable ariaLabel="Prueba" columns={columnas} rows={[]} rowKey={(fila) => fila.id} />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText('No hay datos disponibles.')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <DataTable ariaLabel="Prueba" columns={columnas} rows={filas} rowKey={(fila) => fila.id} />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('Los estados comunes exponen información accesible', () => {
    renderConTema(
      <>
        <LoadingState label="Cargando datos" />
        <ErrorState message="Fallo de red" onRetry={() => undefined} />
        <EmptyState title="Sin resultados" description="Prueba otra búsqueda" />
      </>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando datos');
    expect(screen.getByRole('alert')).toHaveTextContent('Fallo de red');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByText('Prueba otra búsqueda')).toBeInTheDocument();
  });

  it('StatCard enlaza con la ruta indicada', () => {
    renderConTema(<StatCard label="Estudiantes" value={12} to="/estudiantes" />);

    expect(screen.getByRole('link', { name: /Estudiantes/ })).toHaveAttribute('href', '/estudiantes');
  });

  it('La composición de componentes comunes no tiene violaciones de accesibilidad', async () => {
    const { container } = renderConTema(
      <SectionCard title="Resumen">
        <PageHeader title="Panel" description="Información general" />
        <StatusChip status="activo" />
        <DataTable ariaLabel="Datos" columns={columnas} rows={filas} rowKey={(fila) => fila.id} />
      </SectionCard>,
    );

    const resultados = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: true },
        'button-name': { enabled: true },
        label: { enabled: true },
        'nested-interactive': { enabled: true },
      },
    });
    expect(resultados.violations.map((v) => v.id)).toEqual([]);
  });
});
