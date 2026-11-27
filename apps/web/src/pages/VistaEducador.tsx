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
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Shield as ShieldIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type {
  ActualizarEvaluacionDto,
  CrearEvaluacionDto,
  EvaluacionDto,
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

  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDto[]>([]);
  const [cargandoEvaluaciones, setCargandoEvaluaciones] = useState(false);
  const [evaluacionEditando, setEvaluacionEditando] = useState<EvaluacionDto | null>(null);

  const [abiertoDialogoEvaluacion, setAbiertoDialogoEvaluacion] = useState(false);
  const [matriculaIdEval, setMatriculaIdEval] = useState('');
  const [indicadorIdEval, setIndicadorIdEval] = useState('');
  const [periodoEval, setPeriodoEval] = useState('');
  const [valorEval, setValorEval] = useState('bueno');
  const [observacionEval, setObservacionEval] = useState('');
  const [erroresEvaluacion, setErroresEvaluacion] = useState<
    Partial<Record<CampoEvaluacion, string>>
  >({});

  const [abiertoDialogoSesion, setAbiertoDialogoSesion] = useState(false);
  const [fechaSesion, setFechaSesion] = useState('');
  const [temaSesion, setTemaSesion] = useState('');
  const [guardandoSesion, setGuardandoSesion] = useState(false);
  const [detalleSesion, setDetalleSesion] = useState<SesionDto | null>(null);
  const [abiertoDetalleSesion, setAbiertoDetalleSesion] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const puedeVerGrupos =
    hasPermission('academic:group:manage') || hasPermission('academic:group:read_own');
  const puedeVerAsistencia = hasPermission('academic:attendance:read');
  const puedeTomarAsistencia = hasPermission('academic:attendance:create');
  const puedeVerMatriculas = hasPermission('academic:enrollment:read');
  const puedeCrearEvaluacion = hasPermission('academic:evaluation:create');
  const puedeListarEvaluaciones = hasPermission('academic:evaluation:read');
  const puedeActualizarEvaluacion = hasPermission('academic:evaluation:update');
  const puedeCrearSesion = hasPermission('academic:session:create');
  const puedeActualizarSesion = hasPermission('academic:session:update');
  const tieneAcceso =
    puedeVerGrupos ||
    puedeVerAsistencia ||
    puedeTomarAsistencia ||
    puedeCrearEvaluacion ||
    puedeListarEvaluaciones ||
    puedeActualizarEvaluacion ||
    puedeCrearSesion ||
    puedeActualizarSesion;

  const cargarGrupos = useCallback(async () => {
    if (!puedeVerGrupos) return;
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
  }, [puedeVerGrupos]);

  const cargarSesiones = useCallback(
    async (grupoId: string) => {
      if (!grupoId || !puedeVerGrupos) return;
      setCargandoSesiones(true);
      setError(null);
      try {
        const { data, error: apiError } = await apiClient.GET(
          '/academic/groups/{groupId}/sessions',
          {
            params: { path: { groupId: grupoId } },
          },
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
    },
    [puedeVerGrupos],
  );

  const cargarMatriculasDelGrupo = useCallback(
    async (grupoId: string) => {
      if (!grupoId || !puedeVerMatriculas) return;
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
    },
    [puedeVerMatriculas],
  );

  const cargarAsistencia = useCallback(
    async (sesionId: string, matriculas: MatriculaDto[]) => {
      if (!sesionId || !puedeVerAsistencia) return;
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
    },
    [puedeVerAsistencia],
  );

  const cargarEvaluaciones = useCallback(async () => {
    if (!puedeListarEvaluaciones) return;
    setCargandoEvaluaciones(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/academic/evaluations', {
        params: { query: { page: 1, pageSize: 20 } },
      });
      if (apiError || !data) {
        setError('No se pudieron cargar las evaluaciones registradas.');
        return;
      }
      setEvaluaciones(data.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar evaluaciones');
    } finally {
      setCargandoEvaluaciones(false);
    }
  }, [puedeListarEvaluaciones]);

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

  const crearSesion = async () => {
    if (!grupoSeleccionado || !fechaSesion.trim()) return;
    setGuardandoSesion(true);
    setError(null);
    setExito(null);
    try {
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/academic/sessions', {
        body: {
          grupoId: grupoSeleccionado,
          fecha: fechaSesion.trim(),
          tema: temaSesion.trim() || null,
        },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      if (apiError || response?.status !== 201 || !data) {
        setError(apiError?.detail || 'No se pudo crear la sesión.');
        return;
      }
      setExito('Sesión creada correctamente.');
      setAbiertoDialogoSesion(false);
      setFechaSesion('');
      setTemaSesion('');
      await cargarSesiones(grupoSeleccionado);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear la sesión.');
    } finally {
      setGuardandoSesion(false);
    }
  };

  const consultarSesion = async (sesionId: string) => {
    if (!puedeVerGrupos) return;
    setCargandoDetalle(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/academic/sessions/{id}', {
        params: { path: { id: sesionId } },
      });
      if (apiError || !data) {
        setError('No se pudo consultar el detalle de la sesión.');
        return;
      }
      setDetalleSesion(data);
      setAbiertoDetalleSesion(true);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al consultar la sesión');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cambiarEstadoSesion = async (sesionId: string, to: SesionDto['estado']) => {
    setCambiandoEstado(true);
    setError(null);
    setExito(null);
    try {
      const { data, error: apiError } = await apiClient.POST(
        '/academic/sessions/{id}/transitions',
        { params: { path: { id: sesionId } }, body: { to } },
      );
      if (apiError || !data) {
        setError(apiError?.detail || 'No se pudo cambiar el estado de la sesión.');
        return;
      }
      setExito(`Sesión marcada como ${to}.`);
      setDetalleSesion((prev) => (prev?.id === data.id ? data : prev));
      setSesionSeleccionada((prev) => (prev?.id === data.id ? data : prev));
      setSesiones((prev) => prev.map((sesion) => (sesion.id === data.id ? data : sesion)));
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cambiar el estado de la sesión');
    } finally {
      setCambiandoEstado(false);
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

  const validarEvaluacion = (editando: boolean): boolean => {
    const nuevosErrores: Partial<Record<CampoEvaluacion, string>> = {};
    if (!editando) {
      if (!matriculaIdEval.trim())
        nuevosErrores.matriculaId = 'Selecciona al estudiante o indica el ID de su matrícula.';
      if (!indicadorIdEval.trim()) nuevosErrores.indicadorId = 'Ingresa el ID del indicador.';
      if (!periodoEval.trim()) nuevosErrores.periodo = 'Ingresa el periodo.';
    }
    setErroresEvaluacion(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const abrirDialogoEvaluacion = (evaluacion: EvaluacionDto | null = null) => {
    setEvaluacionEditando(evaluacion);
    setMatriculaIdEval(evaluacion?.matriculaId ?? '');
    setIndicadorIdEval(evaluacion?.indicadorId ?? '');
    setPeriodoEval(evaluacion?.periodo ?? '');
    setValorEval(evaluacion?.valor ?? 'bueno');
    setObservacionEval(evaluacion?.observacion ?? '');
    setErroresEvaluacion({});
    setAbiertoDialogoEvaluacion(true);
  };

  const cerrarDialogoEvaluacion = () => {
    if (enviandoEvaluacion) return;
    setAbiertoDialogoEvaluacion(false);
    setEvaluacionEditando(null);
    setMatriculaIdEval('');
    setIndicadorIdEval('');
    setPeriodoEval('');
    setValorEval('bueno');
    setObservacionEval('');
    setErroresEvaluacion({});
  };

  const manejarGuardarEvaluacion = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const editando = evaluacionEditando !== null;
    if (!validarEvaluacion(editando)) return;
    setEnviandoEvaluacion(true);
    setError(null);
    setExito(null);
    try {
      const valorValido = VALORES_EVALUACION_VALIDOS.find((valor) => valor === valorEval);
      if (!valorValido) {
        setError('Valor de evaluación no válido');
        return;
      }
      if (evaluacionEditando) {
        const body: ActualizarEvaluacionDto = {
          valor: valorValido,
          observacion: observacionEval.trim() || null,
        };
        const { error: apiError, response } = await apiClient.PATCH('/academic/evaluations/{id}', {
          params: { path: { id: evaluacionEditando.id } },
          body,
        });
        if (apiError || response?.status !== 200) {
          setError(apiError?.detail || 'Error al corregir la evaluación');
          return;
        }
        setExito('Evaluación corregida correctamente');
      } else {
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
          setError(apiError?.detail || 'Error al crear la evaluación');
          return;
        }
        setExito('Evaluación creada correctamente');
      }
      cerrarDialogoEvaluacion();
      if (puedeListarEvaluaciones) await cargarEvaluaciones();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al guardar la evaluación');
    } finally {
      setEnviandoEvaluacion(false);
    }
  };

  useEffect(() => {
    void cargarGrupos();
  }, [cargarGrupos]);

  useEffect(() => {
    void cargarEvaluaciones();
  }, [cargarEvaluaciones]);

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

  const columnasEvaluacion: DataTableColumn<EvaluacionDto>[] = [
    {
      id: 'matricula',
      label: 'Matrícula',
      minWidth: 160,
      render: (evaluacion) => (
        <Typography variant="caption" color="text.secondary">
          {evaluacion.matriculaId}
        </Typography>
      ),
    },
    {
      id: 'indicador',
      label: 'Indicador',
      minWidth: 180,
      render: (evaluacion) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {evaluacion.indicadorNombre}
        </Typography>
      ),
    },
    {
      id: 'periodo',
      label: 'Periodo',
      minWidth: 100,
      render: (evaluacion) => <Typography variant="body2">{evaluacion.periodo}</Typography>,
    },
    {
      id: 'valor',
      label: 'Valoración',
      minWidth: 120,
      render: (evaluacion) => <StatusChip status={evaluacion.valor} />,
    },
    {
      id: 'evaluadoEn',
      label: 'Registrada',
      minWidth: 170,
      render: (evaluacion) => (
        <Typography variant="caption" color="text.secondary">
          {new Date(evaluacion.evaluadoEn).toLocaleString()}
        </Typography>
      ),
    },
    {
      id: 'acciones',
      label: 'Acciones',
      align: 'right',
      minWidth: 130,
      render: (evaluacion) =>
        puedeActualizarEvaluacion ? (
          <Button
            size="small"
            startIcon={<EditIcon fontSize="small" />}
            onClick={() => abrirDialogoEvaluacion(evaluacion)}
          >
            Corregir
          </Button>
        ) : null,
    },
  ];

  const columnasSesion: DataTableColumn<SesionDto>[] = [
    {
      id: 'fecha',
      label: 'Fecha',
      minWidth: 120,
      render: (sesion) => <Typography variant="body2">{sesion.fecha}</Typography>,
    },
    {
      id: 'tema',
      label: 'Tema',
      minWidth: 180,
      render: (sesion) => (
        <Typography variant="body2" color="text.secondary">
          {sesion.tema ?? '—'}
        </Typography>
      ),
    },
    {
      id: 'estado',
      label: 'Estado',
      minWidth: 120,
      render: (sesion) => <StatusChip status={sesion.estado} />,
    },
    {
      id: 'acciones',
      label: 'Acciones',
      align: 'right',
      minWidth: 220,
      render: (sesion) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          {puedeVerGrupos && (
            <Button
              size="small"
              startIcon={<VisibilityIcon fontSize="small" />}
              onClick={() => void consultarSesion(sesion.id)}
            >
              Detalle
            </Button>
          )}
          {puedeActualizarSesion && sesion.estado !== 'realizada' && (
            <Button
              size="small"
              onClick={() => void cambiarEstadoSesion(sesion.id, 'realizada')}
              disabled={cambiandoEstado}
            >
              Marcar realizada
            </Button>
          )}
        </Box>
      ),
    },
  ];

  if (!tieneAcceso) {
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
          description="No tienes permiso para gestionar sesiones, asistencia ni evaluaciones."
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

      {puedeVerGrupos && (
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

          {grupoSeleccionado && (puedeCrearSesion || puedeActualizarSesion || puedeVerGrupos) && (
            <SectionCard
              title="2. Sesiones del grupo"
              subtitle="Consulta el detalle de cada sesión y gestiona su estado."
              sx={{ mb: 2 }}
              action={
                puedeCrearSesion ? (
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setAbiertoDialogoSesion(true)}
                  >
                    Nueva sesión
                  </Button>
                ) : null
              }
            >
              {error && sesiones.length === 0 ? (
                <ErrorState
                  message={error}
                  onRetry={() => void cargarSesiones(grupoSeleccionado)}
                  minHeight={160}
                />
              ) : (
                <DataTable
                  ariaLabel="Sesiones del grupo"
                  columns={columnasSesion}
                  rows={sesiones}
                  rowKey={(sesion) => sesion.id}
                  loading={cargandoSesiones}
                  emptyMessage="Este grupo no tiene sesiones registradas."
                />
              )}
            </SectionCard>
          )}

          {(puedeVerAsistencia || puedeTomarAsistencia) && grupoSeleccionado && (
            <SectionCard
              title="3. Selecciona una sesión"
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
                title="4. Estudiantes de la sesión"
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

              {registrosAsistencia.length > 0 && puedeTomarAsistencia && (
                <SectionCard
                  title="5. Registrar asistencia"
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

      {(puedeListarEvaluaciones || puedeCrearEvaluacion || puedeActualizarEvaluacion) && (
        <SectionCard
          title="Evaluaciones"
          subtitle="Consulta las valoraciones registradas y corrige las que lo requieran."
          sx={{ mt: 2 }}
          action={
            puedeCrearEvaluacion ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => abrirDialogoEvaluacion()}
              >
                Nueva evaluación
              </Button>
            ) : null
          }
        >
          {error && evaluaciones.length === 0 ? (
            <ErrorState message={error} onRetry={() => void cargarEvaluaciones()} minHeight={160} />
          ) : (
            <DataTable
              ariaLabel="Evaluaciones registradas"
              columns={columnasEvaluacion}
              rows={evaluaciones}
              rowKey={(evaluacion) => evaluacion.id}
              loading={cargandoEvaluaciones}
              emptyMessage="Todavía no hay evaluaciones registradas."
            />
          )}
        </SectionCard>
      )}

      {(puedeCrearEvaluacion || puedeActualizarEvaluacion) && (
        <Dialog
          open={abiertoDialogoEvaluacion}
          onClose={cerrarDialogoEvaluacion}
          maxWidth="sm"
          fullWidth
          aria-labelledby="titulo-formulario-evaluacion"
        >
          <DialogTitle id="titulo-formulario-evaluacion">
            {evaluacionEditando ? 'Corregir evaluación' : 'Nueva evaluación'}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h3" sx={{ mt: 1 }}>
              Datos de la evaluación
            </Typography>
            <Box
              component="form"
              id="formulario-evaluacion"
              noValidate
              onSubmit={(evento) => void manejarGuardarEvaluacion(evento)}
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
                    disabled={evaluacionEditando !== null}
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
                  disabled={evaluacionEditando !== null}
                  required={evaluacionEditando === null}
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
                disabled={evaluacionEditando !== null}
                required={evaluacionEditando === null}
                fullWidth
              />
              <TextField
                id="periodo-eval"
                label="Periodo (ej. 2026-1)"
                helperText={erroresEvaluacion.periodo}
                error={Boolean(erroresEvaluacion.periodo)}
                value={periodoEval}
                onChange={(evento) => actualizarCampoEvaluacion('periodo', evento.target.value)}
                disabled={evaluacionEditando !== null}
                required={evaluacionEditando === null}
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

      {puedeCrearSesion && (
        <Dialog
          open={abiertoDialogoSesion}
          onClose={() => {
            if (!guardandoSesion) setAbiertoDialogoSesion(false);
          }}
          maxWidth="sm"
          fullWidth
          aria-labelledby="titulo-nueva-sesion"
        >
          <DialogTitle id="titulo-nueva-sesion">Nueva sesión</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              id="fecha-sesion"
              label="Fecha"
              type="date"
              value={fechaSesion}
              onChange={(evento) => setFechaSesion(evento.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
            <TextField
              id="tema-sesion"
              label="Tema (opcional)"
              value={temaSesion}
              onChange={(evento) => setTemaSesion(evento.target.value)}
              fullWidth
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setAbiertoDialogoSesion(false)} disabled={guardandoSesion}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={() => void crearSesion()}
              disabled={guardandoSesion || !fechaSesion.trim()}
            >
              {guardandoSesion ? 'Creando…' : 'Crear sesión'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {puedeVerGrupos && (
        <Dialog
          open={abiertoDetalleSesion}
          onClose={() => {
            if (!cambiandoEstado) setAbiertoDetalleSesion(false);
          }}
          maxWidth="sm"
          fullWidth
          aria-labelledby="titulo-detalle-sesion"
        >
          <DialogTitle id="titulo-detalle-sesion">Detalle de la sesión</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {cargandoDetalle && !detalleSesion ? (
              <LoadingState label="Cargando detalle…" minHeight={120} />
            ) : detalleSesion ? (
              <>
                <Typography variant="body2">
                  <strong>Fecha:</strong> {detalleSesion.fecha}
                </Typography>
                <Typography variant="body2">
                  <strong>Grupo:</strong> {detalleSesion.grupoId}
                </Typography>
                <Typography variant="body2">
                  <strong>Tema:</strong> {detalleSesion.tema ?? '—'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Estado:</strong>
                  </Typography>
                  <StatusChip status={detalleSesion.estado} />
                </Box>
                {puedeActualizarSesion && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Cambiar estado de la sesión
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {(['programada', 'realizada', 'cancelada'] as const)
                        .filter((estado) => estado !== detalleSesion?.estado)
                        .map((estado) => (
                          <Button
                            key={estado}
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              if (detalleSesion) void cambiarEstadoSesion(detalleSesion.id, estado);
                            }}
                            disabled={cambiandoEstado}
                          >
                            {estado}
                          </Button>
                        ))}
                    </Box>
                  </Box>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No hay información disponible de la sesión.
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setAbiertoDetalleSesion(false)} disabled={cambiandoEstado}>
              Cerrar
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
