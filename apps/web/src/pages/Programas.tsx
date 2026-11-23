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
  School as SchoolIcon,
  Publish as PublishIcon,
  Lock as LockIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { ProgramaDto, CrearProgramaDto, ProblemDetailsDto } from '../api/client';

export default function Programas() {
  const { hasPermission } = useAuth();
  const [programas, setProgramas] = useState<ProgramaDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [abiertoDialogo, setAbiertoDialogo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [areaNuevo, setAreaNuevo] = useState<'danza' | 'musica' | 'teatro' | 'artes_plasticas'>('musica');
  const [descripcionNuevo, setDescripcionNuevo] = useState('');
  const [cupoNuevo, setCupoNuevo] = useState('');

  const puedeGestionar = hasPermission('academic:program:manage');

  const cargarProgramas = useCallback(async () => {
    if (!puedeGestionar) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/academic/programs');
      if (apiError || !data) {
        setError('No se pudieron cargar los programas');
        return;
      }
      setProgramas(data.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar programas');
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar]);

  const manejarCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombreNuevo.trim() || !cupoNuevo.trim()) {
      setError('Nombre y cupo máximo son obligatorios');
      return;
    }
    setCargando(true);
    try {
      const payload: CrearProgramaDto = {
        nombre: nombreNuevo.trim(),
        descripcion: descripcionNuevo.trim() || null,
        area: areaNuevo,
        cupoMaximo: parseInt(cupoNuevo, 10),
      };
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/academic/programs', { body: payload });
      if (apiError || response?.status !== 201) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al crear el programa');
        return;
      }
      const dto = data;
      setExito(`Programa "${dto.nombre}" creado correctamente`);
      setNombreNuevo('');
      setAreaNuevo('musica');
      setDescripcionNuevo('');
      setCupoNuevo('');
      setAbiertoDialogo(false);
      await cargarProgramas();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear programa');
    } finally {
      setCargando(false);
    }
  };

  const manejarTransicion = async (programa: ProgramaDto, to: 'publicado' | 'archivado') => {
    setCargando(true);
    setError(null);
    try {
      const { error: apiError, response } = await apiClient.POST(
        '/academic/programs/{id}/transitions',
        { params: { path: { id: programa.id } }, body: { to } },
      );
      if (apiError || response?.status !== 200) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al cambiar el estado');
        return;
      }
      setExito(`Estado del programa "${programa.nombre}" cambiado a ${to}`);
      await cargarProgramas();
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
          <SchoolIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Administración de Programas</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para gestionar programas.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h1">Administración de Programas</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAbiertoDialogo(true)}>
          Nuevo programa
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
        <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
          Listado de programas
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Área</TableCell>
                <TableCell>Cupo máximo</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {programas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell sx={{ fontWeight: 'medium' }}>{p.nombre}</TableCell>
                  <TableCell>{p.area}</TableCell>
                  <TableCell>{p.cupoMaximo}</TableCell>
                  <TableCell>
                    <Chip
                      label={p.estado}
                      size="small"
                      color={
                        p.estado === 'publicado'
                          ? 'success'
                          : p.estado === 'archivado'
                            ? 'default'
                            : 'warning'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {p.estado === 'borrador' && (
                      <Button
                        size="small"
                        startIcon={<PublishIcon fontSize="small" />}
                        onClick={() => void manejarTransicion(p, 'publicado')}
                        disabled={cargando}
                      >
                        Publicar
                      </Button>
                    )}
                    {p.estado === 'publicado' && (
                      <Button
                        size="small"
                        startIcon={<LockIcon fontSize="small" />}
                        onClick={() => void manejarTransicion(p, 'archivado')}
                        disabled={cargando}
                      >
                        Archivar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {programas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No hay programas registrados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={abiertoDialogo} onClose={() => setAbiertoDialogo(false)} maxWidth="sm">
        <DialogTitle>Crear programa</DialogTitle>
        <DialogContent>
          <DialogContentText>Completa los datos del nuevo programa formativo.</DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="nombre-programa"
            label="Nombre del programa"
            type="text"
            fullWidth
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
          />
          <FormControl margin="dense" fullWidth>
            <InputLabel id="label-area">Área artística</InputLabel>
            <Select
              labelId="label-area"
              id="select-area"
              label="Área artística"
              value={areaNuevo}
              onChange={(e) => setAreaNuevo(e.target.value as typeof areaNuevo)}
            >
              <MenuItem value="danza">Danza</MenuItem>
              <MenuItem value="musica">Música</MenuItem>
              <MenuItem value="teatro">Teatro</MenuItem>
              <MenuItem value="artes_plasticas">Artes plásticas</MenuItem>
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            id="descripcion-programa"
            label="Descripción"
            type="text"
            fullWidth
            value={descripcionNuevo}
            onChange={(e) => setDescripcionNuevo(e.target.value)}
          />
          <TextField
            margin="dense"
            id="cupo-programa"
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
            disabled={cargando || !nombreNuevo.trim() || !cupoNuevo.trim()}
          >
            {cargando ? <CircularProgress size={20} /> : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
