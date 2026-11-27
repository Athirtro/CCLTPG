import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { MonitorHeart as MonitorHeartIcon, Refresh as RefreshIcon } from '@mui/icons-material';

import { API_BASE_URL, apiClient, type ProblemDetails, type ReadinessReport } from '../api/client';
import { summarize, toHealthRows, type HealthRow } from '../api/health';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatCard from '../components/common/StatCard';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

function fallbackProblem(detail: string): ProblemDetails {
  return {
    type: 'about:blank',
    title: 'Error de conexión',
    status: 0,
    detail,
    instance: '/health/ready',
    code: 'NETWORK_ERROR',
    requestId: '',
    errors: [],
  };
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleString('es-CO');
}

export default function Health() {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [problem, setProblem] = useState<ProblemDetails | null>(null);
  const [live, setLive] = useState<{ status: string } | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [readyResult, liveResult] = await Promise.all([
        apiClient.GET('/health/ready'),
        apiClient.GET('/health/live'),
      ]);
      if (readyResult.data && readyResult.response.ok) {
        setReport(readyResult.data);
        setProblem(null);
      } else {
        setReport(null);
        setProblem(readyResult.error ?? fallbackProblem('Respuesta inesperada.'));
      }
      if (liveResult.data && liveResult.response.ok) {
        setLive(liveResult.data);
        setLiveError(null);
      } else {
        setLive(null);
        setLiveError('El endpoint /health/live no respondió correctamente.');
      }
    } catch {
      setReport(null);
      setProblem(fallbackProblem('No se pudo contactar con la API.'));
      setLive(null);
      setLiveError('El endpoint /health/live no respondió correctamente.');
    } finally {
      setLastChecked(new Date());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const summary = report ? summarize(report) : null;
  const filas = report ? toHealthRows(report) : [];

  const columnas: DataTableColumn<HealthRow>[] = [
    {
      id: 'dependencia',
      label: 'Dependencia',
      minWidth: 180,
      render: (fila) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {fila.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {fila.name}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'estado',
      label: 'Estado',
      minWidth: 180,
      render: (fila) => (
        <StatusChip
          status={fila.status === 'up' ? 'success' : 'error'}
          label={`${fila.status.toUpperCase()} · ${fila.status === 'up' ? 'Disponible' : 'Caída'}`}
        />
      ),
    },
    {
      id: 'latencia',
      label: 'Latencia',
      align: 'right',
      minWidth: 110,
      render: (fila) => `${fila.latencyMs} ms`,
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Estado del sistema"
        description={`Comprobación de disponibilidad de la API (${API_BASE_URL}) y sus dependencias.`}
        icon={<MonitorHeartIcon />}
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Estado del sistema' }]}
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void load()}
            disabled={loading}
          >
            Actualizar
          </Button>
        }
      />

      <SectionCard
        title="Disponibilidad"
        subtitle="El estado se consulta automáticamente cada 15 segundos"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {summary && <StatusChip status={summary.severity} label={summary.label} />}
            {lastChecked && (
              <Typography variant="caption" color="text.secondary">
                Última comprobación local: {lastChecked.toLocaleTimeString('es-CO')}
              </Typography>
            )}
          </Box>
        }
      >
        <Box aria-live="polite">
          {loading && !report && !problem ? (
            <LoadingState label="Comprobando disponibilidad…" />
          ) : problem ? (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                {problem.detail}
                {problem.code && (
                  <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                    Código: {problem.code}
                    {problem.requestId ? ` · requestId: ${problem.requestId}` : ''}
                  </Typography>
                )}
              </Alert>
              <ErrorState message={problem.detail} onRetry={() => void load()} minHeight={180} />
            </>
          ) : report ? (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  mb: 3,
                }}
              >
                <StatCard
                  label="Estado general"
                  value={summary?.label ?? report.status}
                  icon={<MonitorHeartIcon />}
                  description={`status del contrato: ${report.status}`}
                  status={{
                    label: report.status.toUpperCase(),
                    tone: summary?.severity ?? 'neutral',
                  }}
                />
                <StatCard
                  label="Comprobado en (servidor)"
                  value={formatearFecha(report.checkedAt)}
                  icon={<MonitorHeartIcon />}
                  description="checkedAt devuelto por /health/ready"
                />
              </Box>

              <Typography variant="h4" component="h3" sx={{ mb: 1 }}>
                Dependencias
              </Typography>
              {filas.length === 0 ? (
                <EmptyState
                  title="Sin comprobaciones"
                  description="El informe de disponibilidad no incluye dependencias."
                  minHeight={160}
                />
              ) : (
                <DataTable
                  ariaLabel="Estado de las dependencias"
                  columns={columnas}
                  rows={filas}
                  rowKey={(fila) => fila.name}
                  loading={loading}
                />
              )}
            </>
          ) : (
            <EmptyState
              title="Sin información de estado"
              description="No hay un informe de disponibilidad para mostrar."
              minHeight={160}
            />
          )}
        </Box>
      </SectionCard>

      <SectionCard
        title="Liveness"
        subtitle="Comprobación mínima de que el proceso de la API sigue activo"
        sx={{ mt: 3 }}
      >
        <Box aria-live="polite">
          {loading && !live && !liveError ? (
            <LoadingState label="Comprobando liveness…" minHeight={120} />
          ) : liveError ? (
            <Alert severity="error">{liveError}</Alert>
          ) : live ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <StatusChip
                status="success"
                label={`${live.status.toUpperCase()} · proceso activo`}
              />
              <Typography variant="body2" color="text.secondary">
                Respuesta de GET /health/live
              </Typography>
            </Box>
          ) : (
            <EmptyState
              title="Sin respuesta de liveness"
              description="No se recibió una respuesta válida del endpoint /health/live."
              minHeight={120}
            />
          )}
        </Box>
      </SectionCard>
    </Box>
  );
}
