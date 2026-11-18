import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

import { API_BASE_URL, apiClient, type ProblemDetails, type ReadinessReport } from '../api/client';
import { summarize, toHealthRows } from '../api/health';

function fallbackProblem(detail: string): ProblemDetails {
  return {
    type: 'about:blank',
    title: 'Error de conexión',
    status: 0,
    detail,
    instance: '/health/ready',
    code: 'NETWORK_ERROR',
    requestId: '',
  };
}

export default function Health() {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [problem, setProblem] = useState<ProblemDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error, response } = await apiClient.GET('/health/ready');
      if (data && response.ok) {
        setReport(data);
        setProblem(null);
      } else {
        setReport(null);
        setProblem(error ?? fallbackProblem('Respuesta inesperada.'));
      }
    } catch {
      setReport(null);
      setProblem(fallbackProblem('No se pudo contactar con la API.'));
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Estado del sistema
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Comprobación de disponibilidad de la API ({API_BASE_URL}) y sus dependencias.
      </Typography>

      <Paper sx={{ p: 3 }} aria-live="polite">
        <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void load()}
            disabled={loading}
          >
            Actualizar
          </Button>
          {loading && <CircularProgress size={20} aria-label="Comprobando estado" />}
          {summary && <Chip label={summary.label} color={summary.severity} />}
          {lastChecked && (
            <Typography variant="body2" color="text.secondary">
              Última comprobación: {lastChecked.toLocaleTimeString('es-CO')}
            </Typography>
          )}
        </Stack>

        {problem && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {problem.detail}
            {problem.code && (
              <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                Código: {problem.code}
                {problem.requestId ? ` · requestId: ${problem.requestId}` : ''}
              </Typography>
            )}
          </Alert>
        )}

        {report && (
          <>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Comprobado en: {new Date(report.checkedAt).toLocaleString('es-CO')}
            </Typography>
            <Table size="small" aria-label="Estado de las dependencias">
              <TableHead>
                <TableRow>
                  <TableCell>Dependencia</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Latencia</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {toHealthRows(report).map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.status === 'up' ? 'Disponible' : 'Caída'}
                        color={row.status === 'up' ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell align="right">{row.latencyMs} ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Paper>
    </Box>
  );
}
