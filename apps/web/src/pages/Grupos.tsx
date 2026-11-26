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
  Group as GroupIcon,
  Lock as LockIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { apiClient, useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { CrearGrupoDto, GrupoDto, ProgramaDto } from '../api/client';
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

type EstadoFiltro = 'todos' | GrupoDto['estado'];
type Formulario = {
  codigo: string;
  programaId: string;
  educadorId: string;
  salon: string;
  periodo: string;
  cupoMaximo: string;
};

const FORMULARIO_VACIO: Formulario = {
  codigo: '',
  programaId: '',
  educadorId: '',
  salon: '',
  periodo: '',
  cupoMaximo: '',
};

export default function Grupos() {
  const { hasPermission } = useAuth();
  const puedeGestionar = hasPermission('academic:group:manage');

  const [grupos, setGrupos] = useState<GrupoDto[]>([]);
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

  const [grupoTransicion, setGrupoTransicion] = useState<GrupoDto | null>(null);
  const [procesandoTransicion, setProcesandoTransicion] = useState(false);

  const cargarGrupos = useCallback(async () => {
    if (!puedeGestionar) return;
    setCargando(true);
    setError(null);
    try {
      const [resGrupos, resProgramas] = await Promise.all([
        apiClient.GET('/academic/groups'),
        apiClient.GET('/academic/programs'),
      ]);
      if (resGrupos.error || !resGrupos.data) {
        setError('No se pudieron cargar los grupos.');
        return;
      }
      if (resProgramas.error || !resProgramas.data) {
        setError('No se pudieron cargar los programas asociados.');
        return;
      }
      setGrupos(resGrupos.data.data);
      setProgramas(resProgramas.data.data);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar grupos.');
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar]);

  useEffect(() => {
    void cargarGrupos();
  }, [cargarGrupos]);

  const nombrePrograma = useMemo(() => {
    return new Map(programas.map((programa) => [programa.id, programa.nombre]));
  }, [programas]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es');
    return grupos
      .filter((grupo) => {
        const coincide =
          !texto ||
          [
            grupo.codigo,
            nombrePrograma.get(grupo.programaId) ?? '',
            grupo.periodo,
            grupo.educadorId,
            grupo.salon ?? '',
          ]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(texto);
        return coincide && (filtro === 'todos' || grupo.estado === filtro);
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
  }, [grupos, busqueda, filtro, nombrePrograma]);

  useEffect(() => {
    setPagina(0);
  }, [busqueda, filtro, tamanoPagina]);

  const gruposPagina = filtrados.slice(pagina * tamanoPagina, (pagina + 1) * tamanoPagina);

  const abiertos = grupos.filter((grupo) => grupo.estado === 'abierto').length;
  const cerrados = grupos.filter((grupo) => grupo.estado === 'cerrado').length;

  const actualizarCampo = (campo: keyof Formulario, valor: string) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: undefined }));
  };

  const validar = (): boolean => {
    const nuevosErrores: Partial<Record<keyof Formulario, string>> = {};
    if (!formulario.codigo.trim()) nuevosErrores.codigo = 'Ingresa el código del grupo.';
    if (!formulario.programaId) nuevosErrores.programaId = 'Selecciona un programa.';
    if (!formulario.educadorId.trim()) nuevosErrores.educadorId = 'Ingresa el ID del educador.';
    if (!formulario.periodo.trim()) nuevosErrores.periodo = 'Ingresa el periodo.';
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
    setEnviando(true);
    setError(null);
    setExito(null);
    try {
      const payload: CrearGrupoDto = {
        codigo: formulario.codigo.trim(),
        programaId: formulario.programaId,
        educadorId: formulario.educadorId.trim(),
        salon: formulario.salon.trim() || null,
        periodo: formulario.periodo.trim(),
        cupoMaximo: Number(formulario.cupoMaximo.trim()),
      };
      const { data, error: apiError, response } = await apiClient.POST('/academic/groups', {
        body: payload,
      });
      if (apiError || response?.status !== 201 || !data) {
        const problema = apiError;
        setError(problema?.detail || 'No se pudo crear el grupo.');
        return;
      }
      setExito(`Grupo "${data.codigo}" creado correctamente.`);
      cerrarDialogo();
      await cargarGrupos();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al crear el grupo.');
    } finally {
      setEnviando(false);
    }
  };

  const cerrarGrupo = async () => {
    if (!grupoTransicion) return;
    setProcesandoTransicion(true);
    setError(null);
    setExito(null);
    try {
      const { error: apiError, response } = await apiClient.POST(
        '/academic/groups/{id}/transitions',
        { params: { path: { id: grupoTransicion.id } }, body: { to: 'cerrado' } },
      );
      if (apiError || response?.status !== 200) {
        const problema = apiError;
        setError(problema?.detail || 'No se pudo cerrar el grupo.');
        return;
      }
      setExito(`Grupo "${grupoTransicion.codigo}" cerrado correctamente.`);
      setGrupoTransicion(null);
      await cargarGrupos();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cerrar el grupo.');
    } finally {
      setProcesandoTransicion(false);
    }
  };

  if (!puedeGestionar) {
    return (
      <Box>
        <PageHeader
          title="Grupos"
          description="No tienes acceso a la gestión de grupos."
          icon={<GroupIcon />}
          breadcrumbs={[
            { label: 'Inicio', to: '/' },
            { label: 'Gestión académica' },
            { label: 'Grupos' },
          ]}
        />
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para gestionar grupos."
          icon={<GroupIcon />}
        />
      </Box>
    );
  }

  const columnas: DataTableColumn<GrupoDto>[] = [
    {
      id: 'codigo',
      label: 'Código',
      minWidth: 120,
      render: (grupo) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {grupo.codigo}
        </Typography>
      ),
    },
    {
      id: 'programa',
      label: 'Programa',
      minWidth: 180,
      render: (grupo) => nombrePrograma.get(grupo.programaId) ?? '—',
    },
    { id: 'periodo', label: 'Periodo', minWidth: 110, render: (grupo) => grupo.periodo },
    {
      id: 'cupoMaximo',
      label: 'Cupo máximo',
      minWidth: 120,
      align: 'right',
      render: (grupo) => grupo.cupoMaximo,
    },
    {
      id: 'salon',
      label: 'Salón',
      minWidth: 110,
      render: (grupo) => grupo.salon ?? '—',
    },
    {
      id: 'educadorId',
      label: 'ID del educador',
      minWidth: 220,
      render: (grupo) => (
        <Typography variant="caption" color="text.secondary">
          {grupo.educadorId}
        </Typography>
      ),
    },
    {
      id: 'estado',
      label: 'Estado',
      minWidth: 120,
      render: (grupo) => <StatusChip status={grupo.estado} />,
    },
    {
      id: 'acciones',
      label: 'Acciones',
      align: 'right',
      minWidth: 110,
      render: (grupo) =>
        grupo.estado === 'abierto' ? (
          <Button
            size="small"
            startIcon={<LockIcon fontSize="small" />}
            onClick={() => setGrupoTransicion(grupo)}
            disabled={procesandoTransicion || cargando}
          >
            Cerrar
          </Button>
        ) : null,
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Grupos"
        description="Administración de los grupos por programa, periodo, cupo y educador asignado."
        icon={<GroupIcon />}
        breadcrumbs={[
          { label: 'Inicio', to: '/' },
          { label: 'Gestión académica' },
          { label: 'Grupos' },
        ]}
        actions={
          <>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => void cargarGrupos()}
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
              Nuevo grupo
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
          label="Total de grupos"
          value={grupos.length}
          icon={<GroupIcon />}
          description="Registros consultados"
        />
        <StatCard
          label="Abiertos"
          value={abiertos}
          icon={<GroupIcon />}
          description="Disponibles para matrícula"
        />
        <StatCard
          label="Cerrados"
          value={cerrados}
          icon={<LockIcon />}
          description="Sin nuevas matrículas"
        />
      </Box>

      <SectionCard
        title="Listado de grupos"
        subtitle="Consulta, filtra y cierra los grupos registrados"
      >
        {error && grupos.length === 0 ? (
          <ErrorState message={error} onRetry={() => void cargarGrupos()} />
        ) : cargando && grupos.length === 0 ? (
          <LoadingState label="Cargando grupos…" />
        ) : (
          <>
            <SearchToolbar
              value={busqueda}
              onChange={setBusqueda}
              label="Buscar grupo"
              placeholder="Código, programa, periodo, salón o ID del educador"
              resultCount={filtrados.length}
              filters={
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="filtro-estado-grupo-label">Estado</InputLabel>
                  <Select
                    labelId="filtro-estado-grupo-label"
                    label="Estado"
                    value={filtro}
                    onChange={(event) => setFiltro(event.target.value)}
                  >
                    <MenuItem value="todos">Todos</MenuItem>
                    <MenuItem value="abierto">Abierto</MenuItem>
                    <MenuItem value="cerrado">Cerrado</MenuItem>
                  </Select>
                </FormControl>
              }
            />
            {filtrados.length === 0 && !cargando ? (
              <EmptyState
                title={grupos.length === 0 ? 'Sin grupos registrados' : 'Sin coincidencias'}
                description={
                  grupos.length === 0
                    ? 'Cuando registres un grupo aparecerá en este listado.'
                    : 'Prueba con otro código, programa o periodo.'
                }
                minHeight={180}
              />
            ) : (
              <DataTable
                ariaLabel="Listado de grupos"
                columns={columnas}
                rows={gruposPagina}
                rowKey={(grupo) => grupo.id}
                loading={cargando}
                page={pagina}
                pageSize={tamanoPagina}
                total={filtrados.length}
                onPageChange={setPagina}
                onPageSizeChange={setTamanoPagina}
                emptyMessage="No hay grupos para mostrar."
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
        aria-labelledby="titulo-crear-grupo"
      >
        <DialogTitle id="titulo-crear-grupo">Nuevo grupo</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DialogContentText>Asigna el grupo a un programa existente.</DialogContentText>
          <TextField
            id="codigo-grupo"
            label="Código del grupo (ej. G-01)"
            value={formulario.codigo}
            onChange={(event) => actualizarCampo('codigo', event.target.value)}
            error={Boolean(errores.codigo)}
            helperText={errores.codigo}
            required
            fullWidth
          />
          <FormControl fullWidth error={Boolean(errores.programaId)}>
            <InputLabel id="programa-grupo-label">Programa</InputLabel>
            <Select
              labelId="programa-grupo-label"
              label="Programa"
              value={formulario.programaId}
              onChange={(event) => actualizarCampo('programaId', event.target.value)}
            >
              <MenuItem value="">Selecciona un programa</MenuItem>
              {programas.map((programa) => (
                <MenuItem key={programa.id} value={programa.id}>
                  {programa.nombre}
                </MenuItem>
              ))}
            </Select>
            {errores.programaId && <FormHelperText>{errores.programaId}</FormHelperText>}
          </FormControl>
          <TextField
            id="educador-grupo"
            label="ID del educador (UUID)"
            value={formulario.educadorId}
            onChange={(event) => actualizarCampo('educadorId', event.target.value)}
            error={Boolean(errores.educadorId)}
            helperText={errores.educadorId}
            required
            fullWidth
          />
          <TextField
            id="periodo-grupo"
            label="Periodo (ej. 2026-1)"
            value={formulario.periodo}
            onChange={(event) => actualizarCampo('periodo', event.target.value)}
            error={Boolean(errores.periodo)}
            helperText={errores.periodo}
            required
            fullWidth
          />
          <TextField
            id="salon-grupo"
            label="Salón (opcional)"
            value={formulario.salon}
            onChange={(event) => actualizarCampo('salon', event.target.value)}
            fullWidth
          />
          <TextField
            id="cupo-grupo"
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
            {enviando ? 'Creando…' : 'Crear grupo'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(grupoTransicion)}
        title="Cerrar grupo"
        description={
          grupoTransicion
            ? `¿Cerrar el grupo "${grupoTransicion.codigo}"? No aceptará nuevas matrículas.`
            : ''
        }
        confirmLabel="Cerrar grupo"
        destructive
        loading={procesandoTransicion}
        onConfirm={() => void cerrarGrupo()}
        onCancel={() => {
          if (!procesandoTransicion) setGrupoTransicion(null);
        }}
      />
    </Box>
  );
}
