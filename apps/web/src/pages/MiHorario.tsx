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
import {
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';

type SesionHorarioView = {
  id: string;
  grupoNombre: string;
  programaNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  salon: string;
  estado: 'programada' | 'realizada' | 'cancelada';
};

export default function MiHorario() {
  const { hasPermission } = useAuth();
  const [sesiones, setSesiones] = useState<SesionHorarioView[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setSesiones(
        (data as Array<{
          id: string;
          grupoNombre: string;
          programaNombre: string;
          fecha: string;
          horaInicio: string;
          horaFin: string;
          salon: string;
          estado: string;
        }>).map((s) => ({
          id: s.id,
          grupoNombre: s.grupoNombre,
          programaNombre: s.programaNombre,
          fecha: s.fecha,
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
          salon: s.salon,
          estado: s.estado as 'programada' | 'realizada' | 'cancelada',
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Error al cargar el horario');
    } finally {
      setCargando(false);
    }
  }, [puedeLeer]);

  useEffect(() => {
    void cargarHorario();
  }, [cargarHorario]);

  if (!puedeLeer) {
    return (
      <Box sx={{ p: 3, minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ScheduleIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Mi horario</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para ver tu horario.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Mi horario de clases</Typography>
        <Button
          startIcon={<RefreshIcon />}
          size="small"
          disabled={cargando}
          onClick={cargarHorario}
        >
          {cargando ? <CircularProgress size={20} /> : 'Actualizar'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {sesiones.length === 0 && !cargando && (
        <Paper sx={{ p: 4, textAlign: 'center', minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <ScheduleIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="body1">No tienes sesiones programadas.</Typography>
        </Paper>
      )}

      {sesiones.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Programa</TableCell>
                <TableCell>Grupo</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Hora</TableCell>
                <TableCell>Salón</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sesiones.map((s) => (
                <TableRow key={s.id}>
                  <TableCell sx={{ fontWeight: 'medium' }}>{s.programaNombre}</TableCell>
                  <TableCell>{s.grupoNombre}</TableCell>
                  <TableCell>
                    {s.fecha ? new Date(s.fecha).toLocaleDateString('es-CO') : '-'}
                  </TableCell>
                  <TableCell>{s.horaInicio} - {s.horaFin}</TableCell>
                  <TableCell>{s.salon}</TableCell>
                  <TableCell>
                    <Chip
                      label={s.estado}
                      size="small"
                      color={
                        s.estado === 'programada'
                          ? 'info'
                          : s.estado === 'realizada'
                            ? 'success'
                            : 'default'
                      }
                    />
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
