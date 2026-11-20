import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
} from '@mui/material';
import {
  Home as HomeIcon,
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
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const MENU_ITEMS = [
  { path: '/', label: 'Inicio', icon: <HomeIcon /> },
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
  { path: '/grupos', label: 'Grupos', icon: <GroupIcon />, requires: 'academic:group:manage' },
  {
    path: '/matriculas',
    label: 'Matrículas',
    icon: <AssignmentIcon />,
    requires: 'academic:enrollment:manage',
  },
  {
    path: '/admin',
    label: 'Administración',
    icon: <ShieldIcon />,
    requires: 'identity:user:manage',
  },
  { path: '/archivos', label: 'Archivos', icon: <FolderIcon />, requires: 'files:document:create' },
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
    path: '/exportaciones',
    label: 'Exportaciones',
    icon: <FileCopyIcon />,
    requires: 'exports:report:export',
  },
];

type Props = {
  user: { email?: string; fullName?: string; role?: string; profiles?: string[] } | null;
  onLogout: () => void;
};

export default function SideDrawer({ user, onLogout }: Props) {
  const { hasPermission } = useAuth();

  const items = MENU_ITEMS.filter((item) => {
    if (!item.requires) return true;
    return hasPermission(item.requires);
  });

  const activeProfile = user?.profiles?.[0];

  return (
    <>
      <Typography sx={{ px: 3, py: 2, fontWeight: 'bold' }}>CCLTPG</Typography>
      <Divider sx={{ my: 1 }} />
      {activeProfile && (
        <Typography sx={{ px: 3, py: 1, color: 'text.secondary', fontSize: '0.85rem' }}>
          Perfil activo: {activeProfile}
        </Typography>
      )}
      <List>
        {items.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton component={Link} to={item.path}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ my: 1 }} />
      <List>
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/estado">
            <ListItemIcon>
              <MonitorHeartIcon />
            </ListItemIcon>
            <ListItemText primary="Estado del sistema" />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider sx={{ my: 1 }} />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={onLogout}>
            <ListItemIcon>🚪</ListItemIcon>
            <ListItemText primary="Cerrar sesión" />
          </ListItemButton>
        </ListItem>
      </List>
    </>
  );
}
