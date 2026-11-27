import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { BarChart as BarChartIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { MyEvaluacionDto } from '../api/client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatCard from '../components/common/StatCard';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

type ValorEvaluacion = MyEvaluacionDto['valor'];
type TonoValor = 'success' | 'warning' | 'error';

const VALOR_LABEL: Record<ValorEvaluacion, string> = {
  excelente: 'Excelente',
  bueno: 'Bueno',
  regular: 'Regular',
  deficiente: 'Deficiente',
};

const VALOR_TONO: Record<ValorEvaluacion, TonoValor> = {
  excelente: 'success',
  bueno: 'success',
  regular: 'warning',
  deficiente: 'error',
};

const BREADCRUMBS = [{ label: 'Inicio', to: '/' }, { label: 'Mis evaluaciones' }];

const DESCRIPCION = 'Consulta las valoraciones cualitativas registradas sobre tu desempeño.';

const formatearFecha = (valor: string) =>
  valor ? new Date(valor).toLocaleDateString('es-CO') : 'No disponible';

export default function MisEvaluaciones() {
  const { hasPermission } = useAuth();
  const [evaluaciones, setEvaluaciones] = useState<MyEvaluacionDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeLeer = hasPermission('academic:evaluation:read_own');

  const cargarEvaluaciones = useCallback(async () => {
    if (!puedeLeer) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/me/evaluations');
      if (apiError || !data) {
        setError('No se pudieron cargar las evaluaciones');
        return;
      }
      setEvaluaciones(data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar evaluaciones');
    } finally {
      setCargando(false);
    }
  }, [puedeLeer]);

  useEffect(() => {
    void cargarEvaluaciones();
  }, [cargarEvaluaciones]);

  const ultimaEvaluacion = useMemo(
    () => [...evaluaciones].sort((a, b) => b.evaluadoEn.localeCompare(a.evaluadoEn))[0] ?? null,
    [evaluaciones],
  );

  const columnas: DataTableColumn<MyEvaluacionDto>[] = [
    {
      id: 'indicador',
      label: 'Indicador',
      minWidth: 180,
      render: (evaluacion) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {evaluacion.indicadorNombre}
        </Typography>
      ),
    },
    { id: 'programa', label: 'Programa', minWidth: 180, render: (e) => e.programaNombre },
    { id: 'grupo', label: 'Grupo', minWidth: 110, render: (e) => e.grupoCodigo },
    { id: 'periodo', label: 'Periodo', minWidth: 110, render: (e) => e.periodo },
    {
      id: 'valor',
      label: 'Valoración',
      minWidth: 140,
      render: (evaluacion) => (
        <StatusChip status={VALOR_TONO[evaluacion.valor]} label={VALOR_LABEL[evaluacion.valor]} />
      ),
    },
    {
      id: 'observacion',
      label: 'Observación',
      minWidth: 220,
      render: (evaluacion) =>
        evaluacion.observacion ? (
          <Typography variant="body2">{evaluacion.observacion}</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No disponible
          </Typography>
        ),
    },
    {
      id: 'fecha',
      label: 'Fecha',
      minWidth: 120,
      render: (evaluacion) => formatearFecha(evaluacion.evaluadoEn),
    },
  ];

  if (!puedeLeer) {
    return (
      <Box>
        <PageHeader
          title="Mis evaluaciones"
          description={DESCRIPCION}
          icon={<BarChartIcon />}
          breadcrumbs={BREADCRUMBS}
        />
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para ver tus evaluaciones."
          icon={<BarChartIcon />}
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Mis evaluaciones"
        description={DESCRIPCION}
        icon={<BarChartIcon />}
        breadcrumbs={BREADCRUMBS}
        actions={
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void cargarEvaluaciones()}
            disabled={cargando}
          >
            {cargando ? 'Actualizando…' : 'Actualizar evaluaciones'}
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {evaluaciones.length > 0 && ultimaEvaluacion && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            mb: 2,
          }}
        >
          <StatCard
            label="Total de evaluaciones"
            value={evaluaciones.length}
            icon={<BarChartIcon />}
            description="Registros consultados"
          />
          <StatCard
            label="Última valoración"
            value={VALOR_LABEL[ultimaEvaluacion.valor]}
            icon={<BarChartIcon />}
            description={`Registrada el ${formatearFecha(ultimaEvaluacion.evaluadoEn)}`}
            status={{
              label: 'Valoración registrada',
              tone: VALOR_TONO[ultimaEvaluacion.valor],
            }}
          />
        </Box>
      )}

      <SectionCard
        title="Historial de evaluaciones"
        subtitle="Detalle de cada valoración registrada."
      >
        {error && evaluaciones.length === 0 ? (
          <ErrorState message={error} onRetry={() => void cargarEvaluaciones()} minHeight={200} />
        ) : cargando && evaluaciones.length === 0 ? (
          <LoadingState label="Cargando evaluaciones…" minHeight={200} />
        ) : evaluaciones.length === 0 ? (
          <EmptyState
            title="Sin evaluaciones registradas"
            description="Cuando registres evaluaciones aparecerán aquí."
            icon={<BarChartIcon />}
            minHeight={200}
          />
        ) : (
          <DataTable
            ariaLabel="Historial de evaluaciones"
            columns={columnas}
            rows={evaluaciones}
            rowKey={(evaluacion) => evaluacion.id}
            loading={cargando}
            emptyMessage="No hay evaluaciones para mostrar."
          />
        )}
      </SectionCard>
    </Box>
  );
}
