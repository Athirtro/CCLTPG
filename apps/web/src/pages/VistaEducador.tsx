import { useState } from 'react';
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
  Shield as ShieldIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';

type SesionEducadorView = {
  id: string;
  grupoNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  salon: string;
  estado: 'programada' | 'realizada' | 'cancelada';
};

type MatriculaGrupoView = {
  id: string;
  estudianteNombre: string;
  presente: boolean;
};

export default function VistaEducador() {
  const { hasPermission } = useAuth();
  const [sesiones] = useState<SesionEducadorView[]>([
    {
      id: 'S-001',
      grupoNombre: 'Guitarra Básica (G-001)',
      fecha: '2026-11-20',
      horaInicio: '18:00',
      horaFin: '19:30',
      salon: 'Salón A',
      estado: 'programada',
    },
    {
      id: 'S-002',
      grupoNombre: 'Acuarela (G-002)',
      fecha: '2026-11-21',
      horaInicio: '16:00',
      horaFin: '17:30',
      salon: 'Salón B',
      estado: 'programada',
    },
  ]);
  const [sesionSeleccionada, setSesionSeleccionada] = useState<SesionEducadorView | null>(null);
  const [matriculas, setMatriculas] = useState<MatriculaGrupoView[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [abiertoDialogoEvaluacion, setAbiertoDialogoEvaluacion] = useState(false);
  const [indicadorNuevo, setIndicadorNuevo] = useState('');
  const [periodoNuevo, setPeriodoNuevo] = useState('');
  const [valorNuevo, setValorNuevo] = useState('');
  const [estudianteEvalNuevo, setEstudianteEvalNuevo] = useState('');

  const puedeTomarAsistencia = hasPermission('academic:attendance:create');
  const puedeCrearEvaluacion = hasPermission('academic:evaluation:create');

  // Nota: cargarSesiones se implementará cuando el Rol B exponga GET /academic/sessions
  // Por ahora se usa mock data estática.

  const seleccionarSesion = (sesion: SesionEducadorView) => {
    setSesionSeleccionada(sesion);
    setMatriculas([
      { id: 'M-001', estudianteNombre: 'Ana García', presente: false },
      { id: 'M-002', estudianteNombre: 'Luis Pérez', presente: false },
      { id: 'M-003', estudianteNombre: 'María López', presente: false },
    ]);
  };

  const manejarTomarAsistencia = async () => {
    if (!sesionSeleccionada) return;
    setCargando(true);
    setError(null);
    try {
      const registros = matriculas.map((m) => ({
        matriculaId: m.id,
        presente: m.presente,
      }));
      const { error: apiError, response } = await (
        await apiClient.PUT(
          `/academic/sessions/${sesionSeleccionada.id}/attendance` as any,
          {
            params: { path: { id: sesionSeleccionada.id } },
            body: { registros },
          }
        )
      ) as any;
      if (apiError || response?.status !== 200) {
        const problema = apiError as { detail?: string };
        setError(problema?.detail || 'Error al registrar asistencia');
        return;
      }
      setExito(`Asistencia registrada: ${registros.length} estudiantes`);
      setSesionSeleccionada(null);
      setMatriculas([]);
    } catch (err: any) {
      setError(err.message || 'Error al registrar asistencia');
    } finally {
      setCargando(false);
    }
  };

  const manejarCrearEvaluacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!indicadorNuevo.trim() || !periodoNuevo.trim() || !valorNuevo.trim() || !estudianteEvalNuevo.trim()) {
      setError('Todos los campos son obligatorios');
      return;
    }
    setCargando(true);
    try {
      const { error: apiError, response } = await (
        await apiClient.POST('/academic/evaluations', {
          body: {
            estudianteId: estudianteEvalNuevo,
            grupoId: sesionSeleccionada?.id ?? '',
            indicador: indicadorNuevo.trim(),
            periodo: periodoNuevo.trim(),
            valor: parseFloat(valorNuevo),
          },
        })
      ) as any;
      if (apiError || response?.status !== 201) {
        const problema = apiError as { detail?: string };
        setError(problema?.detail || 'Error al crear la evaluación');
        return;
      }
      setExito('Evaluación creada correctamente');
      setIndicadorNuevo('');
      setPeriodoNuevo('');
      setValorNuevo('');
      setEstudianteEvalNuevo('');
      setAbiertoDialogoEvaluacion(false);
    } catch (err: any) {
      setError(err.message || 'Error inesperado al crear evaluación');
    } finally {
      setCargando(false);
    }
  };

  if (!puedeTomarAsistencia && !puedeCrearEvaluacion) {
    return (
      <Box sx={{ p: 3, minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ShieldIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Vista del educador</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para gestionar asistencia o evaluaciones.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Vista del educador</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Gestiona la asistencia y las evaluaciones cualitativa de tus grupos.
      </Typography>

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

      {puedeTomarAsistencia && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Tomar asistencia
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Sesiones programadas
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {sesiones.map((s) => (
                <Chip
                  key={s.id}
                  label={`${s.grupoNombre} — ${s.fecha} ${s.horaInicio}`}
                  onClick={() => void seleccionarSesion(s)}
                  color="primary"
                  variant="outlined"
                  clickable
                  sx={{ cursor: 'pointer' }}
                />
              ))}
              {sesiones.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No hay sesiones programadas.
                </Typography>
              )}
            </Box>
          </Box>

          {sesionSeleccionada && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Asistencia — {sesionSeleccionada.grupoNombre}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                {sesionSeleccionada.fecha} · {sesionSeleccionada.horaInicio} - {sesionSeleccionada.horaFin} · {sesionSeleccionada.salon}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Estudiante</TableCell>
                      <TableCell>Presente</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {matriculas.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell sx={{ fontWeight: 'medium' }}>{m.estudianteNombre}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant={m.presente ? 'contained' : 'outlined'}
                              color="success"
                              onClick={() =>
                                setMatriculas(
                                  matriculas.map((x) =>
                                    x.id === m.id ? { ...x, presente: true } : x
                                  )
                                )
                              }
                            >
                              Sí
                            </Button>
                            <Button
                              size="small"
                              variant={!m.presente ? 'contained' : 'outlined'}
                              color="error"
                              onClick={() =>
                                setMatriculas(
                                  matriculas.map((x) =>
                                    x.id === m.id ? { ...x, presente: false } : x
                                  )
                                )
                              }
                            >
                              No
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button
                variant="contained"
                startIcon={<CheckCircleIcon />}
                disabled={cargando}
                onClick={manejarTomarAsistencia}
                sx={{ mt: 2 }}
              >
                {cargando ? <CircularProgress size={20} /> : 'Registrar asistencia'}
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {puedeCrearEvaluacion && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Crear evaluación cualitativa
          </Typography>
          <Dialog
            open={abiertoDialogoEvaluacion}
            onClose={() => setAbiertoDialogoEvaluacion(false)}
            maxWidth="sm"
          >
            <DialogTitle>Nueva evaluación</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Registra una evaluación para un estudiante de tu grupo.
              </DialogContentText>
              <form noValidate>
                <TextField
                  autoFocus
                  margin="dense"
                  id="indicador-eval"
                  label="Indicador (ej. Participación)"
                  type="text"
                  fullWidth
                  value={indicadorNuevo}
                  onChange={(e) => setIndicadorNuevo(e.target.value)}
                />
                <TextField
                  margin="dense"
                  id="periodo-eval"
                  label="Periodo (ej. Noviembre 2026)"
                  type="text"
                  fullWidth
                  value={periodoNuevo}
                  onChange={(e) => setPeriodoNuevo(e.target.value)}
                />
                <FormControl margin="dense" fullWidth>
                  <InputLabel id="label-estudiante-eval">Estudiante</InputLabel>
                  <Select
                    labelId="label-estudiante-eval"
                    id="select-estudiante-eval"
                    label="Estudiante"
                    value={estudianteEvalNuevo}
                    onChange={(e) => setEstudianteEvalNuevo(e.target.value)}
                  >
                    {matriculas.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.estudianteNombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  margin="dense"
                  id="valor-eval"
                  label="Valor (0-5)"
                  type="number"
                  fullWidth
                  value={valorNuevo}
                  onChange={(e) => setValorNuevo(e.target.value)}
                />
              </form>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAbiertoDialogoEvaluacion(false)}>
                Cancelar
              </Button>
              <Button
                onClick={manejarCrearEvaluacion}
                disabled={
                  cargando ||
                  !indicadorNuevo.trim() ||
                  !periodoNuevo.trim() ||
                  !valorNuevo.trim() ||
                  !estudianteEvalNuevo.trim()
                }
              >
                {cargando ? <CircularProgress size={20} /> : 'Guardar'}
              </Button>
            </DialogActions>
          </Dialog>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={() => setAbiertoDialogoEvaluacion(true)}
          >
            Nueva evaluación
          </Button>
        </Paper>
      )}
    </Box>
  );
}
