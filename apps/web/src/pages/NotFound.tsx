import { Box, Button, Paper, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <Paper sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h4">404</Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          La página que buscas no existe.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button component={Link} to="/" variant="contained">
            Volver al inicio
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
