import type { ReactNode } from 'react';
import {
  Avatar,
  Box,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Home as HomeIcon,
  Radio as RadioIcon,
  People as PeopleIcon,
  School as SchoolIcon,
  Group as GroupIcon,
  Assignment as AssignmentIcon,
  Shield as ShieldIcon,
  Notifications as NotificationsIcon,
  Folder as FolderIcon,
  MonitorHeart as MonitorHeartIcon,
  Settings as SettingsIcon,
  FileCopy as FileCopyIcon,
  Schedule as ScheduleIcon,
  BarChart as BarChartIcon,
  Description as DescriptionIcon,
  InsertChart as InsertChartIcon,
  History as HistoryIcon,
  VpnKey as VpnKeyIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type NavItem = { path: string; label: string; icon: ReactNode; requires?: string };
type NavSection = { title: string; items: NavItem[] };

/** Las rutas y los permisos son exactamente los existentes antes del rediseño. */
const SECCIONES: NavSection[] = [
  { title: 'General', items: [{ path: '/', label: 'Inicio', icon: <HomeIcon /> }] },
  {
    title: 'Gestión académica',
    items: [
      {
        path: '/estudiantes',
        label: 'Estudiantes',
        icon: <PeopleIcon />,
        requires: 'academic:student:manage',
      },
      {
        path: '/programas',
        label: 'Programas',
        icon: <SchoolIcon />,
        requires: 'academic:program:manage',
      },
      {
        path: '/grupos',
        label: 'Grupos',
        icon: <GroupIcon />,
        requires: 'academic:group:manage',
      },
      {
        path: '/matriculas',
        label: 'Matrículas',
        icon: <AssignmentIcon />,
        requires: 'academic:enrollment:read_own',
      },
    ],
  },
  {
    title: 'Actividad académica',
    items: [
      {
        path: '/vista-educador',
        label: 'Vista educador',
        icon: <ShieldIcon />,
        requires: 'academic:attendance:create',
      },
      {
        path: '/mi-horario',
        label: 'Mi horario',
        icon: <ScheduleIcon />,
        requires: 'academic:schedule:read_own',
      },
      {
        path: '/mis-evaluaciones',
        label: 'Mis evaluaciones',
        icon: <BarChartIcon />,
        requires: 'academic:evaluation:read_own',
      },
    ],
  },
  {
    title: 'Seguimiento',
    items: [
      {
        path: '/kpis',
        label: 'Indicadores (KPIs)',
        icon: <InsertChartIcon />,
        requires: 'analytics:kpi:read',
      },
      {
        path: '/reportes',
        label: 'Catálogo de reportes',
        icon: <DescriptionIcon />,
        requires: 'exports:report:export',
      },
      {
        path: '/exportaciones',
        label: 'Exportaciones',
        icon: <FileCopyIcon />,
        requires: 'exports:report:export',
      },
      {
        path: '/auditoria',
        label: 'Auditoría',
        icon: <HistoryIcon />,
        requires: 'audit:event:read',
      },
    ],
  },
  {
    title: 'Emisora R.A.C.',
    items: [
      {
        path: '/emisora',
        label: 'Inicio emisora',
        icon: <RadioIcon />,
        requires: 'emisora:programacion:read',
      },
    ],
  },
  {
    title: 'Administración',
    items: [
      {
        path: '/admin',
        label: 'Usuarios',
        icon: <ShieldIcon />,
        requires: 'identity:user:manage',
      },
      {
        path: '/archivos',
        label: 'Archivos',
        icon: <FolderIcon />,
        requires: 'files:document:create',
      },
      {
        path: '/notificaciones',
        label: 'Notificaciones',
        icon: <NotificationsIcon />,
        requires: 'notifications:notification:read_own',
      },
      {
        path: '/preferencias',
        label: 'Preferencias',
        icon: <SettingsIcon />,
        requires: 'notifications:preference:read_own',
      },
      {
        path: '/seguridad',
        label: 'Seguridad',
        icon: <VpnKeyIcon />,
      },
    ],
  },
  {
    title: 'Sistema',
    items: [{ path: '/estado', label: 'Estado del sistema', icon: <MonitorHeartIcon /> }],
  },
];

type Props = {
  user: { fullName?: string; email?: string; role?: string; profiles?: string[] } | null;
  onLogout: () => void;
  onClose?: () => void;
  isMobile?: boolean;
  collapsed?: boolean;
};

export default function SideDrawer({
  user,
  onLogout,
  onClose,
  isMobile,
  collapsed = false,
}: Props) {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const compacto = collapsed && !isMobile;

  const handleMenuItemClick = () => {
    if (isMobile) onClose?.();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: compacto ? 1.5 : 2,
          py: 2,
        }}
      >
        <Avatar
          variant="rounded"
          sx={{ bgcolor: 'primary.main', color: 'common.white', width: 38, height: 38 }}
        >
          <SchoolIcon fontSize="small" />
        </Avatar>
        {!compacto && (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" noWrap>
              CCLTPG
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              Centro Cultural Lucy Tejada
            </Typography>
          </Box>
        )}
      </Box>
      <Divider />

      {!compacto && user?.fullName && (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" color="text.secondary" component="div">
            Perfil activo
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {user.role || user.profiles?.[0] || user.fullName}
          </Typography>
        </Box>
      )}

      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
        {SECCIONES.map((seccion) => {
          const items = seccion.items.filter(
            (item) => !item.requires || hasPermission(item.requires),
          );
          if (items.length === 0) return null;

          return (
            <Box key={seccion.title} sx={{ mb: 1.5 }}>
              {!compacto && (
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ px: 2.5, display: 'block', mt: 0.5, mb: 0.5, fontSize: '0.625rem' }}
                >
                  {seccion.title}
                </Typography>
              )}
              {compacto && <Divider sx={{ mx: 1.5, mb: 1 }} />}
              <List dense disablePadding>
                {items.map((item) => {
                  const seleccionado = location.pathname === item.path;
                  const boton = (
                    <ListItemButton
                      component={Link}
                      to={item.path}
                      selected={seleccionado}
                      onClick={handleMenuItemClick}
                      aria-label={compacto ? item.label : undefined}
                      aria-current={seleccionado ? 'page' : undefined}
                      sx={{
                        justifyContent: compacto ? 'center' : 'flex-start',
                        px: compacto ? 0 : 1.5,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: compacto ? 0 : 36 }}>{item.icon}</ListItemIcon>
                      {!compacto && <ListItemText primary={item.label} />}
                    </ListItemButton>
                  );

                  return (
                    <ListItem key={item.path} disablePadding>
                      {compacto ? (
                        <Tooltip title={item.label} placement="right">
                          <span style={{ width: '100%' }}>{boton}</span>
                        </Tooltip>
                      ) : (
                        boton
                      )}
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          );
        })}
      </Box>

      <Divider />
      <List dense sx={{ my: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              onLogout();
              handleMenuItemClick();
            }}
            aria-label="Cerrar sesión"
            sx={{ justifyContent: compacto ? 'center' : 'flex-start', px: compacto ? 0 : 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: compacto ? 0 : 36, color: 'text.secondary' }}>
              <LogoutIcon />
            </ListItemIcon>
            {!compacto && <ListItemText primary="Cerrar sesión" />}
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
}
