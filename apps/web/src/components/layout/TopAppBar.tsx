import {
  AppBar,
  Box,
  Button,
  IconButton,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
} from '@mui/material';
import { AccountCircle, Menu as MenuIcon } from '@mui/icons-material';

type Props = {
  onMenuClick: () => void;
  handleLogout: () => void;
  user: { email?: string; fullName?: string } | null;
};

import { useState, type MouseEvent } from 'react';

export default function TopAppBar({ onMenuClick, handleLogout, user }: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <AppBar position="static" color="primary" elevation={3}>
      <Toolbar>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          CCLTPG — Centro Cultural Lucy Tejada
        </Typography>
        <Box sx={{ flexShrink: 0 }}>
          {user ? (
            <>
              <IconButton
                color="inherit"
                onClick={handleMenuOpen}
              >
                <AccountCircle sx={{ width: 32, height: 32 }} />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleMenuClose}>Mi perfil</MenuItem>
                <MenuItem onClick={handleLogout}>Cerrar sesión</MenuItem>
              </Menu>
            </>
          ) : (
            <Button color="inherit" startIcon={<AccountCircle />} sx={{ ml: 1 }}>
              Iniciar sesión
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
