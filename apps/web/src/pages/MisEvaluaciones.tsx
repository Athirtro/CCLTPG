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
  CircularProgress,
} from '@mui/material';
import { BarChart as BarChartIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';

type EvaluacionView = {
  id: string;
  estudianteNombre: string;
  grupoNombre: string;
  indicador: string;
  periodo: string;
  valor: number;
  fecha: string;
};

export default function MisEvaluaciones() {
  const { hasPermission } = useAuth();
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionView[]>([]);
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
      setEvaluaciones(
        (
          data as Array<{
            id: string;
            estudianteNombre: string;
            grupoNombre: string;
            indicador: string;
            periodo: string;
            valor: number;
            fecha: string;
          }>
        ).map((e) => ({
          id: e.id,
          estudianteNombre: e.estudianteNombre,
          grupoNombre: e.grupoNombre,
          indicador: e.indicador,
          periodo: e.periodo,
          valor: e.valor,
          fecha: e.fecha,
        })),
      );
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar evaluaciones');
    } finally {
      setCargando(false);
    }
  }, [puedeLeer]);

  useEffect(() => {
    void cargarEvaluaciones();
  }, [cargarEvaluaciones]);

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
          <Typography variant="h6">Mis evaluaciones</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para ver tus evaluaciones.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const promedio =
    evaluaciones.length > 0
      ? (evaluaciones.reduce((sum, e) => sum + e.valor, 0) / evaluaciones.length).toFixed(1)
      : '—';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h1">Mis evaluaciones</Typography>
        <Button
          startIcon={<RefreshIcon />}
          size="small"
          disabled={cargando}
          onClick={cargarEvaluaciones}
        >
          {cargando ? (
            <CircularProgress size={20} aria-label="Cargando evaluaciones" />
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

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
          Resumen
        </Typography>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Evaluaciones registradas
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {evaluaciones.length}
            </Typography>
          </Box>
          <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Promedio
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {promedio}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {evaluaciones.length === 0 && !cargando && (
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
          <Typography variant="body1">No tienes evaluaciones registradas.</Typography>
        </Paper>
      )}

      {evaluaciones.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Grupo</TableCell>
                <TableCell>Indicador</TableCell>
                <TableCell>Periodo</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Fecha</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {evaluaciones.map((e) => (
                <TableRow key={e.id}>
                  <TableCell sx={{ fontWeight: 'medium' }}>{e.grupoNombre}</TableCell>
                  <TableCell>{e.indicador}</TableCell>
                  <TableCell>{e.periodo}</TableCell>
                  <TableCell>{e.valor}</TableCell>
                  <TableCell>
                    {e.fecha ? new Date(e.fecha).toLocaleDateString('es-CO') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
