import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import { BarChart as BarChartIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { KpiResultDto, KpiBreakdownItemDto } from '../api/client';

const UNIDAD_LABEL: Record<string, string> = {
  conteo: 'Conteo',
  porcentaje: 'Porcentaje',
  distribucion: 'Distribución',
};

export default function Kpis() {
  const { hasPermission } = useAuth();
  const [kpis, setKpis] = useState<KpiResultDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelAbierto, setPanelAbierto] = useState<string | null>(null);

  const puedeLeer = hasPermission('analytics:kpi:read');

  const cargarKpis = useCallback(async () => {
    if (!puedeLeer) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/analytics/kpis');
      if (apiError || !data) {
        setError('No se pudieron cargar los indicadores');
        return;
      }
      setKpis(data.kpis);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar indicadores');
    } finally {
      setCargando(false);
    }
  }, [puedeLeer]);

  useEffect(() => {
    void cargarKpis();
  }, [cargarKpis]);

  if (!puedeLeer) {
    return (
      <Box
        sx={{
          p: 3,
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <BarChartIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Indicadores (KPIs)</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para ver los indicadores.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h1">Indicadores (KPIs)</Typography>
        <Button startIcon={<RefreshIcon />} size="small" disabled={cargando} onClick={cargarKpis}>
          {cargando ? (
            <CircularProgress size={20} aria-label="Cargando indicadores" />
          ) : (
            'Actualizar'
          )}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {kpis.length === 0 && !cargando && (
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            minHeight: '40vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BarChartIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="body1">No hay indicadores disponibles.</Typography>
        </Paper>
      )}

      {kpis.map((kpi) => (
        <Paper key={kpi.code} sx={{ p: 3, mb: 3 }}>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h2" sx={{ fontWeight: 'bold' }}>
                {kpi.nombre}
              </Typography>
              <Chip label={kpi.code} size="small" color="default" />
            </Box>
            <Button
              size="small"
              onClick={() => setPanelAbierto(panelAbierto === kpi.code ? null : kpi.code)}
            >
              {panelAbierto === kpi.code ? 'Ocultar detalle' : 'Ver detalle'}
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Valor
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {kpi.valor ?? '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {UNIDAD_LABEL[kpi.unidad] ?? kpi.unidad}
              </Typography>
            </Box>
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Calculado
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {kpi.calculadoEn ? new Date(kpi.calculadoEn).toLocaleString('es-CO') : '—'}
              </Typography>
            </Box>
          </Box>

          {panelAbierto === kpi.code && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h3" gutterBottom sx={{ mb: 1 }}>
                Desglose
              </Typography>
              {kpi.desglose.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin desglose disponible.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Clave</TableCell>
                        <TableCell>Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {kpi.desglose.map((item: KpiBreakdownItemDto) => (
                        <TableRow key={item.clave}>
                          <TableCell sx={{ fontWeight: 'medium' }}>{item.clave}</TableCell>
                          <TableCell>{item.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Paper>
      ))}
    </Box>
  );
}
