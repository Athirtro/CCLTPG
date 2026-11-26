import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type {
  CrearEvaluacionDto,
  GrupoDto,
  MatriculaDto,
  RegistroAsistenciaDto,
  SesionDto,
} from '../api/client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

type EstadoAsistencia = 'presente' | 'ausente' | 'tarde' | 'excusa';
type ValorEvaluacion = 'excelente' | 'bueno' | 'regular' | 'deficiente';
type CampoEvaluacion = 'matriculaId' | 'indicadorId' | 'periodo' | 'valor' | 'observacion';

type RegistroAsistenciaView = {
  matriculaId: string;
  estudianteNombre: string;
  estado: EstadoAsistencia;
};

const ESTADO_ASISTENCIA: Array<{ valor: EstadoAsistencia; label: string }> = [
  { valor: 'presente', label: 'Presente' },
  { valor: 'ausente', label: 'Ausente' },
  { valor: 'tarde', label: 'Tarde' },
  { valor: 'excusa', label: 'Excusa' },
];

const ESTADOS_ASISTENCIA_VALIDOS: EstadoAsistencia[] = ['presente', 'ausente', 'tarde', 'excusa'];

const VALOR_EVALUACION: Array<{ valor: ValorEvaluacion; label: string }> = [
  { valor: 'excelente', label: 'Excelente' },
  { valor: 'bueno', label: 'Bueno' },
  { valor: 'regular', label: 'Regular' },
  { valor: 'deficiente', label: 'Deficiente' },
];

const VALORES_EVALUACION_VALIDOS: ValorEvaluacion[] = [
  'excelente',
  'bueno',
  'regular',
  'deficiente',
];

const BREADCRUMBS = [
  { label: 'Inicio', to: '/' },
  { label: 'Gestión académica' },
  { label: 'Vista educador' },
];

const DESCRIPCION =
  'Selecciona un grupo y una sesión para registrar la asistencia y crear evaluaciones cualitativas.';

