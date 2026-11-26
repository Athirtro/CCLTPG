import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Refresh as RefreshIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { SesionHorarioDto } from '../api/client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatCard from '../components/common/StatCard';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

const DIAS_SEMANA: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const BREADCRUMBS = [{ label: 'Inicio', to: '/' }, { label: 'Mi horario' }];

const DESCRIPCION =
  'Consulta las sesiones programadas para ti, organizadas por día, hora y grupo.';

const nombreDia = (diaSemana: number) => DIAS_SEMANA[diaSemana] ?? 'No disponible';
const noDisponible = (valor: string | null) => valor ?? 'No disponible';

export default function MiHorario() {
  const { hasPermission } = useAuth();
  const [sesiones, setSesiones] = useState<SesionHorarioDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroDia, setFiltroDia] = useState<number | 'todos'>('todos');

  const tema = useTheme();
  const esMovil = useMediaQuery(tema.breakpoints.down('md'));

  const puedeLeer = hasPermission('academic:schedule:read_own');

  const cargarHorario = useCallback(async () => {
    if (!puedeLeer) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/me/schedule');
      if (apiError || !data) {
        setError('No se pudo cargar el horario');
        return;
      }
      setSesiones(data.items);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar el horario');
    } finally {
      setCargando(false);
    }
  }, [puedeLeer]);

  useEffect(() => {
    void cargarHorario();
  }, [cargarHorario]);

  const diasDisponibles = useMemo(
    () => Array.from(new Set(sesiones.map((sesion) => sesion.diaSemana))).sort((a, b) => a - b),
    [sesiones],
  );

  const sesionesFiltradas = useMemo(
    () =>
      sesiones
        .filter((sesion) => filtroDia === 'todos' || sesion.diaSemana === filtroDia)
        .sort(
          (a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio),
        ),
    [sesiones, filtroDia],
  );

  const sesionesPorDia = useMemo(
    () =>
      diasDisponibles
        .filter((dia) => filtroDia === 'todos' || dia === filtroDia)
        .map((dia) => ({
          dia,
          items: sesionesFiltradas.filter((sesion) => sesion.diaSemana === dia),
        })),
    [diasDisponibles, filtroDia, sesionesFiltradas],
  );

  const columnas: DataTableColumn<SesionHorarioDto>[] = [
    {
      id: 'dia',
      label: 'Día',
      minWidth: 110,
      render: (sesion) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {nombreDia(sesion.diaSemana)}
        </Typography>
      ),
    },
    {
      id: 'hora',
      label: 'Hora',
      minWidth: 140,
      render: (sesion) => `${sesion.horaInicio} – ${sesion.horaFin}`,
    },
    { id: 'programa', label: 'Programa', minWidth: 180, render: (s) => noDisponible(s.programaNombre) },
    { id: 'grupo', label: 'Grupo', minWidth: 110, render: (s) => noDisponible(s.grupoCodigo) },
    { id: 'periodo', label: 'Periodo', minWidth: 110, render: (s) => noDisponible(s.periodo) },
    { id: 'salon', label: 'Salón', minWidth: 120, render: (s) => noDisponible(s.salon) },
  ];

  if (!puedeLeer) {
    return (
      <Box>
        <PageHeader
          title="Mi horario de clases"
          description={DESCRIPCION}
          icon={<ScheduleIcon />}
          breadcrumbs={BREADCRUMBS}
        />
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para ver tu horario."
          icon={<ScheduleIcon />}
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Mi horario de clases"
        description={DESCRIPCION}
        icon={<ScheduleIcon />}
        breadcrumbs={BREADCRUMBS}
        actions={
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void cargarHorario()}
            disabled={cargando}
          >
            {cargando ? 'Actualizando…' : 'Actualizar horario'}
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {sesiones.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            mb: 2,
          }}
        >
          <StatCard
            label="Sesiones programadas"
            value={sesiones.length}
            icon={<ScheduleIcon />}
            description="Sesiones consultadas en tu horario"
          />
          <StatCard
            label="Días con sesiones"
            value={diasDisponibles.length}
            icon={<ScheduleIcon />}
            description="Días de la semana con al menos una sesión"
          />
        </Box>
      )}

      <SectionCard title="Horario semanal" subtitle="Filtra por día para ver tus clases.">
        {error && sesiones.length === 0 ? (
          <ErrorState message={error} onRetry={() => void cargarHorario()} minHeight={200} />
        ) : cargando && sesiones.length === 0 ? (
          <LoadingState label="Cargando horario…" minHeight={200} />
        ) : sesiones.length === 0 ? (
          <EmptyState
            title="Sin sesiones programadas"
            description="No tienes sesiones programadas en este momento."
            icon={<ScheduleIcon />}
            minHeight={200}
          />
        ) : (
          <>
            <ToggleButtonGroup
              exclusive
              value={filtroDia}
              aria-label="Filtrar horario por día"
              onChange={(_event, dia: number | 'todos' | null) => {
                if (dia !== null) setFiltroDia(dia);
              }}
              sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}
            >
              <ToggleButton
                value="todos"
                aria-label="Ver todos los días"
                aria-pressed={filtroDia === 'todos'}
                sx={{ px: 1.5, py: 0.75 }}
              >
                Todos
              </ToggleButton>
              {diasDisponibles.map((dia) => (
                <ToggleButton
                  key={dia}
                  value={dia}
                  aria-label={`Filtrar por ${nombreDia(dia)}`}
                  aria-pressed={filtroDia === dia}
                  sx={{ px: 1.5, py: 0.75 }}
                >
                  {nombreDia(dia)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {esMovil ? (
              <Stack spacing={2}>
                {sesionesPorDia.map(({ dia, items }) => (
                  <Box key={dia}>
                    <Typography variant="h3" sx={{ mb: 1 }}>
                      {nombreDia(dia)}
                    </Typography>
                    <Stack spacing={1}>
                      {items.map((sesion) => (
                        <Box
                          key={sesion.id}
                          sx={{ p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
                          >
                            <Typography variant="h4">
                              {sesion.horaInicio} – {sesion.horaFin}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {noDisponible(sesion.periodo)}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                            {noDisponible(sesion.programaNombre)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Grupo: {noDisponible(sesion.grupoCodigo)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Salón: {noDisponible(sesion.salon)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <DataTable
                ariaLabel="Horario de clases"
                columns={columnas}
                rows={sesionesFiltradas}
                rowKey={(sesion) => sesion.id}
                loading={cargando}
                emptyMessage="No hay sesiones para el día seleccionado."
              />
            )}
          </>
        )}
      </SectionCard>
    </Box>
  );
}
