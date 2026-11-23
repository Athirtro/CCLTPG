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
  Select,
  MenuItem,
} from '@mui/material';
import { Assignment as AssignmentIcon } from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { MatriculaDto, GrupoDto, ProblemDetailsDto } from '../api/client';

export default function Matriculas() {
  const { user, hasPermission } = useAuth();
  const [matriculas, setMatriculas] = useState<MatriculaDto[]>([]);
  const [gruposDisponibles, setGruposDisponibles] = useState<GrupoDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string>('');

  const puedeGestionar = hasPermission('academic:enrollment:manage');
  const puedeLeerPropia = hasPermission('academic:enrollment:read_own');

  const cargarMatriculas = useCallback(async () => {
    if (!puedeLeerPropia && !puedeGestionar) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/me/enrollments');
      if (apiError || !data) {
        setError('No se pudieron cargar las matrículas');
        return;
      }
      setMatriculas(data.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar matrículas');
    } finally {
      setCargando(false);
    }
  }, [puedeLeerPropia, puedeGestionar]);

  const cargarGrupos = useCallback(async () => {
    if (!puedeGestionar) return;
    try {
      const { data, error: apiError } = await apiClient.GET('/academic/groups');
      if (apiError || !data) return;
      setGruposDisponibles(data.data.filter((g) => g.estado === 'abierto'));
    } catch {
      // No bloquear la creación si falla la carga de grupos
    }
  }, [puedeGestionar]);

  useEffect(() => {
    if (puedeGestionar) {
      void cargarGrupos();
    }
  }, [cargarGrupos, puedeGestionar]);

  const manejarCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!grupoSeleccionado) {
      setError('Selecciona un grupo');
      return;
    }
    setCargando(true);
    try {
      const payload = {
        estudianteId: user?.id ?? '',
        grupoId: grupoSeleccionado,
      };
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/academic/enrollments', { body: payload });
      if (apiError || response?.status !== 201) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al crear la matrícula');
        return;
      }
      const dto = data;
      setExito(`Matrícula en "${dto.grupoCodigo}" creada correctamente`);
      setGrupoSeleccionado('');
      await cargarMatriculas();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear matrícula');
    } finally {
      setCargando(false);
    }
  };

  if (!puedeLeerPropia && !puedeGestionar) {
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
          <AssignmentIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Matrículas</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para ver matrículas.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h1">Gestión de Matrículas</Typography>
        {puedeGestionar && (
          <Button size="small" disabled={cargando} onClick={cargarMatriculas}>
            Actualizar
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {exito && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setExito(null)}>
          {exito}
        </Alert>
      )}

      {puedeGestionar && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
            Nueva matrícula
          </Typography>
          <form noValidate>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
              <Box component="label" sx={{ fontWeight: 'medium', mb: 1 }}>
                Grupo abierto
              </Box>
              <Select
                value={grupoSeleccionado}
                onChange={(e) => setGrupoSeleccionado(e.target.value)}
              >
                <MenuItem value="">Selecciona un grupo abierto</MenuItem>
                {gruposDisponibles.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.codigo} — {g.periodo}
                  </MenuItem>
                ))}
              </Select>
            </Box>
            <Button
              type="submit"
              variant="contained"
              disabled={cargando || !grupoSeleccionado}
              onClick={manejarCrear}
            >
              {cargando ? <CircularProgress size={20} /> : 'Crear matrícula'}
            </Button>
          </form>
        </Paper>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
          Mis matrículas
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Programa</TableCell>
                <TableCell>Grupo</TableCell>
                <TableCell>Periodo</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Fecha</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matriculas.map((m) => (
                <TableRow key={m.id}>
                  <TableCell sx={{ fontWeight: 'medium' }}>{m.programaNombre}</TableCell>
                  <TableCell>{m.grupoCodigo}</TableCell>
                  <TableCell>{m.periodo}</TableCell>
                  <TableCell>
                    <Chip
                      label={m.estado}
                      size="small"
                      color={
                        m.estado === 'confirmada' || m.estado === 'activa'
                          ? 'success'
                          : m.estado === 'preinscrita'
                            ? 'warning'
                            : m.estado === 'cancelada' || m.estado === 'retirada'
                              ? 'default'
                              : 'secondary'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {m.fechaMatricula ? new Date(m.fechaMatricula).toLocaleString('es-CO') : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {matriculas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No hay matrículas registradas.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
