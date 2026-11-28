import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  ContentCopy as ContentCopyIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { apiClient, useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type {
  AdminUserDto,
  AssignProfileDto,
  CreateUserDto,
  TransitionDto,
  UpdateUserDto,
  UserEstado,
} from '../api/client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import SearchToolbar from '../components/common/SearchToolbar';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

/** Catálogo sembrado: no existe todavía un endpoint para listar perfiles. */
const PERFILES = ['administrador', 'educador', 'estudiante'] as const;
const ESTADOS: readonly UserEstado[] = ['activo', 'inactivo', 'bloqueado'];
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

type Dialogo = 'crear' | 'editar' | 'estado' | 'perfil' | null;
type FiltroEstado = UserEstado | 'todos';
type Formulario = {
  email: string;
  nombre: string;
  password: string;
  estado: UserEstado;
  perfil: string;
  validUntil: string;
  resetMfa: boolean;
  motivo: string;
};

const FORMULARIO_VACIO: Formulario = {
  email: '',
  nombre: '',
  password: '',
  estado: 'activo',
  perfil: 'estudiante',
  validUntil: '',
  resetMfa: false,
  motivo: '',
};

function aIsoLocal(valor: string): string | undefined {
  return valor ? new Date(valor).toISOString() : undefined;
}

function formatearFecha(valor: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(valor),
  );
}

