import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Avatar, Box, Button, Divider, Typography } from '@mui/material';
import {
  Assignment as AssignmentIcon,
  BarChart as BarChartIcon,
  Description as DescriptionIcon,
  Group as GroupIcon,
  Notifications as NotificationsIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  School as SchoolIcon,
  Schedule as ScheduleIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { apiClient, useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatCard from '../components/common/StatCard';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import { getErrorMessage } from '../api/errors';
import type {
  EvaluacionDto,
  GrupoDto,
  KpiResultDto,
  MatriculaDto,
  SesionDto,
  SesionHorarioDto,
} from '../api/client';

type Perfil = 'administrador' | 'educador' | 'estudiante';
type Resumen = {
  estudiantes?: number;
  programas?: number;
  grupos?: number;
  matriculas?: number;
  asistencia?: number | null;
};
type Actividad = { titulo: string; detalle: string; estado?: string; fecha?: string };
type Respuesta<T> = { data?: T; error?: unknown } | null;

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function obtener<T>(resultado: PromiseSettledResult<Respuesta<T>>): T | null {
  if (resultado.status !== 'fulfilled' || !resultado.value) return null;
  if (resultado.value.error || !resultado.value.data) return null;
  return resultado.value.data;
}

function fechaLocal(date = new Date()): string {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatearFecha(valor?: string | null): string {
  if (!valor) return 'Sin fecha';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleDateString('es-CO');
}

export default function Home() {
  const { user, hasPermission } = useAuth();
  const [resumen, setResumen] = useState<Resumen>({});
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [horario, setHorario] = useState<SesionHorarioDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rol = (user?.role || user?.profiles?.[0] || '').toLowerCase();
  const perfil: Perfil =
    rol.includes('admin') || hasPermission('identity:user:manage')
      ? 'administrador'
      : rol.includes('educ') || hasPermission('academic:attendance:create')
        ? 'educador'
        : 'estudiante';

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setResumen({});
    setActividad([]);
    setHorario([]);

    try {
      if (perfil === 'administrador') {
        const resultados = await Promise.allSettled([
          hasPermission('academic:student:manage') ? apiClient.GET('/academic/students') : Promise.resolve(null),
          hasPermission('academic:program:manage') ? apiClient.GET('/academic/programs') : Promise.resolve(null),
          hasPermission('academic:group:manage') ? apiClient.GET('/academic/groups') : Promise.resolve(null),
          hasPermission('academic:enrollment:manage') ? apiClient.GET('/academic/enrollments') : Promise.resolve(null),
          hasPermission('analytics:kpi:read') ? apiClient.GET('/analytics/kpis') : Promise.resolve(null),
        ]);

        const estudiantes = obtener(resultados[0]);
        const programas = obtener(resultados[1]);
        const grupos = obtener(resultados[2]);
        const matriculas = obtener(resultados[3]);
        const kpis = obtener(resultados[4]);

        const asistencia = (kpis as { kpis?: KpiResultDto[] } | null)?.kpis?.find(
          (kpi) => kpi.code === 'asistencia',
        );
        const asistenciaValor =
          asistencia?.valor != null && asistencia.unidad === 'porcentaje'
            ? Number(asistencia.valor.toFixed(1))
            : null;

        setResumen({
          estudiantes: estudiantes?.total,
          programas: programas?.data?.filter((p) => p.estado === 'publicado').length,
          grupos: grupos?.data?.filter((g) => g.estado === 'abierto').length,
          matriculas: matriculas?.total,
          asistencia: asistenciaValor,
        });

        setActividad(
          [...(matriculas?.data ?? [])]
            .sort((a, b) => b.fechaMatricula.localeCompare(a.fechaMatricula))
            .slice(0, 5)
            .map((matricula: MatriculaDto) => ({
              titulo: `${matricula.estudianteNombres} ${matricula.estudianteApellidos}`,
              detalle: `${matricula.programaNombre} · Grupo ${matricula.grupoCodigo}`,
              estado: matricula.estado,
              fecha: matricula.fechaMatricula,
            })),
        );

        if (resultados.every((resultado) => resultado.status === 'rejected')) {
          setError('No se pudo cargar la información del panel administrativo.');
        }
        return;
      }

      if (perfil === 'educador') {
        const puedeVerGrupos =
          hasPermission('academic:group:manage') || hasPermission('academic:group:read_own');
        const respuestaGrupos = puedeVerGrupos ? await apiClient.GET('/academic/groups') : null;
        const grupos = respuestaGrupos && !respuestaGrupos.error ? respuestaGrupos.data?.data ?? [] : [];
        setResumen({
          grupos: grupos.filter((grupo: GrupoDto) => grupo.estado === 'abierto').length,
        });

        const sesionesPorGrupo = await Promise.allSettled(
          grupos.slice(0, 5).map((grupo: GrupoDto) =>
            apiClient.GET('/academic/groups/{groupId}/sessions', {
              params: { path: { groupId: grupo.id } },
            }),
          ),
        );
        const sesiones = sesionesPorGrupo
          .map((resultado) => obtener(resultado))
          .filter((valor): valor is NonNullable<typeof valor> => valor !== null)
          .flatMap((valor) => valor.data ?? []) as SesionDto[];

        const hoy = fechaLocal();
        setResumen((prev) => ({ ...prev, matriculas: sesiones.filter((s) => s.fecha.slice(0, 10) === hoy).length }));
        setActividad(
          [...sesiones]
            .sort((a, b) => a.fecha.localeCompare(b.fecha))
            .slice(0, 5)
            .map((sesion) => ({
              titulo: sesion.tema || `Sesión del ${formatearFecha(sesion.fecha)}`,
              detalle: `Sesión ${sesion.grupoId}`,
              estado: sesion.estado,
              fecha: sesion.fecha,
            })),
        );

        if (!puedeVerGrupos) {
          setError('Tu perfil no tiene permisos para consultar los grupos asignados.');
        }
        return;
      }

      const resultados = await Promise.allSettled([
        apiClient.GET('/me/enrollments'),
        apiClient.GET('/me/schedule'),
        apiClient.GET('/me/evaluations'),
        hasPermission('notifications:notification:read_own')
          ? apiClient.GET('/notifications')
          : Promise.resolve(null),
      ]);
      const inscripciones = obtener(resultados[0]);
      const horarioRespuesta = obtener(resultados[1]);
      const evaluaciones = obtener(resultados[2]);
      const notificaciones = obtener(resultados[3]);

      setResumen({
        matriculas: inscripciones?.data?.filter((m) => m.estado === 'activa' || m.estado === 'confirmada').length,
        asistencia: evaluaciones?.total,
        estudiantes: notificaciones?.items?.filter((n) => n.estado !== 'leida').length,
      });
      setHorario(horarioRespuesta?.items ?? []);
      setActividad(
        [...(evaluaciones?.data ?? [])]
          .sort((a, b) => b.evaluadoEn.localeCompare(a.evaluadoEn))
          .slice(0, 4)
          .map((evaluacion: EvaluacionDto) => ({
            titulo: evaluacion.indicadorNombre,
            detalle: `${evaluacion.periodo} · Valoración: ${evaluacion.valor}`,
            fecha: evaluacion.evaluadoEn,
          })),
      );

      if (resultados.every((resultado) => resultado.status === 'rejected')) {
        setError('No se pudo cargar tu información académica.');
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo cargar la información del inicio.');
    } finally {
      setCargando(false);
    }
  }, [hasPermission, perfil]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const accesos: Array<{ label: string; to: string; icon: ReactNode; perms?: string }> =
    perfil === 'administrador'
      ? [
          { label: 'Estudiantes', to: '/estudiantes', icon: <PeopleIcon />, perms: 'academic:student:manage' },
          { label: 'Programas', to: '/programas', icon: <SchoolIcon />, perms: 'academic:program:manage' },
          { label: 'Grupos', to: '/grupos', icon: <GroupIcon />, perms: 'academic:group:manage' },
          { label: 'Matrículas', to: '/matriculas', icon: <AssignmentIcon />, perms: 'academic:enrollment:manage' },
          { label: 'Indicadores', to: '/kpis', icon: <BarChartIcon />, perms: 'analytics:kpi:read' },
          { label: 'Reportes', to: '/reportes', icon: <DescriptionIcon />, perms: 'exports:report:export' },
        ]
      : perfil === 'educador'
        ? [
            { label: 'Vista educador', to: '/vista-educador', icon: <ShieldIcon />, perms: 'academic:attendance:create' },
            { label: 'Mi horario', to: '/mi-horario', icon: <ScheduleIcon />, perms: 'academic:schedule:read_own' },
            { label: 'Mis evaluaciones', to: '/mis-evaluaciones', icon: <BarChartIcon />, perms: 'academic:evaluation:read_own' },
          ]
        : [
            { label: 'Mi horario', to: '/mi-horario', icon: <ScheduleIcon />, perms: 'academic:schedule:read_own' },
            { label: 'Mis evaluaciones', to: '/mis-evaluaciones', icon: <BarChartIcon />, perms: 'academic:evaluation:read_own' },
            { label: 'Notificaciones', to: '/notificaciones', icon: <NotificationsIcon />, perms: 'notifications:notification:read_own' },
          ];

  const accesosVisibles = accesos.filter((acceso) => !acceso.perms || hasPermission(acceso.perms));

  const tarjetas: Array<{ label: string; value: number | string; icon: ReactNode; description: string; to?: string }> =
    perfil === 'administrador'
      ? [
          { label: 'Estudiantes registrados', value: resumen.estudiantes ?? '—', icon: <PeopleIcon />, description: 'Total en el sistema', to: '/estudiantes' },
          { label: 'Programas publicados', value: resumen.programas ?? '—', icon: <SchoolIcon />, description: 'Disponibles actualmente', to: '/programas' },
          { label: 'Grupos abiertos', value: resumen.grupos ?? '—', icon: <GroupIcon />, description: 'Con cupo disponible', to: '/grupos' },
          { label: 'Matrículas', value: resumen.matriculas ?? '—', icon: <AssignmentIcon />, description: 'Registros acumulados', to: '/matriculas' },
          {
            label: 'Asistencia',
            value: resumen.asistencia != null ? `${resumen.asistencia}%` : '—',
            icon: <BarChartIcon />,
            description: resumen.asistencia != null ? 'Indicador calculado' : 'Indicador no disponible',
            to: '/kpis',
          },
        ]
      : perfil === 'educador'
        ? [
            { label: 'Grupos abiertos', value: resumen.grupos ?? '—', icon: <GroupIcon />, description: 'Grupos activos consultados' },
            { label: 'Sesiones de hoy', value: resumen.matriculas ?? '—', icon: <ScheduleIcon />, description: 'De los primeros grupos asignados' },
          ]
        : [
            { label: 'Matrículas vigentes', value: resumen.matriculas ?? '—', icon: <AssignmentIcon />, description: 'Activas o confirmadas', to: '/matriculas' },
            { label: 'Evaluaciones', value: resumen.asistencia ?? '—', icon: <BarChartIcon />, description: 'Registros disponibles', to: '/mis-evaluaciones' },
            {
              label: 'Notificaciones por leer',
              value: resumen.estudiantes ?? '—',
              icon: <NotificationsIcon />,
              description: 'Requieren tu atención',
              to: '/notificaciones',
            },
          ];

  const saludos: Record<Perfil, string> = {
    administrador: 'Panel administrativo',
    educador: 'Espacio del educador',
    estudiante: 'Tu espacio académico',
  };

  return (
    <Box>
      <PageHeader
        title={`Bienvenido, ${user?.fullName ?? 'usuario'}`}
        description={saludos[perfil]}
        icon={<Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main' }}>CC</Avatar>}
        actions={
          <Button startIcon={<RefreshIcon />} onClick={() => void cargar()} disabled={cargando}>
            Actualizar
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={() => void cargar()} sx={{ mb: 3 }} />}

      {cargando ? (
        <LoadingState label="Preparando tu panel…" />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
              mb: 3,
            }}
          >
            {tarjetas.map((tarjeta) => (
              <StatCard
                key={tarjeta.label}
                label={tarjeta.label}
                value={tarjeta.value}
                icon={tarjeta.icon}
                description={tarjeta.description}
                to={tarjeta.to}
              />
            ))}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.4fr) minmax(0, 1fr)' },
              mb: 3,
            }}
          >
            <SectionCard
              title={perfil === 'administrador' ? 'Actividad reciente' : 'Actividades y novedades'}
              subtitle={
                perfil === 'administrador'
                  ? 'Últimas matrículas registradas'
                  : 'Información disponible desde los servicios activos'
              }
            >
              {actividad.length === 0 ? (
                <EmptyState
                  title="Sin actividad disponible"
                  description="No hay registros recientes que mostrar para tu perfil."
                  minHeight={180}
                />
              ) : (
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {actividad.map((item, index) => (
                    <Box
                      component="li"
                      key={`${item.titulo}-${index}`}
                      sx={{ py: 1.25, borderBottom: index < actividad.length - 1 ? '1px solid' : 0, borderColor: 'divider' }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.titulo}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.detalle}
                          </Typography>
                        </Box>
                        {item.estado && <StatusChip status={item.estado} />}
                      </Box>
                      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                        {formatearFecha(item.fecha)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </SectionCard>

            <SectionCard
              title={perfil === 'estudiante' ? 'Mi horario' : 'Atención inmediata'}
              subtitle={
                perfil === 'estudiante'
                  ? 'Sesiones disponibles desde tu matrícula'
                  : 'Consulta los módulos de tu perfil'
              }
            >
              {perfil === 'estudiante' ? (
                horario.length === 0 ? (
                  <EmptyState
                    title="Sin sesiones programadas"
                    description="Cuando tengas sesiones asignadas aparecerán aquí."
                    minHeight={180}
                  />
                ) : (
                  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                    {horario.slice(0, 5).map((sesion) => (
                      <Box
                        component="li"
                        key={sesion.id}
                        sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {DIAS[sesion.diaSemana] ?? `Día ${sesion.diaSemana}`} · {sesion.horaInicio}–{sesion.horaFin}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {sesion.programaNombre ?? 'Programa no disponible'} · {sesion.grupoCodigo ?? sesion.grupoId}
                          {sesion.salon ? ` · ${sesion.salon}` : ''}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {perfil === 'administrador'
                      ? 'Revisa los indicadores y los reportes para seguir la actividad del centro.'
                      : 'Selecciona un grupo, registra la asistencia y consulta tus evaluaciones.'}
                  </Typography>
                  <Divider sx={{ my: 0.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    Los datos mostrados provienen exclusivamente de los servicios consultados.
                  </Typography>
                </Box>
              )}
            </SectionCard>
          </Box>

          <SectionCard title="Accesos rápidos" subtitle="Módulos disponibles según tus permisos">
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {accesosVisibles.map((acceso) => (
                <Avatar
                  key={acceso.to}
                  component={RouterLink}
                  to={acceso.to}
                  variant="rounded"
                  sx={{
                    width: 'auto',
                    height: 'auto',
                    p: 2,
                    justifyContent: 'flex-start',
                    gap: 1.5,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    color: 'text.primary',
                    textDecoration: 'none',
                    borderRadius: 2,
                    transition: 'border-color 150ms ease, box-shadow 150ms ease',
                    '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 14px rgba(31, 58, 95, 0.10)' },
                  }}
                >
                  <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.main' }}>
                    {acceso.icon}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {acceso.label}
                  </Typography>
                </Avatar>
              ))}
            </Box>
          </SectionCard>
        </>
      )}
    </Box>
  );
}
