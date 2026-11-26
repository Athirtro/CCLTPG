import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Switch, Typography } from '@mui/material';
import {
  Email as EmailIcon,
  Home as HomeIcon,
  Notifications as NotificationsIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  ToggleOn as ToggleOnIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { PreferenciaNotificacionDto, ActualizarPreferenciaDto } from '../api/client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

const CANALES: Array<{
  id: PreferenciaNotificacionDto['canal'];
  label: string;
  icon: ReactNode;
}> = [
  { id: 'app', label: 'Notificaciones in-app', icon: <ToggleOnIcon fontSize="small" /> },
  { id: 'email', label: 'Correo electrónico', icon: <EmailIcon fontSize="small" /> },
];

function formatearFecha(fecha: Date | null): string {
  return fecha ? fecha.toLocaleString('es-CO') : '—';
}

export default function Preferencias() {
  const { hasPermission } = useAuth();
  const [preferencias, setPreferencias] = useState<PreferenciaNotificacionDto[]>([]);
  const [guardadas, setGuardadas] = useState<PreferenciaNotificacionDto[]>([]);
  const [criticos, setCriticos] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [cargadoEn, setCargadoEn] = useState<Date | null>(null);
  const [guardadoEn, setGuardadoEn] = useState<Date | null>(null);

  const puedeLeer = hasPermission('notifications:preference:read_own');
  const puedeActualizar = hasPermission('notifications:preference:update_own');

  const cargarPreferencias = useCallback(async () => {
    if (!puedeLeer) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/notifications/preferences');
      if (apiError || !data) {
        setError('No se pudieron cargar las preferencias.');
        return;
      }
      setPreferencias(data.preferencias);
      setGuardadas(data.preferencias);
      setCriticos(data.criticos);
      setCargadoEn(new Date());
      setGuardadoEn(null);
      setExito(null);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar preferencias.');
    } finally {
      setCargando(false);
    }
  }, [puedeLeer]);

  useEffect(() => {
    void cargarPreferencias();
  }, [cargarPreferencias]);

  const eventos = useMemo(
    () => [...new Set(preferencias.map((preferencia) => preferencia.evento))],
    [preferencias],
  );

  const hayCambios = useMemo(
    () => JSON.stringify(preferencias) !== JSON.stringify(guardadas),
    [preferencias, guardadas],
  );

  const manejarCambio = (
    evento: string,
    canal: PreferenciaNotificacionDto['canal'],
    habilitado: boolean,
  ) => {
    setPreferencias((prev) =>
      prev.map((p) => (p.evento === evento && p.canal === canal ? { ...p, habilitado } : p)),
    );
    setExito(null);
  };

  const guardarPreferencias = async () => {
    if (!puedeActualizar || !hayCambios) return;
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      const payload: ActualizarPreferenciaDto[] = preferencias.map((p) => ({
        evento: p.evento,
        canal: p.canal,
        habilitado: p.habilitado,
      }));
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.PUT('/notifications/preferences', { body: payload });
      if (apiError || response?.status !== 200 || !data) {
        setError('No se pudieron guardar las preferencias.');
        return;
      }
      setPreferencias(data.preferencias);
      setGuardadas(data.preferencias);
      setCriticos(data.criticos);
      setGuardadoEn(new Date());
      setExito('Preferencias guardadas correctamente.');
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al guardar preferencias.');
    } finally {
      setGuardando(false);
    }
  };

  const descartarCambios = () => {
    setPreferencias(guardadas);
    setExito(null);
  };

  const cabecera = (
    <PageHeader
      title="Preferencias de notificación"
      description="Elige qué eventos quieres recibir y por qué canal. Los eventos críticos no se pueden silenciar."
      icon={<NotificationsIcon />}
      breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Preferencias de notificación' }]}
      actions={
        puedeLeer ? (
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void cargarPreferencias()}
            disabled={cargando || guardando}
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

  if (!puedeLeer && !puedeActualizar) {
    return (
      <Box>
        {cabecera}
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para consultar ni editar preferencias de notificación."
          icon={<NotificationsIcon />}
        />
      </Box>
    );
  }

  return (
    <Box>
      {cabecera}

      {!puedeLeer ? (
        <EmptyState
          title="Sin acceso de lectura"
          description="No tienes permiso para leer tus preferencias (notifications:preference:read_own)."
          icon={<NotificationsIcon />}
        />
      ) : (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {exito && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setExito(null)}>
              {exito}
              {guardadoEn && (
                <Typography variant="caption" sx={{ display: 'block' }}>
                  Guardado: {formatearFecha(guardadoEn)}
                </Typography>
              )}
            </Alert>
          )}

          <SectionCard
            title="Canales y eventos"
            subtitle={`Cargadas: ${formatearFecha(cargadoEn)} · Último guardado: ${formatearFecha(guardadoEn)}`}
            action={
              <Button size="small" onClick={descartarCambios} disabled={!hayCambios || guardando}>
                Descartar cambios
              </Button>
            }
          >
            {cargando && preferencias.length === 0 ? (
              <LoadingState label="Cargando preferencias…" />
            ) : error && preferencias.length === 0 ? (
              <ErrorState message={error} onRetry={() => void cargarPreferencias()} />
            ) : preferencias.length === 0 ? (
              <EmptyState
                title="Sin preferencias configuradas"
                description="El servicio no devolvió preferencias para mostrar."
                icon={<NotificationsIcon />}
              />
            ) : (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  }}
                >
                  {CANALES.map((canal) => (
                    <Box
                      key={canal.id}
                      sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ color: 'primary.main', display: 'flex' }}>{canal.icon}</Box>
                        <Typography variant="h3">{canal.label}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Activa o desactiva cada evento en este canal.
                      </Typography>
                      <Box
                        sx={{
                          mt: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          '& > :not(style) + :not(style)': {
                            borderTop: '1px solid',
                            borderColor: 'divider',
                          },
                        }}
                      >
                        {eventos.map((evento) => {
                          const preferencia = preferencias.find(
                            (p) => p.evento === evento && p.canal === canal.id,
                          );
                          const critico = criticos.includes(evento);
                          return (
                            <Box
                              key={`${canal.id}-${evento}`}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                                py: 1,
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                  {evento}
                                </Typography>
                                {critico && (
                                  <StatusChip status="warning" label="Crítico · siempre activo" />
                                )}
                              </Box>
                              <Switch
                                checked={preferencia?.habilitado ?? false}
                                onChange={(event) =>
                                  manejarCambio(evento, canal.id, event.target.checked)
                                }
                                disabled={!puedeActualizar || cargando || guardando || critico}
                                slotProps={{
                                  input: {
                                    'aria-label': `${evento} por ${canal.label}`,
                                  },
                                }}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  ))}
                </Box>

                <Box
                  sx={{
                    mt: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {hayCambios ? 'Tienes cambios sin guardar.' : 'No hay cambios pendientes.'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {guardadoEn
                        ? `Guardado: ${formatearFecha(guardadoEn)}`
                        : 'Aún no se han guardado cambios en esta sesión.'}
                    </Typography>
                  </Box>
                  <Button
                    startIcon={<SaveIcon />}
                    variant="contained"
                    disabled={!puedeActualizar || guardando || !hayCambios}
                    onClick={() => void guardarPreferencias()}
                  >
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </Box>
                {!puedeActualizar && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1 }}
                  >
                    Solo puedes consultar tus preferencias; necesitas
                    notifications:preference:update_own para editarlas.
                  </Typography>
                )}
              </>
            )}
          </SectionCard>
        </>
      )}
    </Box>
  );
}
