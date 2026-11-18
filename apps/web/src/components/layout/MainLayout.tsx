import { Box, CssBaseline, Drawer } from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SideDrawer from './SideDrawer';
import TopAppBar from './TopAppBar';

const drawerWidth = 260;

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    void navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <TopAppBar onMenuClick={() => {}} handleLogout={handleLogout} user={user} />
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
        <Outlet />
      </Box>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          display: { xs: 'none', md: 'block' },
        }}
      >
        <SideDrawer user={user} onLogout={handleLogout} />
      </Drawer>
    </Box>
  );
}
