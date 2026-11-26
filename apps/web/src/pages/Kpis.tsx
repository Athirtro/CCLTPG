import { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  LinearProgress,
  Typography,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  ExpandMore as ExpandMoreIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { KpiResultDto, KpiBreakdownItemDto } from '../api/client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatCard from '../components/common/StatCard';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

const UNIDAD_LABEL: Record<KpiResultDto['unidad'], string> = {
  conteo: 'Conteo',
  porcentaje: 'Porcentaje',
  distribucion: 'Distribución',
};

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleString('es-CO');
}

function formatearValor(kpi: KpiResultDto): string {
  if (kpi.valor === null) return '—';
  const numero = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: kpi.unidad === 'porcentaje' ? 1 : 0,
  }).format(kpi.valor);
  return kpi.unidad === 'porcentaje' ? `${numero} %` : numero;
}

function columnasDesglose(desglose: KpiBreakdownItemDto[]): DataTableColumn<KpiBreakdownItemDto>[] {
  const maximo = Math.max(0, ...desglose.map((item) => item.total));
  return [
    {
      id: 'clave',
      label: 'Clave',
      minWidth: 160,
      render: (item) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {item.clave}
        </Typography>
      ),
    },
    {
      id: 'total',
      label: 'Total',
      align: 'right',
      minWidth: 100,
      render: (item) => new Intl.NumberFormat('es-CO').format(item.total),
    },
    {
      id: 'distribucion',
      label: 'Distribución',
      minWidth: 220,
      render: (item) => {
        const porcentaje = maximo > 0 ? (item.total / maximo) * 100 : 0;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 180 }}>
            <LinearProgress
              variant="determinate"
              value={porcentaje}
              sx={{ flex: 1 }}
              aria-label={`Proporción de ${item.clave}`}
            />
            <Typography variant="caption" color="text.secondary">
              {Math.round(porcentaje)}%
            </Typography>
          </Box>
        );
      },
    },
  ];
}

export default function Kpis() {
  const { hasPermission } = useAuth();
  const [kpis, setKpis] = useState<KpiResultDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeLeer = hasPermission('analytics:kpi:read');

  const cargarKpis = useCallback(async () => {
    if (!puedeLeer) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/analytics/kpis');
      if (apiError || !data) {
        setError('No se pudieron cargar los indicadores.');
        return;
      }
      setKpis(data.kpis);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar indicadores.');
    } finally {
      setCargando(false);
    }
  }, [puedeLeer]);

  useEffect(() => {
    void cargarKpis();
  }, [cargarKpis]);

  const cabecera = (
    <PageHeader
      title="Indicadores (KPIs)"
      description="Indicadores académicos calculados por el servicio de analítica."
      icon={<BarChartIcon />}
      breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Analítica' }, { label: 'Indicadores' }]}
      actions={
        puedeLeer ? (
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void cargarKpis()}
            disabled={cargando}
          >
            Actualizar
          </Button>
        ) : (
          <Button component={RouterLink} to="/" startIcon={<HomeIcon />}>
            Ir al inicio
          </Button>
        )
      }
    />
  );

  if (!puedeLeer) {
    return (
      <Box>
        {cabecera}
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para consultar los indicadores (analytics:kpi:read)."
          icon={<BarChartIcon />}
        />
      </Box>
    );
  }

  return (
    <Box>
      {cabecera}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {cargando && kpis.length === 0 ? (
        <LoadingState label="Cargando indicadores…" />
      ) : error && kpis.length === 0 ? (
        <ErrorState message={error} onRetry={() => void cargarKpis()} />
      ) : kpis.length === 0 ? (
        <EmptyState
          title="Sin indicadores disponibles"
          description="El servicio no devolvió indicadores para mostrar."
          icon={<BarChartIcon />}
        />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
              mb: 3,
            }}
          >
            {kpis.map((kpi) => (
              <StatCard
                key={kpi.code}
                label={kpi.nombre}
                value={formatearValor(kpi)}
                icon={<BarChartIcon />}
                description={`Calculado: ${formatearFecha(kpi.calculadoEn)}`}
                status={{ label: UNIDAD_LABEL[kpi.unidad] ?? kpi.unidad, tone: 'primary' }}
              />
            ))}
          </Box>

          <SectionCard
            title="Detalle y desglose"
            subtitle="Despliega cada indicador para consultar su unidad, fecha de cálculo y desglose real."
          >
            {kpis.map((kpi) => {
              const columnas = columnasDesglose(kpi.desglose);
              return (
                <Accordion
                  key={kpi.code}
                  disableGutters
                  elevation={0}
                  sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    id={`kpi-${kpi.code}-cabecera`}
                    aria-controls={`kpi-${kpi.code}-panel`}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="h3">{kpi.nombre}</Typography>
                      <StatusChip status="primary" label={kpi.code} />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 2,
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                        mb: 2,
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Unidad
                        </Typography>
                        <Typography variant="body2">{UNIDAD_LABEL[kpi.unidad] ?? kpi.unidad}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Calculado en
                        </Typography>
                        <Typography variant="body2">{formatearFecha(kpi.calculadoEn)}</Typography>
                      </Box>
                    </Box>

                    <Typography variant="h4" sx={{ mb: 1 }}>
                      Desglose
                    </Typography>
                    {kpi.desglose.length === 0 ? (
                      <EmptyState
                        title="Sin desglose disponible"
                        description="Este indicador no incluye desglose en la respuesta del servicio."
                        minHeight={140}
                      />
                    ) : (
                      <DataTable
                        ariaLabel={`Desglose de ${kpi.nombre}`}
                        columns={columnas}
                        rows={kpi.desglose}
                        rowKey={(item) => item.clave}
                      />
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </SectionCard>
        </>
      )}
    </Box>
  );
}
