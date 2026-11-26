import { Box, Button, Paper, Typography } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, maxWidth: 520, textAlign: 'center' }}>
        <Typography variant="h1" component="h1">
          Página no encontrada
        </Typography>
        <Typography variant="h2" color="primary.main" sx={{ mt: 1 }}>
          404
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          La página que buscas no existe o ya no está disponible.
        </Typography>
        <Button component={Link} to="/" variant="contained" startIcon={<HomeIcon />}>
          Volver al inicio
        </Button>
      </Paper>
    </Box>
  );
}
