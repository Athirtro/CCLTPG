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
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type {
  GrupoDto,
  SesionDto,
  RegistroAsistenciaDto,
  CrearEvaluacionDto,
  MatriculaDto,
  ProblemDetailsDto,
} from '../api/client';

type RegistroAsistenciaView = {
  matriculaId: string;
  estudianteNombre: string;
  estado: string;
};

const ESTADO_ASISTENCIA: Array<{ valor: 'presente' | 'ausente' | 'tarde' | 'excusa'; label: string }> = [
  { valor: 'presente', label: 'Presente' },
  { valor: 'ausente', label: 'Ausente' },
  { valor: 'tarde', label: 'Tarde' },
  { valor: 'excusa', label: 'Excusa' },
];

const VALOR_EVALUACION: Array<{ valor: 'excelente' | 'bueno' | 'regular' | 'deficiente'; label: string }> = [
  { valor: 'excelente', label: 'Excelente' },
  { valor: 'bueno', label: 'Bueno' },
  { valor: 'regular', label: 'Regular' },
  { valor: 'deficiente', label: 'Deficiente' },
];

export default function VistaEducador() {
  const { hasPermission } = useAuth();
  const [grupos, setGrupos] = useState<GrupoDto[]>([]);
  const [sesiones, setSesiones] = useState<SesionDto[]>([]);
  const [matriculasDelGrupo, setMatriculasDelGrupo] = useState<MatriculaDto[]>([]);
  const [registrosAsistencia, setRegistrosAsistencia] = useState<RegistroAsistenciaView[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string>('');
  const [sesionSeleccionada, setSesionSeleccionada] = useState<SesionDto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoSesiones, setCargandoSesiones] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [abiertoDialogoEvaluacion, setAbiertoDialogoEvaluacion] = useState(false);
  const [matriculaIdEval, setMatriculaIdEval] = useState('');
  const [indicadorIdEval, setIndicadorIdEval] = useState('');
  const [periodoEval, setPeriodoEval] = useState('');
  const [valorEval, setValorEval] = useState<string>('bueno');
  const [observacionEval, setObservacionEval] = useState('');

  const puedeTomarAsistencia = hasPermission('academic:attendance:create');
  const puedeCrearEvaluacion = hasPermission('academic:evaluation:create');

  const cargarGrupos = useCallback(async () => {
    if (!puedeTomarAsistencia && !puedeCrearEvaluacion) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/academic/groups');
      if (apiError || !data) {
        setError('No se pudieron cargar los grupos');
        return;
      }
      setGrupos(data.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar grupos');
    } finally {
      setCargando(false);
    }
  }, [puedeTomarAsistencia, puedeCrearEvaluacion]);

  const cargarSesiones = useCallback(async () => {
    if (!grupoSeleccionado) return;
    setCargandoSesiones(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET(
        '/academic/groups/{groupId}/sessions',
        { params: { path: { groupId: grupoSeleccionado } } },
      );
      if (apiError || !data) {
        setError('No se pudieron cargar las sesiones');
        return;
      }
      setSesiones(data.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar sesiones');
    } finally {
      setCargandoSesiones(false);
    }
  }, [grupoSeleccionado]);

  const cargarMatriculasDelGrupo = useCallback(async () => {
    if (!grupoSeleccionado) return;
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/academic/enrollments');
      if (apiError || !data) {
        setError('No se pudieron cargar las matrículas del grupo');
        return;
      }
      setMatriculasDelGrupo(
        data.data.filter((m) => m.grupoId === grupoSeleccionado),
      );
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar matrículas del grupo');
    }
  }, [grupoSeleccionado]);

  const cargarAsistencia = useCallback(async () => {
    if (!sesionSeleccionada) return;
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET(
        '/academic/sessions/{sessionId}/attendance',
        { params: { path: { sessionId: sesionSeleccionada.id } } },
      );
      if (apiError || !data) {
        setError('No se pudo cargar la asistencia');
        return;
      }
      setRegistrosAsistencia(
        data.registros.map((r) => {
          const matricula = matriculasDelGrupo.find((m) => m.id === r.matriculaId);
          const nombreCompleto = matricula
            ? `${matricula.estudianteNombres} ${matricula.estudianteApellidos}`
            : r.matriculaId;
          return {
            matriculaId: r.matriculaId,
            estudianteNombre: nombreCompleto,
            estado: r.estado,
          };
        }),
      );
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar asistencia');
    } finally {
      // sin estado de carga dedicado para asistencia
    }
  }, [sesionSeleccionada, matriculasDelGrupo]);

  const seleccionarGrupo = (grupoId: string) => {
    setGrupoSeleccionado(grupoId);
    setSesionSeleccionada(null);
    setRegistrosAsistencia([]);
    setMatriculasDelGrupo([]);
    void cargarSesiones();
    void cargarMatriculasDelGrupo();
  };

  const seleccionarSesion = (sesion: SesionDto) => {
    setSesionSeleccionada(sesion);
    void cargarAsistencia();
  };

  const ESTADOS_ASISTENCIA_VALIDOS: Array<'presente' | 'ausente' | 'tarde' | 'excusa'> = [
    'presente',
    'ausente',
    'tarde',
    'excusa',
  ];

  const manejarTomarAsistencia = async () => {
    if (!sesionSeleccionada) return;
    setCargando(true);
    setError(null);
    try {
      const estadosInvalidos = registrosAsistencia.filter(
        (r) => !ESTADOS_ASISTENCIA_VALIDOS.includes(r.estado as 'presente' | 'ausente' | 'tarde' | 'excusa'),
      );
      if (estadosInvalidos.length > 0) {
        setError('Algunos estados de asistencia no son válidos');
        return;
      }
      const registros: RegistroAsistenciaDto[] = registrosAsistencia.map((r) => ({
        matriculaId: r.matriculaId,
        estado: r.estado as 'presente' | 'ausente' | 'tarde' | 'excusa',
      }));
      const { error: apiError, response } = await apiClient.PUT(
        '/academic/sessions/{sessionId}/attendance',
        {
          params: { path: { sessionId: sesionSeleccionada.id } },
          body: { registros },
        },
      );
      if (apiError || response?.status !== 200) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al registrar asistencia');
        return;
      }
      setExito(`Asistencia registrada: ${registros.length} estudiantes`);
      setSesionSeleccionada(null);
      setRegistrosAsistencia([]);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al registrar asistencia');
    } finally {
      setCargando(false);
    }
  };

  const manejarCrearEvaluacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!matriculaIdEval.trim() || !indicadorIdEval.trim() || !periodoEval.trim()) {
      setError('Todos los campos son obligatorios');
      return;
    }
    setCargando(true);
    try {
      const VALORES_EVALUACION_VALIDOS: Array<'excelente' | 'bueno' | 'regular' | 'deficiente'> = [
        'excelente',
        'bueno',
        'regular',
        'deficiente',
      ];
      const valorValido = VALORES_EVALUACION_VALIDOS.find((v) => v === valorEval);
      if (!valorValido) {
        setError('Valor de evaluación no válido');
        return;
      }
      const payload: CrearEvaluacionDto = {
        matriculaId: matriculaIdEval.trim(),
        indicadorId: indicadorIdEval.trim(),
        periodo: periodoEval.trim(),
        valor: valorValido,
        observacion: observacionEval.trim() || null,
      };
      const { error: apiError, response } = await apiClient.POST('/academic/evaluations', {
        body: payload,
      });
      if (apiError || response?.status !== 201) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al crear la evaluación');
        return;
      }
      setExito('Evaluación creada correctamente');
      setMatriculaIdEval('');
      setIndicadorIdEval('');
      setPeriodoEval('');
      setValorEval('bueno');
      setObservacionEval('');
      setAbiertoDialogoEvaluacion(false);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear evaluación');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarGrupos();
  }, [cargarGrupos]);

  if (!puedeTomarAsistencia && !puedeCrearEvaluacion) {
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h1">Vista del educador</Typography>
        <Button
          startIcon={<RefreshIcon />}
          size="small"
          disabled={cargando}
          onClick={cargarGrupos}
        >
          Actualizar grupos
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

      {puedeTomarAsistencia && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
            Tomar asistencia
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h3" sx={{ mb: 1 }}>
              Seleccionar grupo
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {grupos.map((g) => (
                <Chip
                  key={g.id}
                  label={`${g.codigo} — ${g.periodo}`}
                  onClick={() => void seleccionarGrupo(g.id)}
                  color={grupoSeleccionado === g.id ? 'primary' : 'default'}
                  variant={grupoSeleccionado === g.id ? 'filled' : 'outlined'}
                  clickable
                  sx={{ cursor: 'pointer' }}
                />
              ))}
              {grupos.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No hay grupos disponibles.
                </Typography>
              )}
            </Box>
          </Box>

          {grupoSeleccionado && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h3" sx={{ mb: 1 }}>
                Sesiones del grupo
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {sesiones.map((s) => (
                  <Chip
                    key={s.id}
                    label={`${s.fecha} ${s.estado}`}
                    onClick={() => void seleccionarSesion(s)}
                    color={sesionSeleccionada?.id === s.id ? 'primary' : 'default'}
                    variant={sesionSeleccionada?.id === s.id ? 'filled' : 'outlined'}
                    clickable
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
                {sesiones.length === 0 && cargandoSesiones === false && (
                  <Typography variant="body2" color="text.secondary">
                    No hay sesiones programadas.
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {sesionSeleccionada && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h3" sx={{ mb: 1 }}>
                Asistencia — {sesionSeleccionada.id}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                Grupo: {sesionSeleccionada.grupoId} · Fecha: {sesionSeleccionada.fecha}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Matrícula</TableCell>
                      <TableCell>Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {registrosAsistencia.map((r) => (
                      <TableRow key={r.matriculaId}>
                        <TableCell sx={{ fontWeight: 'medium' }}>{r.matriculaId}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Select
                            value={r.estado}
                            onChange={(e) =>
                              setRegistrosAsistencia(
                                registrosAsistencia.map((x) =>
                                  x.matriculaId === r.matriculaId
                                    ? { ...x, estado: e.target.value }
                                    : x,
                                ),
                              )
                            }
                            displayEmpty
                          >
                            {ESTADO_ASISTENCIA.map((ea) => (
                              <MenuItem key={ea.valor} value={ea.valor}>
                                {ea.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                    {registrosAsistencia.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2}>No hay registros de asistencia para esta sesión.</TableCell>
                      </TableRow>
                    )}
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
          <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
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
                  id="matricula-id-eval"
                  label="ID de matrícula (UUID)"
                  type="text"
                  fullWidth
                  value={matriculaIdEval}
                  onChange={(e) => setMatriculaIdEval(e.target.value)}
                />
                <TextField
                  margin="dense"
                  id="indicador-id-eval"
                  label="ID de indicador (UUID)"
                  type="text"
                  fullWidth
                  value={indicadorIdEval}
                  onChange={(e) => setIndicadorIdEval(e.target.value)}
                />
                <TextField
                  margin="dense"
                  id="periodo-eval"
                  label="Periodo (ej. 2026-1)"
                  type="text"
                  fullWidth
                  value={periodoEval}
                  onChange={(e) => setPeriodoEval(e.target.value)}
                />
                <FormControl margin="dense" fullWidth>
                  <InputLabel id="label-valor-eval">Valor</InputLabel>
                  <Select
                    labelId="label-valor-eval"
                    id="select-valor-eval"
                    label="Valor"
                    value={valorEval}
                    onChange={(e) => setValorEval(e.target.value)}
                  >
                    {VALOR_EVALUACION.map((v) => (
                      <MenuItem key={v.valor} value={v.valor}>
                        {v.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  margin="dense"
                  id="observacion-eval"
                  label="Observación (opcional)"
                  type="text"
                  fullWidth
                  value={observacionEval}
                  onChange={(e) => setObservacionEval(e.target.value)}
                />
              </form>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAbiertoDialogoEvaluacion(false)}>Cancelar</Button>
              <Button
                onClick={manejarCrearEvaluacion}
                disabled={
                  cargando ||
                  !matriculaIdEval.trim() ||
                  !indicadorIdEval.trim() ||
                  !periodoEval.trim()
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
