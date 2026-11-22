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
  TextField,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Group as GroupIcon, Lock as LockIcon, Add as AddIcon } from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { GrupoDto, CrearGrupoDto, ProgramaDto, ProblemDetailsDto } from '../api/client';

export default function Grupos() {
  const { hasPermission } = useAuth();
  const [grupos, setGrupos] = useState<GrupoDto[]>([]);
  const [programas, setProgramas] = useState<ProgramaDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [abiertoDialogo, setAbiertoDialogo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [programaIdNuevo, setProgramaIdNuevo] = useState('');
  const [horarioNuevo, setHorarioNuevo] = useState('');
  const [cupoNuevo, setCupoNuevo] = useState('');

  const puedeGestionar = hasPermission('academic:group:manage');

  const cargarGrupos = useCallback(async () => {
    if (!puedeGestionar) return;
    setCargando(true);
    setError(null);
    try {
      const [resGrupos, resProgramas] = await Promise.all([
        apiClient.GET('/academic/groups'),
        apiClient.GET('/academic/programs'),
      ]);
      if (resGrupos.error || !resGrupos.data) {
        setError('No se pudieron cargar los grupos');
        return;
      }
      if (resProgramas.error || !resProgramas.data) {
        setError('No se pudieron cargar los programas');
        return;
      }
      setGrupos(resGrupos.data);
      setProgramas(
        (resProgramas.data as ProgramaDto[]).map((p) => ({
          id: p.id,
          nombre: p.nombre,
          cupo: p.cupo,
          inscritos: p.inscritos,
          estado: p.estado,
        })),
      );
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar grupos');
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar]);

  const manejarCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (
      !nombreNuevo.trim() ||
      !programaIdNuevo.trim() ||
      !horarioNuevo.trim() ||
      !cupoNuevo.trim()
    ) {
      setError('Todos los campos son obligatorios');
      return;
    }
    setCargando(true);
    try {
      const payload: CrearGrupoDto = {
        nombre: nombreNuevo.trim(),
        programaId: programaIdNuevo.trim(),
        horario: horarioNuevo.trim(),
        cupo: parseInt(cupoNuevo, 10),
      };
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/academic/groups', { body: payload });
      if (apiError || response?.status !== 201) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al crear el grupo');
        return;
      }
      const dto = data;
      setExito(`Grupo "${dto.nombre}" creado correctamente`);
      setNombreNuevo('');
      setProgramaIdNuevo('');
      setHorarioNuevo('');
      setCupoNuevo('');
      setAbiertoDialogo(false);
      await cargarGrupos();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear grupo');
    } finally {
      setCargando(false);
    }
  };

  const manejarTransicion = async (grupo: GrupoDto, to: 'abierto' | 'cerrado') => {
    setCargando(true);
    setError(null);
    try {
      const { error: apiError, response } = await apiClient.POST(
        '/academic/groups/{id}/transitions',
        { params: { path: { id: grupo.id } }, body: { to } },
      );
      if (apiError || response?.status !== 200) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al cambiar el estado');
        return;
      }
      setExito(`Estado del grupo "${grupo.nombre}" cambiado a ${to}`);
      await cargarGrupos();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cambiar el estado');
    } finally {
      setCargando(false);
    }
  };

  if (!puedeGestionar) {
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
          <GroupIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Administración de Grupos</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para gestionar grupos.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Administración de Grupos</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAbiertoDialogo(true)}>
          Nuevo grupo
        </Button>
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

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Listado de grupos
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Programa</TableCell>
                <TableCell>Horario</TableCell>
                <TableCell>Cupo</TableCell>
                <TableCell>Inscritos</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {grupos.map((g) => {
                const programa = programas.find((p) => p.id === g.programaId);
                return (
                  <TableRow key={g.id}>
                    <TableCell sx={{ fontWeight: 'medium' }}>{g.nombre}</TableCell>
                    <TableCell>{programa?.nombre || '-'}</TableCell>
                    <TableCell>{g.horario}</TableCell>
                    <TableCell>{g.cupo}</TableCell>
                    <TableCell>{g.inscritos}</TableCell>
                    <TableCell>
                      <Chip
                        label={g.estado}
                        size="small"
                        color={g.estado === 'abierto' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {g.estado === 'abierto' && (
                        <Button
                          size="small"
                          startIcon={<LockIcon fontSize="small" />}
                          onClick={() => void manejarTransicion(g, 'cerrado')}
                          disabled={cargando}
                        >
                          Cerrar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {grupos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>No hay grupos registrados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={abiertoDialogo} onClose={() => setAbiertoDialogo(false)} maxWidth="sm">
        <DialogTitle>Crear grupo</DialogTitle>
        <DialogContent>
          <DialogContentText>Asigna el grupo a un programa existente.</DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="nombre-grupo"
            label="Nombre del grupo"
            type="text"
            fullWidth
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
          />
          <FormControl margin="dense" fullWidth>
            <InputLabel id="label-programa">Programa</InputLabel>
            <Select
              labelId="label-programa"
              id="select-programa"
              label="Programa"
              value={programaIdNuevo}
              onChange={(e) => setProgramaIdNuevo(e.target.value)}
            >
              <MenuItem value="">Selecciona un programa</MenuItem>
              {programas.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            id="horario-grupo"
            label="Horario (ej. Lun 18:00)"
            type="text"
            fullWidth
            value={horarioNuevo}
            onChange={(e) => setHorarioNuevo(e.target.value)}
          />
          <TextField
            margin="dense"
            id="cupo-grupo"
            label="Cupo máximo"
            type="number"
            fullWidth
            value={cupoNuevo}
            onChange={(e) => setCupoNuevo(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbiertoDialogo(false)}>Cancelar</Button>
          <Button
            onClick={manejarCrear}
            disabled={
              cargando ||
              !nombreNuevo.trim() ||
              !programaIdNuevo.trim() ||
              !horarioNuevo.trim() ||
              !cupoNuevo.trim()
            }
          >
            {cargando ? <CircularProgress size={20} /> : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
