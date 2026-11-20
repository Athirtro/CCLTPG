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
import {
  People as PeopleIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import type {
  EstudianteDto,
  CrearEstudianteDto,
  ProgramaDto,
  ProblemDetailsDto,
} from '../api/client';

export default function Estudiantes() {
  const { hasPermission } = useAuth();
  const [estudiantes, setEstudiantes] = useState<EstudianteDto[]>([]);
  const [programas, setProgramas] = useState<ProgramaDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [abiertoDialogo, setAbiertoDialogo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [emailNuevo, setEmailNuevo] = useState('');
  const [programaIdNuevo, setProgramaIdNuevo] = useState('');
  const [estadoNuevo, setEstadoNuevo] = useState<'activo' | 'inactivo' | 'bloqueado'>('activo');

  const puedeGestionar = hasPermission('academic:student:manage');

  const cargarEstudiantes = useCallback(async () => {
    if (!puedeGestionar) return;
    setCargando(true);
    setError(null);
    try {
      const [resEstudiantes, resProgramas] = await Promise.all([
        apiClient.GET('/academic/students'),
        apiClient.GET('/academic/programs'),
      ]);
      if (resEstudiantes.error || !resEstudiantes.data) {
        setError('No se pudieron cargar los estudiantes');
        return;
      }
      if (resProgramas.error || !resProgramas.data) {
        setError('No se pudieron cargar los programas');
        return;
      }
      setEstudiantes(resEstudiantes.data as EstudianteDto[]);
      setProgramas((resProgramas.data as ProgramaDto[]).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        cupo: p.cupo,
        inscritos: p.inscritos,
        estado: p.estado,
      })));
    } catch (err: any) {
      setError(err.message || 'Error al cargar estudiantes');
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar]);

  const manejarCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombreNuevo.trim() || !emailNuevo.trim()) {
      setError('Nombre y correo son obligatorios');
      return;
    }
    setCargando(true);
    try {
      const payload: CrearEstudianteDto = {
        nombre: nombreNuevo.trim(),
        email: emailNuevo.trim(),
        programaId: programaIdNuevo.trim() || undefined,
      };
      const { data, error: apiError, response } = await apiClient.POST(
        '/academic/students',
        { body: payload }
      );
      if (apiError || response?.status !== 201) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al crear el estudiante');
        return;
      }
      const dto = data as EstudianteDto;
      setExito(`Estudiante "${dto.nombre}" creado correctamente`);
      setNombreNuevo('');
      setEmailNuevo('');
      setProgramaIdNuevo('');
      setEstadoNuevo('activo');
      setAbiertoDialogo(false);
      await cargarEstudiantes();
    } catch (err: any) {
      setError(err.message || 'Error inesperado al crear estudiante');
    } finally {
      setCargando(false);
    }
  };

  if (!puedeGestionar) {
    return (
      <Box sx={{ p: 3, minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PeopleIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Administración de Estudiantes</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para gestionar estudiantes.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Administración de Estudiantes</Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => setAbiertoDialogo(true)}
        >
          Nuevo estudiante
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
          Listado de estudiantes
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell>Programa</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {estudiantes.map((e) => {
                const programa = programas.find((p) => p.id === e.programaId);
                return (
                  <TableRow key={e.id}>
                    <TableCell sx={{ fontWeight: 'medium' }}>{e.nombre}</TableCell>
                    <TableCell>{e.email}</TableCell>
                    <TableCell>{programa?.nombre || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={e.estado}
                        size="small"
                        color={
                          e.estado === 'activo'
                            ? 'success'
                            : e.estado === 'inactivo'
                              ? 'default'
                              : 'error'
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {estudiantes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>No hay estudiantes registrados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={abiertoDialogo}
        onClose={() => setAbiertoDialogo(false)}
        maxWidth="sm"
      >
        <DialogTitle>Crear estudiante</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Registra un nuevo estudiante en el sistema.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="nombre-estudiante"
            label="Nombre completo"
            type="text"
            fullWidth
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
          />
          <TextField
            margin="dense"
            id="email-estudiante"
            label="Correo electrónico"
            type="email"
            fullWidth
            value={emailNuevo}
            onChange={(e) => setEmailNuevo(e.target.value)}
          />
          <FormControl margin="dense" fullWidth>
            <InputLabel>Programa</InputLabel>
            <Select
              label="Programa"
              value={programaIdNuevo}
              onChange={(e) => setProgramaIdNuevo(e.target.value)}
            >
              <MenuItem value="">Sin programa asignado</MenuItem>
              {programas.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl margin="dense" fullWidth>
            <InputLabel>Estado</InputLabel>
            <Select
              label="Estado"
              value={estadoNuevo}
              onChange={(e) => setEstadoNuevo(e.target.value as 'activo' | 'inactivo' | 'bloqueado')}
            >
              <MenuItem value="activo">Activo</MenuItem>
              <MenuItem value="inactivo">Inactivo</MenuItem>
              <MenuItem value="bloqueado">Bloqueado</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbiertoDialogo(false)}>Cancelar</Button>
          <Button
            onClick={manejarCrear}
            disabled={cargando || !nombreNuevo.trim() || !emailNuevo.trim()}
          >
            {cargando ? <CircularProgress size={20} /> : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
