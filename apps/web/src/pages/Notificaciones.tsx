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
  Typography,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  MarkEmailRead as MarkEmailReadIcon,
  Refresh as RefreshIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import type { NotificacionDto } from '../api/client';

const ESTADO_CONFIG: Record<string, { color: 'success' | 'error' | 'warning' | 'info'; icon: React.ReactNode }> = {
  pendiente: { color: 'warning', icon: <PendingIcon fontSize="small" /> },
  enviada: { color: 'info', icon: <CheckCircleIcon fontSize="small" /> },
  leida: { color: 'success', icon: <MarkEmailReadIcon fontSize="small" /> },
  fallida: { color: 'error', icon: <ErrorIcon fontSize="small" /> },
};

export default function Notificaciones() {
  const { hasPermission } = useAuth();
  const [notificaciones, setNotificaciones] = useState<NotificacionDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'leidas' | 'noLeidas'>('todos');

  const puedeLeer = hasPermission('notifications:notification:read_own');
  const puedeMarcar = hasPermission('notifications:notification:update_own');

  const cargarNotificaciones = useCallback(async () => {
    if (!puedeLeer) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/notifications');
      if (apiError || !data) {
        setError('No se pudieron cargar las notificaciones');
        return;
      }
      setNotificaciones(data as NotificacionDto[]);
    } catch (err: any) {
      setError(err.message || 'Error al cargar notificaciones');
    } finally {
      setCargando(false);
    }
  }, [puedeLeer]);

  useEffect(() => {
    void cargarNotificaciones();
  }, [cargarNotificaciones]);

  const manejarMarcarLeida = async (id: string) => {
    if (!puedeMarcar) return;
    setCargando(true);
    try {
      const { data, error: apiError } = (await apiClient.PATCH(
        '/notifications/{id}' as any,
        { params: { path: { id } }, body: { leida: true } }
      )) as any;
      if (apiError || !data) {
        setError('No se pudo marcar como leída');
        return;
      }
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, estado: 'leida', leidaEn: new Date().toISOString() } : n))
      );
    } catch (err: any) {
      setError(err.message || 'Error al marcar como leída');
    } finally {
      setCargando(false);
    }
  };

  const notificacionesFiltradas = notificaciones.filter((n) => {
    if (filtroEstado === 'leidas') return n.estado === 'leida';
    if (filtroEstado === 'noLeidas') return n.estado !== 'leida';
    return true;
  });

  const noLeidasCount = notificaciones.filter((n) => n.estado !== 'leida').length;

  if (!puedeLeer) {
    return (
      <Box sx={{ p: 3, minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <NotificationsIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Notificaciones</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para ver notificaciones.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h1">Mis notificaciones</Typography>
        {noLeidasCount > 0 && (
          <Chip label={`${noLeidasCount} nuevas`} color="primary" size="small" variant="outlined" />
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <Typography variant="h2" sx={{ mb: 1 }}>
          Estado
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant={filtroEstado === 'todos' ? 'outlined' : 'text'}
            onClick={() => setFiltroEstado('todos')}
          >
            Todos
          </Button>
          <Button
            size="small"
            variant={filtroEstado === 'leidas' ? 'outlined' : 'text'}
            onClick={() => setFiltroEstado('leidas')}
          >
            Leídas
          </Button>
          <Button
            size="small"
            variant={filtroEstado === 'noLeidas' ? 'outlined' : 'text'}
            onClick={() => setFiltroEstado('noLeidas')}
          >
            No leídas
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            size="small"
            disabled={cargando}
            onClick={cargarNotificaciones}
          >
            {cargando ? (
              <CircularProgress size={20} aria-label="Cargando notificaciones" />
            ) : (
              'Actualizar'
            )}
          </Button>
        </Box>
      </Box>

      {notificacionesFiltradas.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <NotificationsIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="body1">No hay notificaciones.</Typography>
        </Paper>
      )}

      {notificacionesFiltradas.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Evento</TableCell>
                <TableCell>Canal</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {notificacionesFiltradas.map((n) => {
                const cfg = ESTADO_CONFIG[n.estado];
                const puedeMarcarLeida = n.estado !== 'leida' && puedeMarcar;
                return (
                  <TableRow key={n.id}>
                    <TableCell>{n.evento}</TableCell>
                    <TableCell>
                      <Chip label={n.canal} size="small" color="default" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {cfg.icon}
                        <Chip label={n.estado} size="small" color={cfg.color} />
                      </Box>
                    </TableCell>
                    <TableCell>
                      {n.creadoEn ? new Date(n.creadoEn).toLocaleString('es-CO') : '-'}
                    </TableCell>
                    <TableCell>
                      {puedeMarcarLeida ? (
                        <Button
                          size="small"
                          startIcon={<CheckCircleIcon fontSize="small" />}
                          onClick={() => void manejarMarcarLeida(n.id)}
                          disabled={cargando}
                        >
                          Marcar leída
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