export default function Admin() {
  const { hasPermission } = useAuth();
  const theme = useTheme();
  const pantallaPequena = useMediaQuery(theme.breakpoints.down('sm'));
  const puedeGestionar = hasPermission('identity:user:manage');

  const [usuarios, setUsuarios] = useState<AdminUserDto[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [tamanoPagina, setTamanoPagina] = useState(10);
  const [offset, setOffset] = useState(0);

  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [seleccionado, setSeleccionado] = useState<AdminUserDto | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof Formulario, string>>>({});
  const [enviando, setEnviando] = useState(false);

  const cargarUsuarios = useCallback(async () => {
    if (!puedeGestionar) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/identity/users', {
        params: {
          query: {
            ...(busqueda.trim() ? { search: busqueda.trim() } : {}),
            ...(filtroEstado !== 'todos' ? { estado: filtroEstado } : {}),
            limit: tamanoPagina,
            offset,
          },
        },
      });
      if (apiError || !data) {
        setError(getErrorMessage(apiError) || 'No se pudieron cargar los usuarios.');
        return;
      }
      setUsuarios(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar los usuarios.');
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar, busqueda, filtroEstado, tamanoPagina, offset]);

  useEffect(() => {
    setOffset(0);
  }, [busqueda, filtroEstado, tamanoPagina]);

  useEffect(() => {
    const temporizador = setTimeout(() => void cargarUsuarios(), 250);
    return () => clearTimeout(temporizador);
  }, [cargarUsuarios]);

  const actualizarCampo = (campo: keyof Formulario, valor: string | boolean) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: undefined }));
  };

  const abrirDialogo = (tipo: Exclude<Dialogo, null>, usuario: AdminUserDto | null = null) => {
    setSeleccionado(usuario);
    setDialogo(tipo);
    setErrores({});
    setFormulario({
      ...FORMULARIO_VACIO,
      nombre: usuario?.nombre ?? '',
      estado: usuario?.estado ?? 'activo',
    });
  };

  const cerrarDialogo = () => {
    setDialogo(null);
    setSeleccionado(null);
    setFormulario(FORMULARIO_VACIO);
    setErrores({});
  };

  const copiarUid = async (uid: string) => {
    try {
      await navigator.clipboard.writeText(uid);
      setExito('UID copiado al portapapeles.');
    } catch {
      setError('No se pudo copiar el UID. Cópialo manualmente.');
    }
  };

  const validar = (): boolean => {
    const nuevosErrores: Partial<Record<keyof Formulario, string>> = {};
    const longitud = [...formulario.password].length;
    const passwordInvalida =
      longitud > 0 && (longitud < PASSWORD_MIN_LENGTH || longitud > PASSWORD_MAX_LENGTH);

    if (dialogo === 'crear') {
      if (!formulario.email.trim()) nuevosErrores.email = 'Ingresa el correo electrónico.';
      if (!formulario.nombre.trim()) nuevosErrores.nombre = 'Ingresa el nombre.';
      if (!formulario.password) nuevosErrores.password = 'Ingresa la contraseña inicial.';
      else if (passwordInvalida)
        nuevosErrores.password = `Debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`;
      if (!formulario.perfil) nuevosErrores.perfil = 'Selecciona un perfil.';
    }
    if (dialogo === 'editar' && passwordInvalida) {
      nuevosErrores.password = `Debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`;
    }
    if (dialogo === 'estado' && !formulario.estado) {
      nuevosErrores.estado = 'Selecciona el estado destino.';
    }
    if (dialogo === 'perfil' && !formulario.perfil) {
      nuevosErrores.perfil = 'Selecciona un perfil.';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const guardar = async () => {
    if (!dialogo || !validar()) return;
    setEnviando(true);
    setError(null);
    setExito(null);

    const validUntil = aIsoLocal(formulario.validUntil);
    try {
      if (dialogo === 'crear') {
        const body: CreateUserDto = {
          email: formulario.email.trim().toLowerCase(),
          nombre: formulario.nombre.trim(),
          password: formulario.password,
          estado: formulario.estado,
          profiles: [{ codigo: formulario.perfil, ...(validUntil ? { validUntil } : {}) }],
        };
        const {
          data,
          error: apiError,
          response,
        } = await apiClient.POST('/identity/users', { body });
        if (apiError || !data || response?.status !== 201) {
          setError(getErrorMessage(apiError) || 'No se pudo crear el usuario.');
          return;
        }
        setExito(`Usuario "${data.email}" creado correctamente.`);
      } else if (!seleccionado) {
        setError('Selecciona un usuario antes de continuar.');
        return;
      } else if (dialogo === 'editar') {
        const body: UpdateUserDto = {
          ...(formulario.nombre.trim() ? { nombre: formulario.nombre.trim() } : {}),
          ...(formulario.password ? { password: formulario.password } : {}),
          resetMfa: formulario.resetMfa,
        };
        const { data, error: apiError } = await apiClient.PATCH('/identity/users/{id}', {
          params: { path: { id: seleccionado.id } },
          body,
        });
        if (apiError || !data) {
          setError(getErrorMessage(apiError) || 'No se pudo actualizar el usuario.');
          return;
        }
        setExito(`Usuario "${data.email}" actualizado correctamente.`);
      } else if (dialogo === 'estado') {
        const body: TransitionDto = {
          to: formulario.estado,
          ...(formulario.motivo.trim() ? { motivo: formulario.motivo.trim() } : {}),
        };
        const { data, error: apiError } = await apiClient.POST('/identity/users/{id}/transitions', {
          params: { path: { id: seleccionado.id } },
          body,
        });
        if (apiError || !data) {
          setError(getErrorMessage(apiError) || 'No se pudo cambiar el estado.');
          return;
        }
        setExito(`Estado de "${data.email}" cambiado a ${formulario.estado}.`);
      } else {
        const body: AssignProfileDto = {
          codigo: formulario.perfil,
          ...(validUntil ? { validUntil } : {}),
        };
        const {
          data,
          error: apiError,
          response,
        } = await apiClient.POST('/identity/users/{id}/profiles', {
          params: { path: { id: seleccionado.id } },
          body,
        });
        if (apiError || !data || response?.status !== 201) {
          setError(getErrorMessage(apiError) || 'No se pudo asignar el perfil.');
          return;
        }
        setExito(`Perfil "${formulario.perfil}" asignado a "${seleccionado.email}".`);
      }
      cerrarDialogo();
      await cargarUsuarios();
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al gestionar el usuario.');
    } finally {
      setEnviando(false);
    }
  };

  if (!puedeGestionar) {
    return (
      <EmptyState
        title="Sin permisos"
        description="No tienes permiso para acceder a la administración de usuarios (identity:user:manage)."
        icon={<AdminPanelSettingsIcon />}
      />
    );
  }

  const columnas: DataTableColumn<AdminUserDto>[] = [
    {
      id: 'correo',
      label: 'Correo y nombre',
      minWidth: 220,
      render: (usuario) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {usuario.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {usuario.nombre}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'uid',
      label: 'UID',
      minWidth: 250,
      render: (usuario) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere', flex: 1 }}
          >
            {usuario.id}
          </Typography>
          <Tooltip title="Copiar UID">
            <IconButton
              size="small"
              aria-label={`Copiar UID de ${usuario.email}`}
              onClick={() => void copiarUid(usuario.id)}
            >
              <ContentCopyIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
    { id: 'estado', label: 'Estado', render: (usuario) => <StatusChip status={usuario.estado} /> },
    {
      id: 'mfa',
      label: 'MFA',
      render: (usuario) => (
        <StatusChip
          status={usuario.mfaHabilitado ? 'activo' : 'inactivo'}
          label={usuario.mfaHabilitado ? 'Activo' : 'Sin activar'}
        />
      ),
    },
    {
      id: 'cambio',
      label: 'Cambio de contraseña',
      render: (usuario) => (
        <StatusChip
          status={usuario.debeCambiarPassword ? 'pendiente' : 'activo'}
          label={usuario.debeCambiarPassword ? 'Pendiente' : 'Al día'}
        />
      ),
    },
    {
      id: 'creado',
      label: 'Creado',
      minWidth: 170,
      render: (usuario) => formatearFecha(usuario.creadoEn),
    },
    {
      id: 'acciones',
      label: 'Acciones',
      align: 'right',
      render: (usuario) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => abrirDialogo('editar', usuario)}>
            Editar
          </Button>
          <Button size="small" onClick={() => abrirDialogo('estado', usuario)}>
            Cambiar estado
          </Button>
          <Button size="small" onClick={() => abrirDialogo('perfil', usuario)}>
            Asignar perfil
          </Button>
        </Box>
      ),
    },
  ];

  const tituloDialogo: Record<Exclude<Dialogo, null>, string> = {
    crear: 'Nuevo usuario',
    editar: 'Editar usuario',
    estado: 'Cambiar estado',
    perfil: 'Asignar perfil',
  };
  const textoBoton: Record<Exclude<Dialogo, null>, string> = {
    crear: 'Crear usuario',
    editar: 'Guardar cambios',
    estado: 'Aplicar estado',
    perfil: 'Asignar perfil',
  };

  return (
    <Box>
      <PageHeader
        title="Administración"
        description="Gestión de usuarios y perfiles del centro cultural."
        icon={<AdminPanelSettingsIcon />}
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Administración' }]}
        actions={
          <>
            <Button component={RouterLink} to="/" startIcon={<HomeIcon />} disabled={enviando}>
              Ir al inicio
            </Button>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => void cargarUsuarios()}
              disabled={cargando || enviando}
            >
              Actualizar listado
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => abrirDialogo('crear')}
              disabled={enviando}
            >
              Nuevo usuario
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

      <SectionCard
        title="Usuarios"
        subtitle="Consulta, filtra y gestiona las identidades registradas"
      >
        {error && usuarios.length === 0 ? (
          <ErrorState message={error} onRetry={() => void cargarUsuarios()} />
        ) : cargando && usuarios.length === 0 ? (
          <LoadingState label="Cargando usuarios…" />
        ) : (
          <>
            <SearchToolbar
              value={busqueda}
              onChange={setBusqueda}
              label="Buscar usuario"
              placeholder="Correo electrónico o nombre"
              resultCount={total}
              filters={
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="filtro-estado-usuario-label">Estado</InputLabel>
                  <Select
                    labelId="filtro-estado-usuario-label"
                    label="Estado"
                    value={filtroEstado}
                    onChange={(event) => setFiltroEstado(event.target.value)}
                  >
                    <MenuItem value="todos">Todos</MenuItem>
                    {ESTADOS.map((estado) => (
                      <MenuItem key={estado} value={estado}>
                        {estado}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              }
            />
            <DataTable
              ariaLabel="Listado de usuarios"
              columns={columnas}
              rows={usuarios}
              rowKey={(usuario) => usuario.id}
              loading={cargando}
              page={Math.floor(offset / tamanoPagina)}
              pageSize={tamanoPagina}
              total={total}
              onPageChange={(pagina) => setOffset(pagina * tamanoPagina)}
              onPageSizeChange={(tamano) => setTamanoPagina(tamano)}
              emptyMessage="No hay usuarios para mostrar."
            />
          </>
        )}
      </SectionCard>

      <Dialog
        open={dialogo !== null}
        onClose={cerrarDialogo}
        maxWidth="md"
        fullWidth
        fullScreen={pantallaPequena}
        aria-labelledby="titulo-dialogo-usuario"
        slotProps={{ paper: { sx: { borderRadius: pantallaPequena ? 0 : 2 } } }}
      >
        <DialogTitle id="titulo-dialogo-usuario" sx={{ pb: 1 }}>
          {dialogo ? tituloDialogo[dialogo] : ''}
          {seleccionado && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {seleccionado.email}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 3, py: 2, minWidth: 0 }}
        >
          {dialogo === 'crear' && (
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <TextField
                id="correo-nuevo-usuario"
                label="Correo electrónico"
                type="email"
                value={formulario.email}
                onChange={(event) => actualizarCampo('email', event.target.value)}
                error={Boolean(errores.email)}
                helperText={errores.email}
                required
                fullWidth
              />
              <TextField
                id="nombre-nuevo-usuario"
                label="Nombre"
                value={formulario.nombre}
                onChange={(event) => actualizarCampo('nombre', event.target.value)}
                error={Boolean(errores.nombre)}
                helperText={errores.nombre}
                required
                fullWidth
              />
              <TextField
                id="password-nuevo-usuario"
                label="Contraseña inicial"
                type="password"
                autoComplete="new-password"
                value={formulario.password}
                onChange={(event) => actualizarCampo('password', event.target.value)}
                error={Boolean(errores.password)}
                helperText={
                  errores.password ??
                  `Entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres; se exigirá el cambio.`
                }
                required
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="estado-nuevo-usuario-label">Estado inicial</InputLabel>
                <Select
                  labelId="estado-nuevo-usuario-label"
                  label="Estado inicial"
                  value={formulario.estado}
                  onChange={(event) => actualizarCampo('estado', event.target.value)}
                >
                  {ESTADOS.map((estado) => (
                    <MenuItem key={estado} value={estado}>
                      {estado}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {dialogo === 'editar' && (
            <>
              <TextField
                id="nombre-editar-usuario"
                label="Nombre"
                value={formulario.nombre}
                onChange={(event) => actualizarCampo('nombre', event.target.value)}
                fullWidth
              />
              <TextField
                id="password-editar-usuario"
                label="Nueva contraseña (opcional)"
                type="password"
                autoComplete="new-password"
                value={formulario.password}
                onChange={(event) => actualizarCampo('password', event.target.value)}
                error={Boolean(errores.password)}
                helperText={
                  errores.password ??
                  `Si la diligencia, debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`
                }
                fullWidth
              />
              <FormControl>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formulario.resetMfa}
                      onChange={(event) => actualizarCampo('resetMfa', event.target.checked)}
                    />
                  }
                  label="Resetear MFA del usuario"
                />
              </FormControl>
            </>
          )}

          {dialogo === 'estado' && (
            <>
              <FormControl fullWidth error={Boolean(errores.estado)}>
                <InputLabel id="estado-destino-label">Estado destino</InputLabel>
                <Select
                  labelId="estado-destino-label"
                  label="Estado destino"
                  value={formulario.estado}
                  onChange={(event) => actualizarCampo('estado', event.target.value)}
                >
                  {ESTADOS.map((estado) => (
                    <MenuItem key={estado} value={estado}>
                      {estado}
                    </MenuItem>
                  ))}
                </Select>
                {errores.estado && <FormHelperText>{errores.estado}</FormHelperText>}
              </FormControl>
              <TextField
                id="motivo-estado-usuario"
                label="Motivo (opcional)"
                value={formulario.motivo}
                onChange={(event) => actualizarCampo('motivo', event.target.value)}
                fullWidth
              />
            </>
          )}

          {(dialogo === 'crear' || dialogo === 'perfil') && (
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <FormControl fullWidth error={Boolean(errores.perfil)}>
                <InputLabel id="perfil-usuario-label">Perfil</InputLabel>
                <Select
                  labelId="perfil-usuario-label"
                  label="Perfil"
                  value={formulario.perfil}
                  onChange={(event) => actualizarCampo('perfil', event.target.value)}
                >
                  {PERFILES.map((perfil) => (
                    <MenuItem key={perfil} value={perfil}>
                      {perfil}
                    </MenuItem>
                  ))}
                </Select>
                {errores.perfil && <FormHelperText>{errores.perfil}</FormHelperText>}
              </FormControl>
              <TextField
                id="vigencia-perfil-usuario"
                label="Vigencia del perfil (opcional)"
                type="datetime-local"
                value={formulario.validUntil}
                onChange={(event) => actualizarCampo('validUntil', event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              {dialogo === 'crear' && formulario.perfil === 'estudiante' && (
                <Typography variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1' }}>
                  Para matricularlo, crea también su ficha en Gestión académica › Estudiantes y
                  selecciona este UID como usuario asociado. El perfil por sí solo no crea ficha
                  académica.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={cerrarDialogo} disabled={enviando} sx={{ minWidth: 110 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void guardar()}
            disabled={enviando}
            sx={{ minWidth: 140 }}
          >
            {enviando ? 'Guardando…' : dialogo ? textoBoton[dialogo] : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
