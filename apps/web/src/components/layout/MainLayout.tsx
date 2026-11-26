import { useState } from 'react';
import { Box, Drawer, useMediaQuery, useTheme } from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SideDrawer from './SideDrawer';
import TopAppBar, { TOP_APP_BAR_HEIGHT } from './TopAppBar';

export const DRAWER_WIDTH = 260;
export const DRAWER_COLLAPSED_WIDTH = 76;

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // La variante temporal siempre usa el ancho completo: ignora el estado contraído.
  const drawerWidth = isMobile ? DRAWER_WIDTH : collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  const handleLogout = () => {
    void logout();
    void navigate('/login');
  };

  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Box
        component="a"
        href="#contenido-principal"
        sx={{
          position: 'absolute',
          left: -9999,
          top: 8,
          zIndex: theme.zIndex.tooltip + 1,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          px: 2,
          py: 1,
          '&:focus': { left: 8 },
        }}
      >
        Saltar al contenido principal
      </Box>

      <TopAppBar
        onMenuClick={handleDrawerToggle}
        handleLogout={handleLogout}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />

      <Box sx={{ display: 'flex', flexGrow: 1, minWidth: 0, minHeight: 0 }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          sx={isMobile ? undefined : { width: drawerWidth, flexShrink: 0 }}
          slotProps={{
            paper: {
              sx: {
                boxSizing: 'border-box',
                width: drawerWidth,
                top: isMobile ? 0 : TOP_APP_BAR_HEIGHT,
                height: isMobile ? '100%' : `calc(100% - ${TOP_APP_BAR_HEIGHT}px)`,
                transition: theme.transitions.create('width', { duration: 150 }),
              },
            },
          }}
        >
          <SideDrawer
            user={user}
            onLogout={handleLogout}
            onClose={handleDrawerToggle}
            isMobile={isMobile}
            collapsed={collapsed}
          />
        </Drawer>

        <Box
          component="main"
          id="contenido-principal"
          sx={{
            flex: '1 1 0',
            minWidth: 0,
            boxSizing: 'border-box',
            overflowX: 'hidden',
            px: { xs: 2, sm: 3, md: 4 },
            pb: { xs: 3, sm: 4 },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