export default function VistaEducador() {
  const { hasPermission } = useAuth();
  const [grupos, setGrupos] = useState<GrupoDto[]>([]);
  const [sesiones, setSesiones] = useState<SesionDto[]>([]);
  const [matriculasDelGrupo, setMatriculasDelGrupo] = useState<MatriculaDto[]>([]);
  const [registrosAsistencia, setRegistrosAsistencia] = useState<RegistroAsistenciaView[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('');
  const [sesionSeleccionada, setSesionSeleccionada] = useState<SesionDto | null>(null);
  const [cargandoGrupos, setCargandoGrupos] = useState(false);
  const [cargandoSesiones, setCargandoSesiones] = useState(false);
  const [cargandoMatriculas, setCargandoMatriculas] = useState(false);
  const [cargandoAsistencia, setCargandoAsistencia] = useState(false);
  const [enviandoAsistencia, setEnviandoAsistencia] = useState(false);
  const [enviandoEvaluacion, setEnviandoEvaluacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [abiertoDialogoEvaluacion, setAbiertoDialogoEvaluacion] = useState(false);
  const [matriculaIdEval, setMatriculaIdEval] = useState('');
  const [indicadorIdEval, setIndicadorIdEval] = useState('');
  const [periodoEval, setPeriodoEval] = useState('');
  const [valorEval, setValorEval] = useState('bueno');
  const [observacionEval, setObservacionEval] = useState('');
  const [erroresEvaluacion, setErroresEvaluacion] = useState<
    Partial<Record<CampoEvaluacion, string>>
  >({});

  const puedeTomarAsistencia = hasPermission('academic:attendance:create');
  const puedeCrearEvaluacion = hasPermission('academic:evaluation:create');

  const cargarGrupos = useCallback(async () => {
    if (!puedeTomarAsistencia && !puedeCrearEvaluacion) return;
    setCargandoGrupos(true);
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
      setCargandoGrupos(false);
    }
  }, [puedeTomarAsistencia, puedeCrearEvaluacion]);

  const cargarSesiones = useCallback(async (grupoId: string) => {
    if (!grupoId) return;
    setCargandoSesiones(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/academic/groups/{groupId}/sessions', {
        params: { path: { groupId: grupoId } },
      });
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
  }, []);

  const cargarMatriculasDelGrupo = useCallback(async (grupoId: string) => {
    if (!grupoId) return;
    setCargandoMatriculas(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/academic/enrollments');
      if (apiError || !data) {
        setError('No se pudieron cargar las matrículas del grupo');
        return;
      }
      setMatriculasDelGrupo(data.data.filter((m) => m.grupoId === grupoId));
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar matrículas del grupo');
    } finally {
      setCargandoMatriculas(false);
    }
  }, []);

  const cargarAsistencia = useCallback(async (sesionId: string, matriculas: MatriculaDto[]) => {
    if (!sesionId) return;
    setCargandoAsistencia(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET(
        '/academic/sessions/{sessionId}/attendance',
        { params: { path: { sessionId: sesionId } } },
      );
      if (apiError || !data) {
        setError('No se pudo cargar la asistencia');
        return;
      }
      setRegistrosAsistencia(
        data.registros.map((r) => {
          const matricula = matriculas.find((m) => m.id === r.matriculaId);
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
      setCargandoAsistencia(false);
    }
  }, []);

  const seleccionarGrupo = (grupoId: string) => {
    setGrupoSeleccionado(grupoId);
    setSesionSeleccionada(null);
    setRegistrosAsistencia([]);
    setMatriculasDelGrupo([]);
    setSesiones([]);
    void cargarSesiones(grupoId);
    void cargarMatriculasDelGrupo(grupoId);
  };

  const seleccionarSesion = (sesion: SesionDto) => {
    setSesionSeleccionada(sesion);
    void cargarAsistencia(sesion.id, matriculasDelGrupo);
  };

  const actualizarEstadoAsistencia = (matriculaId: string, estado: EstadoAsistencia) => {
    setRegistrosAsistencia((registros) =>
      registros.map((registro) =>
        registro.matriculaId === matriculaId ? { ...registro, estado } : registro,
      ),
    );
  };

  const manejarTomarAsistencia = async () => {
    if (!sesionSeleccionada) return;
    setEnviandoAsistencia(true);
    setError(null);
    setExito(null);
    try {
      const estadosInvalidos = registrosAsistencia.filter(
        (r) => !ESTADOS_ASISTENCIA_VALIDOS.includes(r.estado),
      );
      if (estadosInvalidos.length > 0) {
        setError('Algunos estados de asistencia no son válidos');
        return;
      }
      const registros: RegistroAsistenciaDto[] = registrosAsistencia.map((r) => ({
        matriculaId: r.matriculaId,
        estado: r.estado,
      }));
      const { error: apiError, response } = await apiClient.PUT(
        '/academic/sessions/{sessionId}/attendance',
        {
          params: { path: { sessionId: sesionSeleccionada.id } },
          body: { registros },
        },
      );
      if (apiError || response?.status !== 200) {
        const problema = apiError;
        setError(problema?.detail || 'Error al registrar asistencia');
        return;
      }
      setExito(`Asistencia registrada: ${registros.length} estudiantes`);
      setSesionSeleccionada(null);
      setRegistrosAsistencia([]);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al registrar asistencia');
    } finally {
      setEnviandoAsistencia(false);
    }
  };

  const actualizarCampoEvaluacion = (campo: CampoEvaluacion, valor: string) => {
    if (campo === 'matriculaId') setMatriculaIdEval(valor);
    if (campo === 'indicadorId') setIndicadorIdEval(valor);
    if (campo === 'periodo') setPeriodoEval(valor);
    if (campo === 'valor') setValorEval(valor);
    if (campo === 'observacion') setObservacionEval(valor);
    setErroresEvaluacion((previos) => ({ ...previos, [campo]: undefined }));
  };

  const validarEvaluacion = (): boolean => {
    const nuevosErrores: Partial<Record<CampoEvaluacion, string>> = {};
    if (!matriculaIdEval.trim())
      nuevosErrores.matriculaId = 'Selecciona al estudiante o indica el ID de su matrícula.';
    if (!indicadorIdEval.trim()) nuevosErrores.indicadorId = 'Ingresa el ID del indicador.';
    if (!periodoEval.trim()) nuevosErrores.periodo = 'Ingresa el periodo.';
    setErroresEvaluacion(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const cerrarDialogoEvaluacion = () => {
    if (enviandoEvaluacion) return;
    setAbiertoDialogoEvaluacion(false);
    setMatriculaIdEval('');
    setIndicadorIdEval('');
    setPeriodoEval('');
    setValorEval('bueno');
    setObservacionEval('');
    setErroresEvaluacion({});
  };

  const manejarCrearEvaluacion = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!validarEvaluacion()) return;
    setEnviandoEvaluacion(true);
    setError(null);
    setExito(null);
    try {
      const valorValido = VALORES_EVALUACION_VALIDOS.find((valor) => valor === valorEval);
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
        const problema = apiError;
        setError(problema?.detail || 'Error al crear la evaluación');
        return;
      }
      setExito('Evaluación creada correctamente');
      cerrarDialogoEvaluacion();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear evaluación');
    } finally {
      setEnviandoEvaluacion(false);
    }
  };

  useEffect(() => {
    void cargarGrupos();
  }, [cargarGrupos]);

  const conteosAsistencia = useMemo(
    () =>
      ESTADO_ASISTENCIA.map(({ valor, label }) => ({
        valor,
        label,
        total: registrosAsistencia.filter((registro) => registro.estado === valor).length,
      })),
    [registrosAsistencia],
  );

  const columnasAsistencia: DataTableColumn<RegistroAsistenciaView>[] = [
    {
      id: 'estudiante',
      label: 'Estudiante',
      minWidth: 200,
      render: (registro) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {registro.estudianteNombre}
        </Typography>
      ),
    },
    {
      id: 'matricula',
      label: 'Matrícula',
      minWidth: 160,
      render: (registro) => (
        <Typography variant="caption" color="text.secondary">
          {registro.matriculaId}
        </Typography>
      ),
    },
    {
      id: 'estado',
      label: 'Estado registrado',
      minWidth: 140,
      render: (registro) => <StatusChip status={registro.estado} />,
    },
    {
      id: 'registrar',
      label: 'Registrar estado',
      minWidth: 360,
      render: (registro) => (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={registro.estado}
          aria-label={`Estado de asistencia de ${registro.estudianteNombre}`}
          onChange={(_event, nuevo: EstadoAsistencia | null) => {
            if (nuevo) actualizarEstadoAsistencia(registro.matriculaId, nuevo);
          }}
          sx={{ flexWrap: 'wrap', gap: 0.5 }}
        >
          {ESTADO_ASISTENCIA.map((opcion) => (
            <ToggleButton
              key={opcion.valor}
              value={opcion.valor}
              aria-label={`${opcion.label} para ${registro.estudianteNombre}`}
              aria-pressed={registro.estado === opcion.valor}
              sx={{ px: 1, py: 0.5 }}
            >
              {opcion.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      ),
    },
  ];

  if (!puedeTomarAsistencia && !puedeCrearEvaluacion) {
    return (
      <Box>
        <PageHeader
          title="Vista del educador"
          description={DESCRIPCION}
          icon={<ShieldIcon />}
          breadcrumbs={BREADCRUMBS}
        />
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para gestionar asistencia ni evaluaciones."
          icon={<ShieldIcon />}
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Vista del educador"
        description={DESCRIPCION}
        icon={<ShieldIcon />}
        breadcrumbs={BREADCRUMBS}
        actions={
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void cargarGrupos()}
            disabled={cargandoGrupos}
          >
            {cargandoGrupos ? 'Actualizando…' : 'Actualizar grupos'}
          </Button>
        }
      />

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
        <>
          <SectionCard
            title="1. Selecciona un grupo"
            subtitle="Elige el grupo con el que vas a trabajar."
            sx={{ mb: 2 }}
          >
            {error && grupos.length === 0 ? (
              <ErrorState message={error} onRetry={() => void cargarGrupos()} minHeight={160} />
            ) : cargandoGrupos && grupos.length === 0 ? (
              <LoadingState label="Cargando grupos…" minHeight={160} />
            ) : grupos.length === 0 ? (
              <EmptyState
                title="Sin grupos disponibles"
                description="Cuando tengas grupos asignados aparecerán aquí."
                minHeight={160}
              />
            ) : (
              <ToggleButtonGroup
                exclusive
                value={grupoSeleccionado}
                aria-label="Seleccionar grupo"
                onChange={(_event, grupoId: string | null) => {
                  if (grupoId) seleccionarGrupo(grupoId);
                }}
                sx={{ flexWrap: 'wrap', gap: 1 }}
              >
                {grupos.map((grupo) => (
                  <ToggleButton
                    key={grupo.id}
                    value={grupo.id}
                    aria-label={`Grupo ${grupo.codigo}, periodo ${grupo.periodo}`}
                    aria-pressed={grupoSeleccionado === grupo.id}
                    sx={{ px: 1.5, py: 1 }}
                  >
                    <Stack spacing={0.5} sx={{ textAlign: 'left' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {grupo.codigo}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {grupo.periodo}
                      </Typography>
                    </Stack>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          </SectionCard>

          {grupoSeleccionado && (
            <SectionCard
              title="2. Selecciona una sesión"
              subtitle="Elige la sesión cuya asistencia vas a registrar."
              sx={{ mb: 2 }}
            >
              {error && sesiones.length === 0 ? (
                <ErrorState
                  message={error}
                  onRetry={() => void cargarSesiones(grupoSeleccionado)}
                  minHeight={160}
                />
              ) : (cargandoSesiones || cargandoMatriculas) && sesiones.length === 0 ? (
                <LoadingState label="Cargando sesiones del grupo…" minHeight={160} />
              ) : sesiones.length === 0 ? (
                <EmptyState
                  title="Sin sesiones programadas"
                  description="Este grupo no tiene sesiones disponibles."
                  minHeight={160}
                />
              ) : (
                <ToggleButtonGroup
                  exclusive
                  value={sesionSeleccionada?.id ?? ''}
                  aria-label="Seleccionar sesión"
                  onChange={(_event, sesionId: string | null) => {
                    const sesion = sesiones.find((s) => s.id === sesionId);
                    if (sesion) seleccionarSesion(sesion);
                  }}
                  sx={{ flexWrap: 'wrap', gap: 1 }}
                >
                  {sesiones.map((sesion) => (
                    <ToggleButton
                      key={sesion.id}
                      value={sesion.id}
                      aria-label={`Sesión del ${sesion.fecha}, estado ${sesion.estado}`}
                      aria-pressed={sesionSeleccionada?.id === sesion.id}
                      sx={{ px: 1.5, py: 1 }}
                    >
                      <Stack spacing={0.5} sx={{ textAlign: 'left' }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {sesion.fecha}
                          </Typography>
                          <StatusChip status={sesion.estado} />
                        </Stack>
                        {sesion.tema && (
                          <Typography variant="caption" color="text.secondary">
                            {sesion.tema}
                          </Typography>
                        )}
                      </Stack>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              )}
            </SectionCard>
          )}

          {sesionSeleccionada && (
            <>
              <SectionCard
                title="3. Estudiantes de la sesión"
                subtitle={`Sesión del ${sesionSeleccionada.fecha} · grupo ${sesionSeleccionada.grupoId}`}
                sx={{ mb: 2 }}
              >
                {error && registrosAsistencia.length === 0 ? (
                  <ErrorState
                    message={error}
                    onRetry={() => void cargarAsistencia(sesionSeleccionada.id, matriculasDelGrupo)}
                    minHeight={160}
                  />
                ) : cargandoAsistencia && registrosAsistencia.length === 0 ? (
                  <LoadingState label="Cargando asistencia…" minHeight={160} />
                ) : registrosAsistencia.length === 0 ? (
                  <EmptyState
                    title="Sin estudiantes registrados"
                    description="No hay registros de asistencia para esta sesión."
                    minHeight={160}
                  />
                ) : (
                  <DataTable
                    ariaLabel="Estudiantes de la sesión"
                    columns={columnasAsistencia}
                    rows={registrosAsistencia}
                    rowKey={(registro) => registro.matriculaId}
                    loading={cargandoAsistencia}
                    emptyMessage="No hay estudiantes para mostrar."
                  />
                )}
              </SectionCard>

              {registrosAsistencia.length > 0 && (
                <SectionCard
                  title="4. Registrar asistencia"
                  subtitle="Revisa los estados seleccionados y guarda el registro de la sesión."
                  sx={{ mb: 2 }}
                >
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    {conteosAsistencia.map((conteo) => (
                      <StatusChip
                        key={conteo.valor}
                        status={conteo.valor}
                        label={`${conteo.label}: ${conteo.total}`}
                      />
                    ))}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Cambia el estado de cada estudiante en la tabla anterior y guarda los cambios.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => void manejarTomarAsistencia()}
                    disabled={enviandoAsistencia || cargandoAsistencia}
                  >
                    {enviandoAsistencia ? 'Guardando…' : 'Guardar asistencia'}
                  </Button>
                </SectionCard>
              )}
            </>
          )}
        </>
      )}

      {puedeCrearEvaluacion && (
        <SectionCard
          title="Evaluaciones"
          subtitle="Registra una valoración cualitativa para un estudiante."
          action={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAbiertoDialogoEvaluacion(true)}
            >
              Nueva evaluación
            </Button>
          }
        >
          <Typography variant="body2" color="text.secondary">
            Indica el estudiante, el indicador, el periodo y la valoración observada.
          </Typography>
        </SectionCard>
      )}

      {puedeCrearEvaluacion && (
        <Dialog
          open={abiertoDialogoEvaluacion}
          onClose={cerrarDialogoEvaluacion}
          maxWidth="sm"
          fullWidth
          aria-labelledby="titulo-nueva-evaluacion"
        >
          <DialogTitle id="titulo-nueva-evaluacion">Nueva evaluación</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h3" sx={{ mt: 1 }}>
              Datos de la evaluación
            </Typography>
            <Box
              component="form"
              id="formulario-evaluacion"
              noValidate
              onSubmit={(evento) => void manejarCrearEvaluacion(evento)}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              {matriculasDelGrupo.length > 0 ? (
                <FormControl fullWidth error={Boolean(erroresEvaluacion.matriculaId)}>
                  <InputLabel id="evaluacion-matricula-label">Estudiante</InputLabel>
                  <Select
                    labelId="evaluacion-matricula-label"
                    label="Estudiante"
                    value={matriculaIdEval}
                    onChange={(evento) =>
                      actualizarCampoEvaluacion('matriculaId', evento.target.value)
                    }
                  >
                    <MenuItem value="">Selecciona un estudiante</MenuItem>
                    {matriculasDelGrupo.map((matricula) => (
                      <MenuItem key={matricula.id} value={matricula.id}>
                        {`${matricula.estudianteNombres} ${matricula.estudianteApellidos} · ${matricula.grupoCodigo}`}
                      </MenuItem>
                    ))}
                  </Select>
                  {erroresEvaluacion.matriculaId && (
                    <FormHelperText>{erroresEvaluacion.matriculaId}</FormHelperText>
                  )}
                </FormControl>
              ) : (
                <TextField
                  id="matricula-id-eval"
                  label="Estudiante (ID de matrícula)"
                  helperText={
                    erroresEvaluacion.matriculaId ?? 'Identificador de la matrícula del estudiante.'
                  }
                  error={Boolean(erroresEvaluacion.matriculaId)}
                  value={matriculaIdEval}
                  onChange={(evento) =>
                    actualizarCampoEvaluacion('matriculaId', evento.target.value)
                  }
                  required
                  fullWidth
                />
              )}
              <TextField
                id="indicador-id-eval"
                label="Indicador (ID)"
                helperText={
                  erroresEvaluacion.indicadorId ?? 'Identificador del indicador evaluado.'
                }
                error={Boolean(erroresEvaluacion.indicadorId)}
                value={indicadorIdEval}
                onChange={(evento) => actualizarCampoEvaluacion('indicadorId', evento.target.value)}
                required
                fullWidth
              />
              <TextField
                id="periodo-eval"
                label="Periodo (ej. 2026-1)"
                helperText={erroresEvaluacion.periodo}
                error={Boolean(erroresEvaluacion.periodo)}
                value={periodoEval}
                onChange={(evento) => actualizarCampoEvaluacion('periodo', evento.target.value)}
                required
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="label-valor-eval">Valoración</InputLabel>
                <Select
                  labelId="label-valor-eval"
                  id="select-valor-eval"
                  label="Valoración"
                  value={valorEval}
                  onChange={(evento) => actualizarCampoEvaluacion('valor', evento.target.value)}
                >
                  {VALOR_EVALUACION.map((opcion) => (
                    <MenuItem key={opcion.valor} value={opcion.valor}>
                      {opcion.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                id="observacion-eval"
                label="Observación (opcional)"
                value={observacionEval}
                onChange={(evento) => actualizarCampoEvaluacion('observacion', evento.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={cerrarDialogoEvaluacion} disabled={enviandoEvaluacion}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="formulario-evaluacion"
              variant="contained"
              disabled={enviandoEvaluacion}
            >
              {enviandoEvaluacion ? 'Guardando…' : 'Guardar evaluación'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
