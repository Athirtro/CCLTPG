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
  CircularProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  ToggleOn as ToggleOnIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import type { PreferenciaNotificacionDto, ActualizarPreferenciaDto } from '../api/client';

export default function Preferencias() {
  const { hasPermission } = useAuth();
  const [preferencias, setPreferencias] = useState<PreferenciaNotificacionDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const puedeLeer = hasPermission('notifications:preference:read_own');
  const puedeActualizar = hasPermission('notifications:preference:update_own');

  const cargarPreferencias = useCallback(async () => {
    if (!puedeLeer) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/notifications/preferences');
      if (apiError || !data) {
        setError('No se pudieron cargar las preferencias');
        return;
      }
      setPreferencias(data as PreferenciaNotificacionDto[]);
    } catch (err: any) {
      setError(err.message || 'Error al cargar preferencias');
    } finally {
      setCargando(false);
    }
  }, [puedeLeer]);

  useEffect(() => {
    void cargarPreferencias();
  }, [cargarPreferencias]);

  const manejarCambio = (evento: string, canal: string, habilitado: boolean) => {
    setPreferencias((prev) =>
      prev.map((p) =>
        p.evento === evento && p.canal === canal ? { ...p, habilitado } : p
      )
    );
  };

  const guardarPreferencias = async () => {
    if (!puedeActualizar) return;
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      const payload: ActualizarPreferenciaDto[] = preferencias.map((p) => ({
        evento: p.evento,
        canal: p.canal as 'app' | 'email',
        habilitado: p.habilitado,
      }));
      const { data, error: apiError, response } = await apiClient.PUT(
        '/notifications/preferences',
        { body: payload }
      );
      if (apiError || response?.status !== 200) {
        setError('No se pudieron guardar las preferencias');
        return;
      }
      setExito('Preferencias guardadas correctamente');
      setPreferencias(data as PreferenciaNotificacionDto[]);
    } catch (err: any) {
      setError(err.message || 'Error al guardar preferencias');
    } finally {
      setGuardando(false);
    }
  };

  const canales: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: 'app', label: 'App', icon: <ToggleOnIcon fontSize="small" /> },
    { id: 'email', label: 'Correo electrónico', icon: <EmailIcon fontSize="small" /> },
  ];

  const eventos = [
    ...new Set(preferencias.map((p) => p.evento)),
  ];

  if (!puedeLeer && !puedeActualizar) {
    return (
      <Box sx={{ p: 3, minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <NotificationsIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Preferencias de notificación</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para ver ni editar preferencias de notificación.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Preferencias de notificación</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Elige qué notificaciones recibir y por qué canal. Las notificaciones críticas no se pueden silenciar.
      </Typography>

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

      {!puedeLeer && (
        <Alert severity="warning">
          No tienes permiso para leer preferencias.
        </Alert>
      )}

      {preferencias.length === 0 && !cargando && (
        <Paper sx={{ p: 4, textAlign: 'center', minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <NotificationsIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="body1">No hay preferencias configuradas.</Typography>
        </Paper>
      )}

      {preferencias.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Evento</TableCell>
                  {canales.map((c) => (
                    <TableCell key={c.id} sx={{ textAlign: 'center' }}>
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {eventos.map((evento) => {
                  const prefsEvento = preferencias.filter((p) => p.evento === evento);
                  return (
                    <TableRow key={evento}>
                      <TableCell sx={{ fontWeight: 'medium' }}>{evento}</TableCell>
                      {canales.map((c) => {
                        const pref = prefsEvento.find((p) => p.canal === c.id);
                        const habilitado = pref?.habilitado ?? false;
                        return (
                          <TableCell key={c.id} sx={{ textAlign: 'center' }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={habilitado}
                                  onChange={() => void manejarCambio(evento, c.id, !habilitado)}
                                  disabled={!puedeActualizar || cargando || guardando}
                                  sx={{ margin: 0 }}
                                />
                              }
                              label=""
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              startIcon={<SaveIcon />}
              variant="contained"
              disabled={!puedeActualizar || guardando}
              onClick={guardarPreferencias}
            >
              {guardando ? <CircularProgress size={20} /> : 'Guardar cambios'}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
