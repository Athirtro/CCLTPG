import { useState, type MouseEvent } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Menu as MenuIcon } from '@mui/icons-material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const TOP_APP_BAR_HEIGHT = 64;

const SECCIONES: Record<string, string> = {
  '/': 'Inicio',
  '/estudiantes': 'Estudiantes',
  '/programas': 'Programas',
  '/grupos': 'Grupos',
  '/matriculas': 'Matrículas',
  '/vista-educador': 'Vista educador',
  '/mi-horario': 'Mi horario',
  '/mis-evaluaciones': 'Mis evaluaciones',
  '/kpis': 'Indicadores (KPIs)',
  '/reportes': 'Catálogo de reportes',
  '/exportaciones': 'Exportaciones',
  '/admin': 'Usuarios',
  '/archivos': 'Archivos',
  '/notificaciones': 'Notificaciones',
  '/preferencias': 'Preferencias',
  '/estado': 'Estado del sistema',
};

type Props = {
  onMenuClick: () => void;
  handleLogout: () => void;
  mobileOpen: boolean;
  isMobile: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join('')
    .toUpperCase();
}

export default function TopAppBar({
  onMenuClick,
  handleLogout,
  mobileOpen,
  isMobile,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const { user } = useAuth();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const abierto = Boolean(anchorEl);
  const titulo = SECCIONES[location.pathname] ?? 'CCLTPG';

  const handleMenuOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  return (
    <AppBar
      position="sticky"
      color="inherit"
      sx={{
        top: 0,
        flexShrink: 0,
        height: TOP_APP_BAR_HEIGHT,
        bgcolor: 'background.paper',
        color: 'text.primary',
        zIndex: (tema) => tema.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ minHeight: `${TOP_APP_BAR_HEIGHT}px !important`, gap: 1 }}>
        {isMobile ? (
          <IconButton
            color="inherit"
            edge="start"
            onClick={onMenuClick}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <MenuIcon />
          </IconButton>
        ) : (
          <IconButton
            color="inherit"
            edge="start"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expandir navegación' : 'Contraer navegación'}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </IconButton>
        )}

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle1" noWrap component="div">
            {titulo}
          </Typography>
        </Box>

        {user ? (
          <>
            <ButtonBase
              onClick={handleMenuOpen}
              aria-label="Opciones de usuario"
              aria-haspopup="true"
              aria-expanded={abierto}
              sx={{ borderRadius: 2, px: 1, py: 0.5, gap: 1, flexShrink: 0 }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.light',
                  color: 'primary.main',
                  fontSize: '0.8125rem',
                }}
              >
                {iniciales(user.fullName || user.email)}
              </Avatar>
              {!isMobile && (
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                    {user.fullName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {user.role}
                  </Typography>
                </Box>
              )}
            </ButtonBase>
            <Menu anchorEl={anchorEl} open={abierto} onClose={handleMenuClose}>
              <MenuItem disabled>
                <Box sx={{ maxWidth: 240 }}>
                  <Typography variant="body2" noWrap>
                    {user.fullName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div" noWrap>
                    {user.email}
                  </Typography>
                </Box>
              </MenuItem>
              <Divider />
              <MenuItem
                component={RouterLink}
                to="/preferencias"
                onClick={handleMenuClose}
                disabled={!user.permissions.includes('notifications:preference:read_own')}
              >
                Preferencias
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleMenuClose();
                  handleLogout();
                }}
              >
                Cerrar sesión
              </MenuItem>
            </Menu>
          </>
        ) : (
          <Button component={RouterLink} to="/login">
            Iniciar sesión
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}
