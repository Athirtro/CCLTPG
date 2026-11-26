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
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Archive as ArchiveIcon,
  Publish as PublishIcon,
  Refresh as RefreshIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import { apiClient, useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { CrearProgramaDto, ProgramaDto } from '../api/client';
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

type Area = CrearProgramaDto['area'];
type EstadoFiltro = 'todos' | ProgramaDto['estado'];
type Formulario = {
  nombre: string;
  area: Area;
  descripcion: string;
  cupoMaximo: string;
};
type Transicion = { programa: ProgramaDto; to: 'publicado' | 'archivado' };

const AREAS: ReadonlyArray<{ value: Area; label: string }> = [
  { value: 'danza', label: 'Danza' },
  { value: 'musica', label: 'Música' },
  { value: 'teatro', label: 'Teatro' },
  { value: 'artes_plasticas', label: 'Artes plásticas' },
];

const AREA_LABEL: Record<Area, string> = {
  danza: 'Danza',
  musica: 'Música',
  teatro: 'Teatro',
  artes_plasticas: 'Artes plásticas',
};

const FORMULARIO_VACIO: Formulario = {
  nombre: '',
  area: 'musica',
  descripcion: '',
  cupoMaximo: '',
};

export default function Programas() {
  const { hasPermission } = useAuth();
  const puedeGestionar = hasPermission('academic:program:manage');

  const [programas, setProgramas] = useState<ProgramaDto[]>([]);
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

  const cargarProgramas = useCallback(async () => {
    if (!puedeGestionar) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/academic/programs');
      if (apiError || !data) {
        setError('No se pudieron cargar los programas.');
        return;
      }
      setProgramas(data.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar programas.');
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar]);

  useEffect(() => {
    void cargarProgramas();
  }, [cargarProgramas]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es');
    return programas
      .filter((programa) => {
        const coincide =
          !texto ||
          [programa.nombre, programa.descripcion ?? '', AREA_LABEL[programa.area], programa.estado]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(texto);
        return coincide && (filtro === 'todos' || programa.estado === filtro);
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [programas, busqueda, filtro]);

  useEffect(() => {
    setPagina(0);
  }, [busqueda, filtro, tamanoPagina]);

  const programasPagina = filtrados.slice(pagina * tamanoPagina, (pagina + 1) * tamanoPagina);

  const publicados = programas.filter((programa) => programa.estado === 'publicado').length;
  const borradores = programas.filter((programa) => programa.estado === 'borrador').length;
  const archivados = programas.filter((programa) => programa.estado === 'archivado').length;

  const actualizarCampo = (campo: keyof Formulario, valor: string) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: undefined }));
  };

  const validar = (): boolean => {
    const nuevosErrores: Partial<Record<keyof Formulario, string>> = {};
    if (!formulario.nombre.trim()) nuevosErrores.nombre = 'Ingresa el nombre del programa.';
    const cupo = Number(formulario.cupoMaximo.trim());
    if (!formulario.cupoMaximo.trim() || !Number.isInteger(cupo) || cupo <= 0) {
      nuevosErrores.cupoMaximo = 'Ingresa un cupo entero mayor que cero.';
    }
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
    const area = AREAS.find((opcion) => opcion.value === formulario.area)?.value;
    if (!area) {
      setError('El área artística seleccionada no es válida.');
      return;
    }
    setEnviando(true);
    setError(null);
    setExito(null);
    try {
      const payload: CrearProgramaDto = {
        nombre: formulario.nombre.trim(),
        descripcion: formulario.descripcion.trim() || null,
        area,
        cupoMaximo: Number(formulario.cupoMaximo.trim()),
      };
      const { data, error: apiError, response } = await apiClient.POST('/academic/programs', {
        body: payload,
      });
      if (apiError || response?.status !== 201 || !data) {
        const problema = apiError;
        setError(problema?.detail || 'No se pudo crear el programa.');
        return;
      }
      setExito(`Programa "${data.nombre}" creado correctamente.`);
      cerrarDialogo();
      await cargarProgramas();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear el programa.');
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
        '/academic/programs/{id}/transitions',
        { params: { path: { id: transicion.programa.id } }, body: { to: transicion.to } },
      );
      if (apiError || response?.status !== 200) {
        const problema = apiError;
        setError(problema?.detail || 'No se pudo cambiar el estado del programa.');
        return;
      }
      setExito(
        `Estado del programa "${transicion.programa.nombre}" cambiado a ${transicion.to}.`,
      );
      setTransicion(null);
      await cargarProgramas();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cambiar el estado del programa.');
    } finally {
      setProcesandoTransicion(false);
    }
  };

  if (!puedeGestionar) {
    return (
      <Box>
        <PageHeader
          title="Programas"
          description="No tienes acceso a la gestión de programas."
          icon={<SchoolIcon />}
          breadcrumbs={[
            { label: 'Inicio', to: '/' },
            { label: 'Gestión académica' },
            { label: 'Programas' },
          ]}
        />
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para gestionar programas."
          icon={<SchoolIcon />}
        />
      </Box>
    );
  }

  const columnas: DataTableColumn<ProgramaDto>[] = [
    {
      id: 'nombre',
      label: 'Nombre',
      minWidth: 200,
      render: (programa) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {programa.nombre}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {programa.descripcion || 'Sin descripción'}
          </Typography>
        </Box>
      ),
    },
    { id: 'area', label: 'Área', minWidth: 140, render: (p) => AREA_LABEL[p.area] },
    {
      id: 'cupoMaximo',
      label: 'Cupo máximo',
      minWidth: 120,
      align: 'right',
      render: (p) => p.cupoMaximo,
    },
    {
      id: 'estado',
      label: 'Estado',
      minWidth: 130,
      render: (p) => <StatusChip status={p.estado} />,
    },
    {
      id: 'creadoEn',
      label: 'Fecha de creación',
      minWidth: 150,
      render: (p) => new Date(p.creadoEn).toLocaleDateString('es-CO'),
    },
    {
      id: 'acciones',
      label: 'Acciones',
      align: 'right',
      minWidth: 130,
      render: (programa) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          {programa.estado === 'borrador' && (
            <Button
              size="small"
              startIcon={<PublishIcon fontSize="small" />}
              onClick={() => setTransicion({ programa, to: 'publicado' })}
              disabled={procesandoTransicion || cargando}
            >
              Publicar
            </Button>
          )}
          {programa.estado === 'publicado' && (
            <Button
              size="small"
              startIcon={<ArchiveIcon fontSize="small" />}
              onClick={() => setTransicion({ programa, to: 'archivado' })}
              disabled={procesandoTransicion || cargando}
            >
              Archivar
            </Button>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Programas"
        description="Gestión de los programas formativos del centro cultural, su estado y su cupo."
        icon={<SchoolIcon />}
        breadcrumbs={[
          { label: 'Inicio', to: '/' },
          { label: 'Gestión académica' },
          { label: 'Programas' },
        ]}
        actions={
          <>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => void cargarProgramas()}
              disabled={cargando || procesandoTransicion}
            >
              Actualizar
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAbiertoDialogo(true)}
              disabled={cargando}
            >
              Nuevo programa
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
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
          mb: 3,
        }}
      >
        <StatCard
          label="Total de programas"
          value={programas.length}
          icon={<SchoolIcon />}
          description="Registros consultados"
        />
        <StatCard
          label="Publicados"
          value={publicados}
          icon={<PublishIcon />}
          description="Disponibles para inscripción"
        />
        <StatCard
          label="Borradores"
          value={borradores}
          icon={<SchoolIcon />}
          description="Aún no publicados"
        />
        <StatCard
          label="Archivados"
          value={archivados}
          icon={<ArchiveIcon />}
          description="Fuera de convocatoria"
        />
      </Box>

      <SectionCard
        title="Listado de programas"
        subtitle="Consulta, filtra y cambia el estado de los programas registrados"
      >
        {error && programas.length === 0 ? (
          <ErrorState message={error} onRetry={() => void cargarProgramas()} />
        ) : cargando && programas.length === 0 ? (
          <LoadingState label="Cargando programas…" />
        ) : (
          <>
            <SearchToolbar
              value={busqueda}
              onChange={setBusqueda}
              label="Buscar programa"
              placeholder="Nombre, área, descripción o estado"
              resultCount={filtrados.length}
              filters={
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="filtro-estado-programa-label">Estado</InputLabel>
                  <Select
                    labelId="filtro-estado-programa-label"
                    label="Estado"
                    value={filtro}
                    onChange={(event) => setFiltro(event.target.value)}
                  >
                    <MenuItem value="todos">Todos</MenuItem>
                    <MenuItem value="borrador">Borrador</MenuItem>
                    <MenuItem value="publicado">Publicado</MenuItem>
                    <MenuItem value="archivado">Archivado</MenuItem>
                  </Select>
                </FormControl>
              }
            />
            {filtrados.length === 0 && !cargando ? (
              <EmptyState
                title={programas.length === 0 ? 'Sin programas registrados' : 'Sin coincidencias'}
                description={
                  programas.length === 0
                    ? 'Cuando registres un programa aparecerá en este listado.'
                    : 'Prueba con otro nombre, área o estado.'
                }
                minHeight={180}
              />
            ) : (
              <DataTable
                ariaLabel="Listado de programas"
                columns={columnas}
                rows={programasPagina}
                rowKey={(programa) => programa.id}
                loading={cargando}
                page={pagina}
                pageSize={tamanoPagina}
                total={filtrados.length}
                onPageChange={setPagina}
                onPageSizeChange={setTamanoPagina}
                emptyMessage="No hay programas para mostrar."
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
        aria-labelledby="titulo-crear-programa"
      >
        <DialogTitle id="titulo-crear-programa">Nuevo programa</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DialogContentText>Completa los datos del nuevo programa formativo.</DialogContentText>
          <TextField
            id="nombre-programa"
            label="Nombre del programa"
            value={formulario.nombre}
            onChange={(event) => actualizarCampo('nombre', event.target.value)}
            error={Boolean(errores.nombre)}
            helperText={errores.nombre}
            required
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="area-programa-label">Área artística</InputLabel>
            <Select
              labelId="area-programa-label"
              label="Área artística"
              value={formulario.area}
              onChange={(event) => actualizarCampo('area', event.target.value)}
            >
              {AREAS.map((opcion) => (
                <MenuItem key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            id="descripcion-programa"
            label="Descripción"
            value={formulario.descripcion}
            onChange={(event) => actualizarCampo('descripcion', event.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            id="cupo-programa"
            label="Cupo máximo"
            type="number"
            value={formulario.cupoMaximo}
            onChange={(event) => actualizarCampo('cupoMaximo', event.target.value)}
            error={Boolean(errores.cupoMaximo)}
            helperText={errores.cupoMaximo ?? 'Debe ser un número entero mayor que cero.'}
            required
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrarDialogo} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void manejarCrear()} disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear programa'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(transicion)}
        title={transicion?.to === 'publicado' ? 'Publicar programa' : 'Archivar programa'}
        description={
          transicion
            ? transicion.to === 'publicado'
              ? `¿Publicar el programa "${transicion.programa.nombre}"? Quedará disponible para nuevas matrículas.`
              : `¿Archivar el programa "${transicion.programa.nombre}"? Dejará de estar disponible para nuevas matrículas.`
            : ''
        }
        confirmLabel={transicion?.to === 'publicado' ? 'Publicar' : 'Archivar'}
        destructive={transicion?.to === 'archivado'}
        loading={procesandoTransicion}
        onConfirm={() => void ejecutarTransicion()}
        onCancel={() => {
          if (!procesandoTransicion) setTransicion(null);
        }}
      />
    </Box>
  );
}
