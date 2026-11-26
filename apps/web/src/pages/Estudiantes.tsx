import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, People as PeopleIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { apiClient, useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { CrearEstudianteDto, EstudianteSummaryDto } from '../api/client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatCard from '../components/common/StatCard';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import SearchToolbar from '../components/common/SearchToolbar';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

type Filtro = 'todos' | 'con' | 'sin';
type Orden = 'nombre' | 'documento';
type Formulario = {
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  consentimiento: boolean;
};

const FORMULARIO_VACIO: Formulario = {
  tipoDocumento: '',
  numeroDocumento: '',
  nombres: '',
  apellidos: '',
  consentimiento: false,
};

export default function Estudiantes() {
  const { hasPermission } = useAuth();
  const puedeGestionar = hasPermission('academic:student:manage');

  const [estudiantes, setEstudiantes] = useState<EstudianteSummaryDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [orden, setOrden] = useState<Orden>('nombre');
  const [pagina, setPagina] = useState(0);
  const [tamanoPagina, setTamanoPagina] = useState(10);

  const [abiertoDialogo, setAbiertoDialogo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof Formulario, string>>>({});

  const cargarEstudiantes = useCallback(async () => {
    if (!puedeGestionar) return;
    setCargando(true);
    setError(null);
    try {
      const respuesta = await apiClient.GET('/academic/students');
      if (respuesta.error || !respuesta.data) {
        setError('No se pudieron cargar los estudiantes.');
        return;
      }
      setEstudiantes(respuesta.data.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar estudiantes.');
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar]);

  useEffect(() => {
    void cargarEstudiantes();
  }, [cargarEstudiantes]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es');
    return estudiantes
      .filter((estudiante) => {
        const coincide =
          !texto ||
          `${estudiante.nombres} ${estudiante.apellidos} ${estudiante.tipoDocumento}`
            .toLocaleLowerCase('es')
            .includes(texto);
        const porConsentimiento =
          filtro === 'todos' ||
          (filtro === 'con' && estudiante.consentimientoAceptado) ||
          (filtro === 'sin' && !estudiante.consentimientoAceptado);
        return coincide && porConsentimiento;
      })
      .sort((a, b) =>
        orden === 'nombre'
          ? `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, 'es')
          : a.tipoDocumento.localeCompare(b.tipoDocumento, 'es'),
      );
  }, [estudiantes, busqueda, filtro, orden]);

  useEffect(() => {
    setPagina(0);
  }, [busqueda, filtro, orden, tamanoPagina]);

  const estudiantesPagina = filtrados.slice(pagina * tamanoPagina, (pagina + 1) * tamanoPagina);

  const actualizarCampo = (campo: keyof Formulario, valor: string | boolean) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: undefined }));
  };

  const validar = (): boolean => {
    const nuevosErrores: Partial<Record<keyof Formulario, string>> = {};
    if (!formulario.tipoDocumento.trim())
      nuevosErrores.tipoDocumento = 'Selecciona el tipo de documento.';
    if (!formulario.numeroDocumento.trim())
      nuevosErrores.numeroDocumento = 'Ingresa el número de documento.';
    if (!formulario.nombres.trim()) nuevosErrores.nombres = 'Ingresa los nombres.';
    if (!formulario.apellidos.trim()) nuevosErrores.apellidos = 'Ingresa los apellidos.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const cerrarDialogo = () => {
    if (enviando) return;
    setAbiertoDialogo(false);
    setFormulario(FORMULARIO_VACIO);
    setErrores({});
  };

  const manejarCrear = async () => {
    if (!validar()) return;
    setEnviando(true);
    setError(null);
    setExito(null);
    try {
      const payload: CrearEstudianteDto = {
        tipoDocumento: formulario.tipoDocumento.trim(),
        numeroDocumento: formulario.numeroDocumento.trim(),
        nombres: formulario.nombres.trim(),
        apellidos: formulario.apellidos.trim(),
        consentimientoDatos: { aceptado: formulario.consentimiento, medio: 'web' },
      };
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/academic/students', {
        body: payload,
      });
      if (apiError || response?.status !== 201 || !data) {
        const problema = apiError;
        setError(problema?.detail || 'No se pudo crear el estudiante.');
        return;
      }
      setExito(`Estudiante "${data.nombres} ${data.apellidos}" creado correctamente.`);
      cerrarDialogo();
      await cargarEstudiantes();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear el estudiante.');
    } finally {
      setEnviando(false);
    }
  };

  if (!puedeGestionar) {
    return (
      <EmptyState
        title="Sin permisos"
        description="No tienes permiso para gestionar estudiantes."
        icon={<PeopleIcon />}
      />
    );
  }

  const columnas: DataTableColumn<EstudianteSummaryDto>[] = [
    {
      id: 'documento',
      label: 'Documento',
      minWidth: 150,
      render: (estudiante) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {estudiante.tipoDocumento}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            N.º no incluido en el listado
          </Typography>
        </Box>
      ),
    },
    { id: 'nombres', label: 'Nombres', render: (e) => e.nombres, minWidth: 160 },
    { id: 'apellidos', label: 'Apellidos', render: (e) => e.apellidos, minWidth: 160 },
    {
      id: 'consentimiento',
      label: 'Consentimiento',
      minWidth: 180,
      render: (e) => (
        <StatusChip
          status={e.consentimientoAceptado ? 'activo' : 'sin consentimiento'}
          label={e.consentimientoAceptado ? 'Registrado' : 'Sin registrar'}
        />
      ),
    },
    {
      id: 'acciones',
      label: 'Acciones',
      align: 'right',
      render: () => (
        <Button size="small" onClick={() => void cargarEstudiantes()} disabled={cargando}>
          Actualizar
        </Button>
      ),
    },
  ];

  const conConsentimiento = estudiantes.filter((e) => e.consentimientoAceptado).length;

  return (
    <Box>
      <PageHeader
        title="Estudiantes"
        description="Administración y seguimiento de los estudiantes registrados en el centro cultural."
        icon={<PeopleIcon />}
        breadcrumbs={[
          { label: 'Inicio', to: '/' },
          { label: 'Gestión académica' },
          { label: 'Estudiantes' },
        ]}
        actions={
          <>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => void cargarEstudiantes()}
              disabled={cargando}
            >
              Actualizar listado
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAbiertoDialogo(true)}
            >
              Nuevo estudiante
            </Button>
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

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          mb: 3,
        }}
      >
        <StatCard
          label="Total de estudiantes"
          value={estudiantes.length}
          icon={<PeopleIcon />}
          description="Registros consultados"
        />
        <StatCard
          label="Con consentimiento"
          value={conConsentimiento}
          icon={<PeopleIcon />}
          description="Tratamiento de datos registrado"
        />
        <StatCard
          label="Sin consentimiento"
          value={estudiantes.length - conConsentimiento}
          icon={<PeopleIcon />}
          description="Pendientes de registro"
        />
      </Box>

      <SectionCard
        title="Listado de estudiantes"
        subtitle="Consulta, filtra y actualiza los registros"
      >
        {error && estudiantes.length === 0 ? (
          <ErrorState message={error} onRetry={() => void cargarEstudiantes()} />
        ) : cargando && estudiantes.length === 0 ? (
          <LoadingState label="Cargando estudiantes…" />
        ) : (
          <>
            <SearchToolbar
              value={busqueda}
              onChange={setBusqueda}
              label="Buscar estudiante"
              placeholder="Nombre, apellido o tipo de documento"
              resultCount={filtrados.length}
              filters={
                <>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="filtro-consentimiento-label">Consentimiento</InputLabel>
                    <Select
                      labelId="filtro-consentimiento-label"
                      label="Consentimiento"
                      value={filtro}
                      onChange={(event) => setFiltro(event.target.value)}
                    >
                      <MenuItem value="todos">Todos</MenuItem>
                      <MenuItem value="con">Con registro</MenuItem>
                      <MenuItem value="sin">Sin registro</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="orden-estudiantes-label">Ordenar por</InputLabel>
                    <Select
                      labelId="orden-estudiantes-label"
                      label="Ordenar por"
                      value={orden}
                      onChange={(event) => setOrden(event.target.value)}
                    >
                      <MenuItem value="nombre">Apellidos y nombres</MenuItem>
                      <MenuItem value="documento">Tipo de documento</MenuItem>
                    </Select>
                  </FormControl>
                </>
              }
            />
            {filtrados.length === 0 && !cargando ? (
              <EmptyState
                title={
                  estudiantes.length === 0 ? 'Sin estudiantes registrados' : 'Sin coincidencias'
                }
                description={
                  estudiantes.length === 0
                    ? 'Cuando registres estudiantes aparecerán en este listado.'
                    : 'Prueba con otro nombre, apellido o tipo de documento.'
                }
                minHeight={180}
              />
            ) : (
              <DataTable
                ariaLabel="Listado de estudiantes"
                columns={columnas}
                rows={estudiantesPagina}
                rowKey={(estudiante) => estudiante.id}
                loading={cargando}
                page={pagina}
                pageSize={tamanoPagina}
                total={filtrados.length}
                onPageChange={setPagina}
                onPageSizeChange={setTamanoPagina}
                emptyMessage="No hay estudiantes para mostrar."
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
        aria-labelledby="titulo-crear-estudiante"
      >
        <DialogTitle id="titulo-crear-estudiante">Nuevo estudiante</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h3" sx={{ mt: 1 }}>
            Información personal
          </Typography>
          <FormControl fullWidth error={Boolean(errores.tipoDocumento)}>
            <InputLabel id="tipo-documento-label">Tipo de documento</InputLabel>
            <Select
              labelId="tipo-documento-label"
              label="Tipo de documento"
              value={formulario.tipoDocumento}
              onChange={(event) => actualizarCampo('tipoDocumento', event.target.value)}
            >
              <MenuItem value="CC">Cédula de ciudadanía (CC)</MenuItem>
              <MenuItem value="TI">Tarjeta de identidad (TI)</MenuItem>
              <MenuItem value="RC">Registro civil (RC)</MenuItem>
              <MenuItem value="CE">Cédula de extranjería (CE)</MenuItem>
            </Select>
            {errores.tipoDocumento && <FormHelperText>{errores.tipoDocumento}</FormHelperText>}
          </FormControl>
          <TextField
            id="numero-documento"
            label="Número de documento"
            value={formulario.numeroDocumento}
            onChange={(event) => actualizarCampo('numeroDocumento', event.target.value)}
            error={Boolean(errores.numeroDocumento)}
            helperText={errores.numeroDocumento}
            required
            fullWidth
          />
          <TextField
            id="nombres-estudiante"
            label="Nombres"
            value={formulario.nombres}
            onChange={(event) => actualizarCampo('nombres', event.target.value)}
            error={Boolean(errores.nombres)}
            helperText={errores.nombres}
            required
            fullWidth
          />
          <TextField
            id="apellidos-estudiante"
            label="Apellidos"
            value={formulario.apellidos}
            onChange={(event) => actualizarCampo('apellidos', event.target.value)}
            error={Boolean(errores.apellidos)}
            helperText={errores.apellidos}
            required
            fullWidth
          />
          <Divider />
          <Typography variant="h3">Protección de datos</Typography>
          <FormControl error={Boolean(errores.consentimiento)}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formulario.consentimiento}
                  onChange={(event) => actualizarCampo('consentimiento', event.target.checked)}
                />
              }
              label="El estudiante autoriza el tratamiento de sus datos personales"
            />
            {errores.consentimiento && <FormHelperText>{errores.consentimiento}</FormHelperText>}
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            El registro se enviará con el medio “web” y el estado de consentimiento indicado.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrarDialogo} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void manejarCrear()} disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear estudiante'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
