import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { apiClient, useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type {
  CrearMatriculaDto,
  EstudianteSummaryDto,
  GrupoDto,
  MatriculaDto,
} from '../api/client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatCard from '../components/common/StatCard';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import SearchToolbar from '../components/common/SearchToolbar';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import ConfirmDialog from '../components/common/ConfirmDialog';

type EstadoFiltro = 'todos' | MatriculaDto['estado'];
type OpcionTransicion = {
  to: MatriculaDto['estado'];
  etiqueta: string;
  destructiva?: boolean;
};
type Transicion = { matricula: MatriculaDto } & OpcionTransicion;
type Formulario = {
  estudianteId: string;
  grupoId: string;
  periodo: string;
};

const FORMULARIO_VACIO: Formulario = {
  estudianteId: '',
  grupoId: '',
  periodo: '',
};

/** Transiciones canónicas del backend (`academic-states.ts`). */
const TRANSICIONES_POR_ESTADO: Partial<
  Record<MatriculaDto['estado'], readonly OpcionTransicion[]>
> = {
  preinscrita: [
    { to: 'confirmada', etiqueta: 'Confirmar' },
    { to: 'cancelada', etiqueta: 'Cancelar', destructiva: true },
  ],
  confirmada: [
    { to: 'activa', etiqueta: 'Activar' },
    { to: 'retirada', etiqueta: 'Retirar', destructiva: true },
    { to: 'cancelada', etiqueta: 'Cancelar', destructiva: true },
  ],
  activa: [
    { to: 'finalizada', etiqueta: 'Finalizar' },
    { to: 'retirada', etiqueta: 'Retirar', destructiva: true },
    { to: 'cancelada', etiqueta: 'Cancelar', destructiva: true },
  ],
};

export default function Matriculas() {
  const { hasPermission, hasProfile } = useAuth();
  const esEstudiante = hasProfile('estudiante');
  const puedeLeerTodo = hasPermission('academic:enrollment:read');
  const puedeLeerPropia = hasPermission('academic:enrollment:read_own');
  // El backend exige `academic:enrollment:create` para registrar matrículas;
  // `read` solo habilita el listado global, no el alta.
  const puedeCrear = hasPermission('academic:enrollment:create');
  const puedeActualizar = hasPermission('academic:enrollment:update');

  const [matriculas, setMatriculas] = useState<MatriculaDto[]>([]);
  const [gruposDisponibles, setGruposDisponibles] = useState<GrupoDto[]>([]);
  const [estudiantes, setEstudiantes] = useState<EstudianteSummaryDto[]>([]);
  const [miEstudiante, setMiEstudiante] = useState<{ id: string; nombre: string } | null>(null);
  const [miEstudianteError, setMiEstudianteError] = useState<string | null>(null);
  const [errorAuxiliares, setErrorAuxiliares] = useState<string | null>(null);
  const [cargandoAuxiliares, setCargandoAuxiliares] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<EstadoFiltro>('todos');
  const [pagina, setPagina] = useState(0);
  const [tamanoPagina, setTamanoPagina] = useState(10);

  const [abiertoDialogo, setAbiertoDialogo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof Formulario, string>>>({});

  const [transicion, setTransicion] = useState<Transicion | null>(null);
  const [procesandoTransicion, setProcesandoTransicion] = useState(false);

  const cargarMatriculas = useCallback(async () => {
    if (!puedeLeerTodo && !puedeLeerPropia) return;
    setCargando(true);
    setError(null);
    try {
      const respuesta = puedeLeerTodo
        ? await apiClient.GET('/academic/enrollments')
        : await apiClient.GET('/me/enrollments');
      if (respuesta.error || !respuesta.data) {
        setError('No se pudieron cargar las matrículas.');
        return;
      }
      setMatriculas(respuesta.data.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar matrículas.');
    } finally {
      setCargando(false);
    }
  }, [puedeLeerTodo, puedeLeerPropia]);

  const cargarAuxiliares = useCallback(async () => {
    if (!puedeCrear) return;
    setCargandoAuxiliares(true);
    setErrorAuxiliares(null);
    setMiEstudianteError(null);
    try {
      const resGrupos = await apiClient.GET('/academic/groups');
      if (resGrupos.error || !resGrupos.data) {
        setErrorAuxiliares('No se pudieron cargar los grupos abiertos disponibles.');
      } else {
        setGruposDisponibles(resGrupos.data.data.filter((grupo) => grupo.estado === 'abierto'));
      }

      if (puedeLeerTodo) {
        const resEstudiantes = await apiClient.GET('/academic/students');
        if (resEstudiantes.error || !resEstudiantes.data) {
          setErrorAuxiliares('No se pudo cargar el listado de estudiantes.');
        } else {
          setEstudiantes(resEstudiantes.data.data);
        }
      }

      if (!puedeLeerTodo || esEstudiante) {
        try {
          const resMiEstudiante = await apiClient.GET('/me/student');
          if (resMiEstudiante.error || !resMiEstudiante.data) {
            setMiEstudiante(null);
            setMiEstudianteError(
              puedeLeerTodo
                ? 'No se pudo resolver tu ficha de estudiante. Puedes seleccionar otro estudiante.'
                : 'No se pudo resolver tu ficha de estudiante. No puedes crear matrículas.',
            );
          } else {
            setMiEstudiante({
              id: resMiEstudiante.data.id,
              nombre: `${resMiEstudiante.data.nombres} ${resMiEstudiante.data.apellidos}`.trim(),
            });
          }
        } catch (err) {
          setMiEstudiante(null);
          setMiEstudianteError(
            puedeLeerTodo
              ? 'No se pudo resolver tu ficha de estudiante. Puedes seleccionar otro estudiante.'
              : getErrorMessage(err) ||
                  'No se pudo resolver tu ficha de estudiante. No puedes crear matrículas.',
          );
        }
      }
    } catch (err) {
      setErrorAuxiliares(
        getErrorMessage(err) || 'Error al cargar los datos necesarios para crear una matrícula.',
      );
    } finally {
      setCargandoAuxiliares(false);
    }
  }, [esEstudiante, puedeCrear, puedeLeerTodo]);

  useEffect(() => {
    void cargarMatriculas();
  }, [cargarMatriculas]);

  useEffect(() => {
    void cargarAuxiliares();
  }, [cargarAuxiliares]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es');
    return matriculas
      .filter((matricula) => {
        const coincide =
          !texto ||
          [
            `${matricula.estudianteNombres} ${matricula.estudianteApellidos}`,
            matricula.estudianteId,
            matricula.programaNombre,
            matricula.grupoCodigo,
            matricula.periodo,
            matricula.estado,
          ]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(texto);
        return coincide && (filtro === 'todos' || matricula.estado === filtro);
      })
      .sort((a, b) => b.fechaMatricula.localeCompare(a.fechaMatricula));
  }, [matriculas, busqueda, filtro]);

  useEffect(() => {
    setPagina(0);
  }, [busqueda, filtro, tamanoPagina]);

  const matriculasPagina = filtrados.slice(pagina * tamanoPagina, (pagina + 1) * tamanoPagina);

  const preinscritas = matriculas.filter((m) => m.estado === 'preinscrita').length;
  const confirmadas = matriculas.filter((m) => m.estado === 'confirmada').length;
  const canceladas = matriculas.filter((m) => m.estado === 'cancelada').length;

  const estudianteId = formulario.estudianteId.trim() || (miEstudiante?.id ?? '');
  const puedeEnviar = Boolean(
    estudianteId &&
    formulario.grupoId &&
    !enviando &&
    !cargandoAuxiliares &&
    !errorAuxiliares &&
    (!miEstudianteError || puedeLeerTodo),
  );

  const actualizarCampo = (campo: keyof Formulario, valor: string) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: undefined }));
  };

  const validar = (): boolean => {
    const nuevosErrores: Partial<Record<keyof Formulario, string>> = {};
    if (!estudianteId) {
      nuevosErrores.estudianteId = puedeLeerTodo
        ? 'Selecciona un estudiante.'
        : 'No hay un estudiante asociado a tu usuario.';
    }
    if (!formulario.grupoId) nuevosErrores.grupoId = 'Selecciona un grupo abierto.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const formularioInicial = (): Formulario => ({
    ...FORMULARIO_VACIO,
    estudianteId: esEstudiante ? (miEstudiante?.id ?? '') : '',
  });

  const cerrarDialogo = () => {
    if (enviando) return;
    setAbiertoDialogo(false);
    setFormulario(formularioInicial());
    setErrores({});
  };

  const actualizar = () => {
    void cargarMatriculas();
    void cargarAuxiliares();
  };

  const manejarCrear = async () => {
    if (!validar()) return;
    setEnviando(true);
    setError(null);
    setExito(null);
    try {
      const payload: CrearMatriculaDto = {
        estudianteId,
        grupoId: formulario.grupoId,
        periodo: formulario.periodo.trim() || null,
      };
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/academic/enrollments', {
        body: payload,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      if (apiError || response?.status !== 201 || !data) {
        const problema = apiError;
        setError(problema?.detail || 'No se pudo crear la matrícula.');
        return;
      }
      setExito(
        data.grupoCodigo
          ? `Matrícula en "${data.grupoCodigo}" creada correctamente.`
          : 'Matrícula creada correctamente.',
      );
      cerrarDialogo();
      await cargarMatriculas();
      void cargarAuxiliares();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear la matrícula.');
    } finally {
      setEnviando(false);
    }
  };

  const ejecutarTransicion = async () => {
    if (!transicion) return;
    setProcesandoTransicion(true);
    setError(null);
    setExito(null);
    try {
      const { error: apiError, response } = await apiClient.POST(
        '/academic/enrollments/{id}/transitions',
        { params: { path: { id: transicion.matricula.id } }, body: { to: transicion.to } },
      );
      if (apiError || response?.status !== 200) {
        const problema = apiError;
        setError(problema?.detail || 'No se pudo cambiar el estado de la matrícula.');
        return;
      }
      setExito(`Matrícula actualizada a ${transicion.to} correctamente.`);
      setTransicion(null);
      await cargarMatriculas();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cambiar el estado de la matrícula.');
    } finally {
      setProcesandoTransicion(false);
    }
  };

  if (!puedeLeerPropia && !puedeLeerTodo) {
    return (
      <Box>
        <PageHeader
          title="Matrículas"
          description="No tienes acceso a la información de matrículas."
          icon={<AssignmentIcon />}
          breadcrumbs={[
            { label: 'Inicio', to: '/' },
            { label: 'Gestión académica' },
            { label: 'Matrículas' },
          ]}
        />
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para ver matrículas."
          icon={<AssignmentIcon />}
        />
      </Box>
    );
  }

  const columnas: DataTableColumn<MatriculaDto>[] = [
    {
      id: 'estudiante',
      label: 'Estudiante',
      minWidth: 200,
      render: (matricula) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {matricula.estudianteNombres} {matricula.estudianteApellidos}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {matricula.estudianteId}
          </Typography>
        </Box>
      ),
    },
    { id: 'programa', label: 'Programa', minWidth: 170, render: (m) => m.programaNombre },
    { id: 'grupo', label: 'Grupo', minWidth: 110, render: (m) => m.grupoCodigo },
    { id: 'periodo', label: 'Periodo', minWidth: 110, render: (m) => m.periodo },
    {
      id: 'estado',
      label: 'Estado',
      minWidth: 140,
      render: (m) => <StatusChip status={m.estado} />,
    },
    {
      id: 'fecha',
      label: 'Fecha',
      minWidth: 170,
      render: (m) => new Date(m.fechaMatricula).toLocaleString('es-CO'),
    },
    {
      id: 'acciones',
      label: 'Acciones',
      align: 'right',
      minWidth: 300,
      render: (matricula) => {
        if (!puedeActualizar) return null;
        const opciones = TRANSICIONES_POR_ESTADO[matricula.estado] ?? [];
        if (opciones.length === 0) return null;
        return (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, flexWrap: 'wrap' }}>
            {opciones.map((opcion) => (
              <Button
                key={opcion.to}
                size="small"
                color={opcion.destructiva ? 'error' : 'primary'}
                onClick={() => setTransicion({ matricula, ...opcion })}
                disabled={procesandoTransicion || cargando}
              >
                {opcion.etiqueta}
              </Button>
            ))}
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Matrículas"
        description={
          puedeLeerTodo
            ? 'Gestión de las matrículas del centro cultural y sus cambios de estado.'
            : 'Consulta de tus matrículas y su estado actual.'
        }
        icon={<AssignmentIcon />}
        breadcrumbs={[
          { label: 'Inicio', to: '/' },
          { label: 'Gestión académica' },
          { label: 'Matrículas' },
        ]}
        actions={
          <>
            <Button startIcon={<RefreshIcon />} onClick={actualizar} disabled={cargando}>
              Actualizar
            </Button>
            {puedeCrear && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setFormulario(formularioInicial());
                  setErrores({});
                  setAbiertoDialogo(true);
                }}
                disabled={cargandoAuxiliares}
              >
                Nueva matrícula
              </Button>
            )}
          </>
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
      {errorAuxiliares && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorAuxiliares(null)}>
          {errorAuxiliares}
        </Alert>
      )}
      {miEstudianteError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMiEstudianteError(null)}>
          {miEstudianteError}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
          mb: 3,
        }}
      >
        <StatCard
          label="Total de matrículas"
          value={matriculas.length}
          icon={<AssignmentIcon />}
          description="Registros consultados"
        />
        <StatCard
          label="Preinscritas"
          value={preinscritas}
          icon={<AssignmentIcon />}
          description="Pendientes de confirmación"
        />
        <StatCard
          label="Confirmadas"
          value={confirmadas}
          icon={<AssignmentIcon />}
          description="Cupo confirmado"
        />
        <StatCard
          label="Canceladas"
          value={canceladas}
          icon={<AssignmentIcon />}
          description="Sin vigencia"
        />
      </Box>

      <SectionCard
        title={puedeLeerTodo ? 'Todas las matrículas' : 'Mis matrículas'}
        subtitle="Consulta, filtra y actualiza el estado de las matrículas"
      >
        {error && matriculas.length === 0 ? (
          <ErrorState message={error} onRetry={() => void cargarMatriculas()} />
        ) : cargando && matriculas.length === 0 ? (
          <LoadingState label="Cargando matrículas…" />
        ) : (
          <>
            <SearchToolbar
              value={busqueda}
              onChange={setBusqueda}
              label="Buscar matrícula"
              placeholder="Estudiante, programa, grupo, periodo o estado"
              resultCount={filtrados.length}
              filters={
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <InputLabel id="filtro-estado-matricula-label">Estado</InputLabel>
                  <Select
                    labelId="filtro-estado-matricula-label"
                    label="Estado"
                    value={filtro}
                    onChange={(event) => setFiltro(event.target.value)}
                  >
                    <MenuItem value="todos">Todos</MenuItem>
                    <MenuItem value="preinscrita">Preinscrita</MenuItem>
                    <MenuItem value="confirmada">Confirmada</MenuItem>
                    <MenuItem value="activa">Activa</MenuItem>
                    <MenuItem value="finalizada">Finalizada</MenuItem>
                    <MenuItem value="cancelada">Cancelada</MenuItem>
                    <MenuItem value="retirada">Retirada</MenuItem>
                  </Select>
                </FormControl>
              }
            />
            {filtrados.length === 0 && !cargando ? (
              <EmptyState
                title={matriculas.length === 0 ? 'Sin matrículas registradas' : 'Sin coincidencias'}
                description={
                  matriculas.length === 0
                    ? puedeCrear
                      ? 'Cuando registres una matrícula aparecerá en este listado.'
                      : 'Las matrículas disponibles para tu perfil aparecerán en este listado.'
                    : 'Prueba con otro estudiante, programa o estado.'
                }
                minHeight={180}
              />
            ) : (
              <DataTable
                ariaLabel="Listado de matrículas"
                columns={columnas}
                rows={matriculasPagina}
                rowKey={(matricula) => matricula.id}
                loading={cargando}
                page={pagina}
                pageSize={tamanoPagina}
                total={filtrados.length}
                onPageChange={setPagina}
                onPageSizeChange={setTamanoPagina}
                emptyMessage="No hay matrículas para mostrar."
              />
            )}
          </>
        )}
      </SectionCard>

      <Dialog
        open={abiertoDialogo}
        onClose={cerrarDialogo}
        maxWidth="sm"
        fullWidth
        aria-labelledby="titulo-crear-matricula"
      >
        <DialogTitle id="titulo-crear-matricula">Nueva matrícula</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DialogContentText>
            {puedeLeerTodo
              ? 'Selecciona el estudiante y el grupo abierto para la nueva matrícula.'
              : 'Se matriculará el estudiante asociado a tu usuario.'}
          </DialogContentText>
          {puedeLeerTodo ? (
            <>
              <FormControl fullWidth error={Boolean(errores.estudianteId)}>
                <InputLabel id="estudiante-matricula-label">Estudiante</InputLabel>
                <Select
                  labelId="estudiante-matricula-label"
                  label="Estudiante"
                  value={formulario.estudianteId}
                  onChange={(event) => actualizarCampo('estudianteId', event.target.value)}
                >
                  <MenuItem value="">Selecciona un estudiante</MenuItem>
                  {estudiantes.map((estudiante) => (
                    <MenuItem key={estudiante.id} value={estudiante.id}>
                      {estudiante.tipoDocumento} — {estudiante.nombres} {estudiante.apellidos}
                    </MenuItem>
                  ))}
                </Select>
                {errores.estudianteId && <FormHelperText>{errores.estudianteId}</FormHelperText>}
              </FormControl>
              {esEstudiante && miEstudiante && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    onClick={() => actualizarCampo('estudianteId', miEstudiante.id)}
                  >
                    Usar mi UID
                  </Button>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    Tu UID: {miEstudiante.id}
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <TextField
              label="Estudiante asociado a tu usuario"
              value={miEstudiante ? `${miEstudiante.nombre} (${miEstudiante.id})` : ''}
              helperText={
                miEstudianteError ?? 'El identificador se resuelve desde tu ficha de estudiante.'
              }
              error={Boolean(miEstudianteError)}
              slotProps={{ htmlInput: { readOnly: true } }}
              fullWidth
            />
          )}
          <FormControl fullWidth error={Boolean(errores.grupoId)}>
            <InputLabel id="grupo-matricula-label">Grupo abierto</InputLabel>
            <Select
              labelId="grupo-matricula-label"
              label="Grupo abierto"
              value={formulario.grupoId}
              onChange={(event) => actualizarCampo('grupoId', event.target.value)}
            >
              <MenuItem value="">Selecciona un grupo abierto</MenuItem>
              {gruposDisponibles.map((grupo) => (
                <MenuItem key={grupo.id} value={grupo.id}>
                  {grupo.codigo} — {grupo.periodo}
                </MenuItem>
              ))}
            </Select>
            {errores.grupoId && <FormHelperText>{errores.grupoId}</FormHelperText>}
          </FormControl>
          <TextField
            id="periodo-matricula"
            label="Periodo (opcional, ej. 2026-1)"
            value={formulario.periodo}
            onChange={(event) => actualizarCampo('periodo', event.target.value)}
            helperText="Si se deja vacío, el backend aplica el periodo del grupo."
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrarDialogo} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void manejarCrear()} disabled={!puedeEnviar}>
            {enviando ? 'Creando…' : 'Crear matrícula'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(transicion)}
        title={`${transicion?.etiqueta ?? ''} matrícula`.trim()}
        description={
          transicion
            ? `¿${transicion.etiqueta.toLowerCase()} la matrícula de ${transicion.matricula.estudianteNombres} ${transicion.matricula.estudianteApellidos} en el grupo ${transicion.matricula.grupoCodigo}?`
            : ''
        }
        confirmLabel={`${transicion?.etiqueta ?? ''} matrícula`.trim()}
        destructive={transicion?.destructiva ?? false}
        loading={procesandoTransicion}
        onConfirm={() => void ejecutarTransicion()}
        onCancel={() => {
          if (!procesandoTransicion) setTransicion(null);
        }}
      />
    </Box>
  );
}
