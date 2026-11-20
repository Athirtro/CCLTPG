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
} from '@mui/material';
import {
  School as SchoolIcon,
  Publish as PublishIcon,
  Lock as LockIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import type {
  ProgramaDto,
  CrearProgramaDto,
  ProblemDetailsDto,
} from '../api/client';

export default function Programas() {
  const { hasPermission } = useAuth();
  const [programas, setProgramas] = useState<ProgramaDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [abiertoDialogo, setAbiertoDialogo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
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
      setProgramas(data as ProgramaDto[]);
    } catch (err: any) {
      setError(err.message || 'Error al cargar programas');
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar]);

  const manejarCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombreNuevo.trim() || !cupoNuevo.trim()) {
      setError('Nombre y cupo son obligatorios');
      return;
    }
    setCargando(true);
    try {
      const payload: CrearProgramaDto = {
        nombre: nombreNuevo.trim(),
        cupo: parseInt(cupoNuevo, 10),
      };
      const { data, error: apiError, response } = await apiClient.POST(
        '/academic/programs',
        { body: payload }
      );
      if (apiError || response?.status !== 201) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al crear el programa');
        return;
      }
      const dto = data as ProgramaDto;
      setExito(`Programa "${dto.nombre}" creado correctamente`);
      setNombreNuevo('');
      setCupoNuevo('');
      setAbiertoDialogo(false);
      await cargarProgramas();
    } catch (err: any) {
      setError(err.message || 'Error inesperado al crear programa');
    } finally {
      setCargando(false);
    }
  };

  const manejarTransicion = async (programa: ProgramaDto, to: 'publicado' | 'cerrado') => {
    setCargando(true);
    setError(null);
    try {
      const { error: apiError, response } = await apiClient.POST(
        `/academic/programs/${programa.id}/transitions` as any,
        { params: { path: { id: programa.id } }, body: { to } }
      );
      if (apiError || response?.status !== 200) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al cambiar el estado');
        return;
      }
      setExito(`Estado del programa "${programa.nombre}" cambiado a ${to}`);
      await cargarProgramas();
    } catch (err: any) {
      setError(err.message || 'Error al cambiar el estado');
    } finally {
      setCargando(false);
    }
  };

  if (!puedeGestionar) {
    return (
      <Box sx={{ p: 3, minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
        <Typography variant="h4">Administración de Programas</Typography>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => setAbiertoDialogo(true)}
        >
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
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Listado de programas
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Cupo</TableCell>
                <TableCell>Inscritos</TableCell>
                <TableCell>Disponibles</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {programas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell sx={{ fontWeight: 'medium' }}>{p.nombre}</TableCell>
                  <TableCell>{p.cupo}</TableCell>
                  <TableCell>{p.inscritos}</TableCell>
                  <TableCell>{p.cupo - p.inscritos}</TableCell>
                  <TableCell>
                    <Chip
                      label={p.estado}
                      size="small"
                      color={
                        p.estado === 'publicado'
                          ? 'success'
                          : p.estado === 'cerrado'
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
                        onClick={() => void manejarTransicion(p, 'cerrado')}
                        disabled={cargando}
                      >
                        Cerrar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {programas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>No hay programas registrados.</TableCell>
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
        <DialogTitle>Crear programa</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Completa los datos del nuevo programa formativo.
          </DialogContentText>
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
