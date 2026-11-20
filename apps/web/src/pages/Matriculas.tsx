import { useState, useCallback } from 'react';
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
import {
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import type { MatriculaDto, ProblemDetailsDto, GrupoDto } from '../api/client';

type MatriculaView = {
  id: string;
  estudianteNombre: string;
  programaNombre: string;
  grupoNombre: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  creadoEn: string;
};

export default function Matriculas() {
  const { user, hasPermission } = useAuth();
  const [matriculas, setMatriculas] = useState<MatriculaView[]>([]);
  const [gruposDisponibles] = useState<GrupoDto[]>([
    { id: 'G-001', nombre: 'Guitarra Básica', programaId: 'P-001', programaNombre: 'Música', horario: 'Lun 18:00', cupo: 15, inscritos: 5, estado: 'abierto' },
    { id: 'G-002', nombre: 'Acuarela', programaId: 'P-002', programaNombre: 'Pintura', horario: 'Mar 16:00', cupo: 10, inscritos: 3, estado: 'abierto' },
  ]);
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
      setMatriculas((data as MatriculaDto[]).map((m) => ({
        id: m.id,
        estudianteNombre: m.estudianteNombre,
        programaNombre: m.programaNombre,
        grupoNombre: m.grupoNombre,
        estado: m.estado,
        creadoEn: m.creadoEn,
      })));
    } catch (err: any) {
      setError(err.message || 'Error al cargar matrículas');
    } finally {
      setCargando(false);
    }
  }, [puedeLeerPropia, puedeGestionar]);

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
      const { data, error: apiError, response } = await apiClient.POST(
        '/academic/enrollments',
        { body: payload }
      );
      if (apiError || response?.status !== 201) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al crear la matrícula');
        return;
      }
      const dto = data as MatriculaDto;
      setExito(`Matrícula en "${dto.grupoNombre}" creada correctamente`);
      setGrupoSeleccionado('');
      await cargarMatriculas();
    } catch (err: any) {
      setError(err.message || 'Error inesperado al crear matrícula');
    } finally {
      setCargando(false);
    }
  };

  if (!puedeLeerPropia && !puedeGestionar) {
    return (
      <Box sx={{ p: 3, minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
        <Typography variant="h4">Gestión de Matrículas</Typography>
        {puedeGestionar && (
          <Button
            size="small"
            disabled={cargando}
            onClick={cargarMatriculas}
          >
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
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Nueva matrícula
          </Typography>
          <form noValidate>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
              <Box component="label" sx={{ fontWeight: 'medium', mb: 1 }}>
                Grupo
              </Box>
              <Select
                value={grupoSeleccionado}
                onChange={(e: any) => setGrupoSeleccionado(e.target.value)}
              >
                <MenuItem value="">Selecciona un grupo abierto</MenuItem>
                {gruposDisponibles.map((g: GrupoDto) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.nombre} ({g.programaNombre})
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
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Mis matrículas
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Programa</TableCell>
                <TableCell>Grupo</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Fecha</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matriculas.map((m) => (
                <TableRow key={m.id}>
                  <TableCell sx={{ fontWeight: 'medium' }}>{m.programaNombre}</TableCell>
                  <TableCell>{m.grupoNombre}</TableCell>
                  <TableCell>
                    <Chip
                      label={m.estado}
                      size="small"
                      color={
                        m.estado === 'confirmada'
                          ? 'success'
                          : m.estado === 'pendiente'
                            ? 'warning'
                            : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {m.creadoEn ? new Date(m.creadoEn).toLocaleString('es-CO') : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {matriculas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>No hay matrículas registradas.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
