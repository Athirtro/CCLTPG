import {
  Box,
  CssBaseline,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SideDrawer from './SideDrawer';
import TopAppBar from './TopAppBar';
import AuthRedirect from './AuthRedirect';

const drawerWidth = 260;

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleLogout = () => {
    void logout();
    void navigate('/login');
  };

  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <TopAppBar
        onMenuClick={handleDrawerToggle}
        handleLogout={handleLogout}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: {
            md: `calc(100% - ${drawerWidth}px)`,
          },
        }}
      >
        <AuthRedirect />
        <Outlet />
      </Box>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={handleDrawerToggle}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        <SideDrawer
          user={user}
          onLogout={handleLogout}
          onClose={handleDrawerToggle}
          isMobile={isMobile}
        />
      </Drawer>
    </Box>
  );
}
