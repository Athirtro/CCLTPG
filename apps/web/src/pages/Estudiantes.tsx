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
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { People as PeopleIcon, Add as AddIcon } from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { EstudianteSummaryDto, CrearEstudianteDto, ProblemDetailsDto } from '../api/client';

export default function Estudiantes() {
  const { hasPermission } = useAuth();
  const [estudiantes, setEstudiantes] = useState<EstudianteSummaryDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [abiertoDialogo, setAbiertoDialogo] = useState(false);
  const [tipoDocumentoNuevo, setTipoDocumentoNuevo] = useState('');
  const [numeroDocumentoNuevo, setNumeroDocumentoNuevo] = useState('');
  const [nombresNuevo, setNombresNuevo] = useState('');
  const [apellidosNuevo, setApellidosNuevo] = useState('');
  const [consentimientoNuevo, setConsentimientoNuevo] = useState(false);

  const puedeGestionar = hasPermission('academic:student:manage');

  const cargarEstudiantes = useCallback(async () => {
    if (!puedeGestionar) return;
    setCargando(true);
    setError(null);
    try {
      const resEstudiantes = await apiClient.GET('/academic/students');
      if (resEstudiantes.error || !resEstudiantes.data) {
        setError('No se pudieron cargar los estudiantes');
        return;
      }
      setEstudiantes(resEstudiantes.data.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar estudiantes');
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar]);

  const manejarCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (
      !tipoDocumentoNuevo.trim() ||
      !numeroDocumentoNuevo.trim() ||
      !nombresNuevo.trim() ||
      !apellidosNuevo.trim()
    ) {
      setError('Todos los campos son obligatorios');
      return;
    }
    setCargando(true);
    try {
      const payload: CrearEstudianteDto = {
        tipoDocumento: tipoDocumentoNuevo.trim(),
        numeroDocumento: numeroDocumentoNuevo.trim(),
        nombres: nombresNuevo.trim(),
        apellidos: apellidosNuevo.trim(),
        consentimientoDatos: { aceptado: consentimientoNuevo, medio: 'web' },
      };
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/academic/students', { body: payload });
      if (apiError || response?.status !== 201) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al crear el estudiante');
        return;
      }
      const dto = data;
      setExito(`Estudiante "${dto.nombres} ${dto.apellidos}" creado correctamente`);
      setTipoDocumentoNuevo('');
      setNumeroDocumentoNuevo('');
      setNombresNuevo('');
      setApellidosNuevo('');
      setConsentimientoNuevo(false);
      setAbiertoDialogo(false);
      await cargarEstudiantes();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear estudiante');
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
        <Typography variant="h1">Administración de Estudiantes</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAbiertoDialogo(true)}>
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
        <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
          Listado de estudiantes
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Documento</TableCell>
                <TableCell>Nombres</TableCell>
                <TableCell>Apellidos</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {estudiantes.map((e) => (
                <TableRow key={e.id}>
                  <TableCell sx={{ fontWeight: 'medium' }}>{e.tipoDocumento}</TableCell>
                  <TableCell>{e.nombres}</TableCell>
                  <TableCell>{e.apellidos}</TableCell>
                  <TableCell>
                    <Chip
                      label={e.consentimientoAceptado ? 'Activo' : 'Sin consentimiento'}
                      size="small"
                      color={e.consentimientoAceptado ? 'success' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {estudiantes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>No hay estudiantes registrados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={abiertoDialogo} onClose={() => setAbiertoDialogo(false)} maxWidth="sm">
        <DialogTitle>Crear estudiante</DialogTitle>
        <DialogContent>
          <DialogContentText>Registra un nuevo estudiante en el sistema.</DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="tipo-documento"
            label="Tipo de documento (ej. CC)"
            type="text"
            fullWidth
            value={tipoDocumentoNuevo}
            onChange={(e) => setTipoDocumentoNuevo(e.target.value)}
          />
          <TextField
            margin="dense"
            id="numero-documento"
            label="Número de documento"
            type="text"
            fullWidth
            value={numeroDocumentoNuevo}
            onChange={(e) => setNumeroDocumentoNuevo(e.target.value)}
          />
          <TextField
            margin="dense"
            id="nombres-estudiante"
            label="Nombres"
            type="text"
            fullWidth
            value={nombresNuevo}
            onChange={(e) => setNombresNuevo(e.target.value)}
          />
          <TextField
            margin="dense"
            id="apellidos-estudiante"
            label="Apellidos"
            type="text"
            fullWidth
            value={apellidosNuevo}
            onChange={(e) => setApellidosNuevo(e.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={consentimientoNuevo}
                onChange={() => setConsentimientoNuevo(!consentimientoNuevo)}
              />
            }
            label="Acepto el tratamiento de datos personales"
            labelPlacement="end"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbiertoDialogo(false)}>Cancelar</Button>
          <Button
            onClick={manejarCrear}
            disabled={
              cargando ||
              !tipoDocumentoNuevo.trim() ||
              !numeroDocumentoNuevo.trim() ||
              !nombresNuevo.trim() ||
              !apellidosNuevo.trim()
            }
          >
            {cargando ? <CircularProgress size={20} /> : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
