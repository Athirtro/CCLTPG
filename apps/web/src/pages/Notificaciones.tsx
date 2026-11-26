import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import {
  Home as HomeIcon,
  MarkEmailRead as MarkEmailReadIcon,
  Notifications as NotificationsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { NotificacionDto } from '../api/client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatCard from '../components/common/StatCard';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import SearchToolbar from '../components/common/SearchToolbar';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

type FiltroLectura = 'todos' | 'leidas' | 'noLeidas';

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleString('es-CO');
}

export default function Notificaciones() {
  const { hasPermission } = useAuth();
  const [notificaciones, setNotificaciones] = useState<NotificacionDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroLectura>('todos');
  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  const puedeLeer = hasPermission('notifications:notification:read_own');
  const puedeMarcar = hasPermission('notifications:notification:update_own');

  const cargarNotificaciones = useCallback(async () => {
    if (!puedeLeer) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/notifications');
      if (apiError || !data) {
        setError('No se pudieron cargar las notificaciones.');
        return;
      }
      setNotificaciones(data.items);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar notificaciones.');
    } finally {
      setCargando(false);
    }
  }, [puedeLeer]);

  useEffect(() => {
    void cargarNotificaciones();
  }, [cargarNotificaciones]);

  const manejarMarcarLeida = async (notificacion: NotificacionDto) => {
    if (!puedeMarcar) return;
    setMarcandoId(notificacion.id);
    setError(null);
    setExito(null);
    try {
      const { data, error: apiError } = await apiClient.PATCH('/notifications/{id}', {
        params: { path: { id: notificacion.id } },
        body: { leida: true },
      });
      if (apiError || !data) {
        setError('No se pudo marcar la notificación como leída.');
        return;
      }
      setNotificaciones((prev) =>
        prev.map((n) =>
          n.id === data.id ? { ...n, estado: 'leida', leidaEn: new Date().toISOString() } : n,
        ),
      );
      setExito(`Notificación "${notificacion.asunto ?? notificacion.evento}" marcada como leída.`);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al marcar la notificación como leída.');
    } finally {
      setMarcandoId(null);
    }
  };

  const noLeidas = useMemo(
    () => notificaciones.filter((n) => n.estado !== 'leida').length,
    [notificaciones],
  );

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es');
    return notificaciones.filter((n) => {
      const coincide =
        !texto ||
        `${n.evento} ${n.asunto ?? ''} ${n.cuerpo ?? ''}`.toLocaleLowerCase('es').includes(texto);
      const porEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'leidas' ? n.estado === 'leida' : n.estado !== 'leida');
      return coincide && porEstado;
    });
  }, [notificaciones, busqueda, filtroEstado]);

  const columnas: DataTableColumn<NotificacionDto>[] = [
    {
      id: 'contenido',
      label: 'Notificación',
      minWidth: 240,
      render: (n) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: n.estado === 'leida' ? 400 : 600 }}>
            {n.asunto ?? n.evento}
          </Typography>
          {n.cuerpo && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {n.cuerpo}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: 'evento',
      label: 'Tipo / evento',
      minWidth: 160,
      render: (n) => <StatusChip status="primary" label={n.evento} />,
    },
    {
      id: 'canal',
      label: 'Canal',
      minWidth: 100,
      render: (n) => <StatusChip status="neutral" label={n.canal.toUpperCase()} />,
    },
    {
      id: 'estado',
      label: 'Estado',
      minWidth: 120,
      render: (n) => <StatusChip status={n.estado} />,
    },
    {
      id: 'fecha',
      label: 'Fecha',
      minWidth: 180,
      render: (n) => (
        <Box>
          <Typography variant="body2">{formatearFecha(n.creadoEn)}</Typography>
          {n.leidaEn && (
            <Typography variant="caption" color="text.secondary">
              Leída: {formatearFecha(n.leidaEn)}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: 'acciones',
      label: 'Acciones',
      align: 'right',
      minWidth: 150,
      render: (n) =>
        n.estado !== 'leida' && puedeMarcar ? (
          <Button
            size="small"
            startIcon={<MarkEmailReadIcon />}
            onClick={() => void manejarMarcarLeida(n)}
            disabled={marcandoId === n.id}
          >
            {marcandoId === n.id ? 'Marcando…' : 'Marcar leída'}
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {n.estado === 'leida' ? 'Ya leída' : 'Sin permiso'}
          </Typography>
        ),
    },
  ];

  const cabecera = (
    <PageHeader
      title="Mis notificaciones"
      description="Notificaciones asociadas a tu cuenta, con filtros locales por estado de lectura."
      icon={<NotificationsIcon />}
      breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Notificaciones' }]}
      actions={
        puedeLeer ? (
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void cargarNotificaciones()}
            disabled={cargando}
          >
            Actualizar
          </Button>
        ) : (
          <Button component={RouterLink} to="/" startIcon={<HomeIcon />}>
            Ir al inicio
          </Button>
        )
      }
    />
  );

  if (!puedeLeer) {
    return (
      <Box>
        {cabecera}
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para consultar tus notificaciones (notifications:notification:read_own)."
          icon={<NotificationsIcon />}
        />
      </Box>
    );
  }

  return (
    <Box>
      {cabecera}

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
          label="Total de notificaciones"
          value={notificaciones.length}
          icon={<NotificationsIcon />}
          description="Registros devueltos por el servicio"
        />
        <StatCard
          label="No leídas"
          value={noLeidas}
          icon={<MarkEmailReadIcon />}
          description="Pendientes de lectura"
          status={{ label: 'Pendientes', tone: 'warning' }}
        />
        <StatCard
          label="Leídas"
          value={notificaciones.length - noLeidas}
          icon={<MarkEmailReadIcon />}
          description="Consultadas por ti"
          status={{ label: 'Leídas', tone: 'success' }}
        />
      </Box>

      <SectionCard
        title="Bandeja de notificaciones"
        subtitle="Evento, canal, estado, fecha y contenido"
      >
        {cargando && notificaciones.length === 0 ? (
          <LoadingState label="Cargando notificaciones…" />
        ) : error && notificaciones.length === 0 ? (
          <ErrorState message={error} onRetry={() => void cargarNotificaciones()} />
        ) : notificaciones.length === 0 ? (
          <EmptyState
            title="No hay notificaciones"
            description="Cuando recibas notificaciones aparecerán en esta bandeja."
            icon={<NotificationsIcon />}
          />
        ) : (
          <>
            <SearchToolbar
              value={busqueda}
              onChange={setBusqueda}
              label="Buscar notificación"
              placeholder="Evento, asunto o contenido"
              resultCount={filtradas.length}
              filters={
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="filtro-lectura-label">Estado de lectura</InputLabel>
                  <Select
                    labelId="filtro-lectura-label"
                    label="Estado de lectura"
                    value={filtroEstado}
                    onChange={(event) => setFiltroEstado(event.target.value)}
                  >
                    <MenuItem value="todos">Todos</MenuItem>
                    <MenuItem value="leidas">Leídas</MenuItem>
                    <MenuItem value="noLeidas">No leídas</MenuItem>
                  </Select>
                </FormControl>
              }
            />
            {filtradas.length === 0 ? (
              <EmptyState
                title="Sin coincidencias"
                description="Prueba con otro texto o cambia el filtro de estado de lectura."
                minHeight={180}
              />
            ) : (
              <DataTable
                ariaLabel="Listado de notificaciones"
                columns={columnas}
                rows={filtradas}
                rowKey={(n) => n.id}
                loading={cargando}
              />
            )}
          </>
        )}
      </SectionCard>
    </Box>
  );
}
