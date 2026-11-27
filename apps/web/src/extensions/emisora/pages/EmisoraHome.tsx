import type { ReactNode } from 'react';
import { Alert, Avatar, Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  Campaign as CampaignIcon,
  Folder as FolderIcon,
  Group as GroupIcon,
  Mic as MicIcon,
  MonitorHeart as MonitorHeartIcon,
  Radio as RadioIcon,
  Schedule as ScheduleIcon,
  Send as SendIcon,
  Settings as SettingsIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import PageHeader from '../../../components/common/PageHeader';
import SectionCard from '../../../components/common/SectionCard';

const PERMISO_EMISORA = 'emisora:programacion:read';

type Agrupacion = {
  titulo: string;
  descripcion: string;
  icon: ReactNode;
  funciones: string[];
  permiso: string;
};

/** Agrupaciones funcionales del manual de la Emisora Cultural (RF-01…RF-12). */
const AGRUPACIONES: Agrupacion[] = [
  {
    titulo: 'Programación',
    descripcion: 'Planificación diaria de la emisión y su correspondencia con la rejilla anual.',
    icon: <ScheduleIcon />,
    funciones: ['Programación diaria y franjas', 'Verificación contra la rejilla aprobada'],
    permiso: 'emisora:programacion:read',
  },
  {
    titulo: 'Grabación',
    descripcion: 'Sesiones en cabina, asistencia y archivo de los audios producidos.',
    icon: <MicIcon />,
    funciones: ['Sesiones y asistencia en cabina', 'Audios y programas externos'],
    permiso: 'emisora:grabacion:read',
  },
  {
    titulo: 'Rejilla y realizadores',
    descripcion: 'Convocatoria, proyectos, comité, rejilla e incentivos de los realizadores.',
    icon: <GroupIcon />,
    funciones: [
      'Convocatoria anual, proyectos y comité',
      'Rejilla aprobada e informes de realizador',
      'Incentivos y resoluciones',
    ],
    permiso: 'emisora:rejilla:read',
  },
  {
    titulo: 'Patrocinios y promos',
    descripcion: 'Patrocinios, órdenes de emisión, promos y publicaciones.',
    icon: <CampaignIcon />,
    funciones: ['Patrocinios y órdenes de emisión', 'Promos y publicaciones'],
    permiso: 'emisora:patrocinio:read',
  },
  {
    titulo: 'Transmisiones',
    descripcion: 'Autorizaciones, salidas de equipo, desplazamientos y viáticos.',
    icon: <SendIcon />,
    funciones: [
      'Transmisiones y salida de equipos',
      'Desplazamientos, préstamos de mifi y viáticos',
    ],
    permiso: 'emisora:transmision:read',
  },
  {
    titulo: 'Transmisores',
    descripcion: 'Operación y seguimiento de las sedes de transmisores.',
    icon: <MonitorHeartIcon />,
    funciones: ['Turnos de operador', 'Lecturas técnicas y bitácora de sede'],
    permiso: 'emisora:lectura:read',
  },
  {
    titulo: 'Derechos',
    descripcion: 'Obras incluidas, reportes y soporte de los pagos de derechos.',
    icon: <ShieldIcon />,
    funciones: ['Obras y reportes', 'Soporte de pagos de derechos'],
    permiso: 'emisora:obra:read',
  },
  {
    titulo: 'Tecnología',
    descripcion: 'Inventario de equipos, actualizaciones, proyecciones e inversión.',
    icon: <SettingsIcon />,
    funciones: [
      'Hoja de vida y actualización de equipos',
      'Proyecciones, inversión y versiones de software',
    ],
    permiso: 'emisora:equipo:read',
  },
  {
    titulo: 'Archivo y trámites',
    descripcion: 'Archivo sonoro, planillas de emisión y gestiones externas.',
    icon: <FolderIcon />,
    funciones: [
      'Planillas de emisión y archivo sonoro',
      'Actividades culturales',
      'Permisos y trámites externos',
    ],
    permiso: 'emisora:archivo-emisora:read',
  },
];

export default function EmisoraHome() {
  const { hasPermission } = useAuth();
  const tienePermisoEmisora = hasPermission(PERMISO_EMISORA);

  return (
    <Box>
      <PageHeader
        title="Emisora R.A.C."
        description="Espacio de la Emisora Cultural. El recorrido de programación, grabación y rejilla ya está disponible; las demás agrupaciones se incorporarán en fases posteriores."
        icon={<RadioIcon />}
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Emisora R.A.C.' }]}
      />

      <SectionCard
        title="Agrupaciones funcionales"
        subtitle="Áreas de trabajo del manual de procedimientos de la emisora"
      >
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {AGRUPACIONES.map((agrupacion) => (
            <Box
              key={agrupacion.titulo}
              sx={{
                p: 2,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  variant="rounded"
                  sx={{
                    bgcolor: 'primary.light',
                    color: 'primary.main',
                    width: 40,
                    height: 40,
                  }}
                >
                  {agrupacion.icon}
                </Avatar>
                <Typography variant="h3" component="h3">
                  {agrupacion.titulo}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {agrupacion.descripcion}
              </Typography>
              <Box component="ul" sx={{ m: 0, mt: 1.5, pl: 2.5 }}>
                {agrupacion.funciones.map((funcion) => (
                  <Box component="li" key={funcion} sx={{ mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {funcion}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Permiso: {agrupacion.permiso}
              </Typography>
            </Box>
          ))}
        </Box>
      </SectionCard>

      <SectionCard
        title="Estado de la extensión"
        subtitle="Fases E2 y E3 — operación de la emisora R.A.C."
        sx={{ mt: 3 }}
      >
        {tienePermisoEmisora ? (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              El recorrido E2 registra comité, rejilla, programación y audios; el E3 gestiona
              patrocinios, promos, transmisiones, mifi, viáticos y resoluciones. Cada acción valida
              sus permisos en la API.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/emisora/operacion" variant="contained">
                Abrir operación E2
              </Button>
              <Button component={RouterLink} to="/emisora/operacion-e3" variant="outlined">
                Abrir operación E3
              </Button>
            </Box>
          </Box>
        ) : (
          <Alert severity="info">
            No tienes permisos de emisora ({PERMISO_EMISORA}). Esta página solo muestra información
            general; la API seguirá siendo la autoridad real y validará los permisos de cada
            operación.
          </Alert>
        )}
      </SectionCard>
    </Box>
  );
}
