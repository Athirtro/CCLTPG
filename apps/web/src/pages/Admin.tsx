import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const usuarios = [
  { id: 'U-001', nombre: 'Admin Principal', email: 'admin@ccltpg.edu.co', rol: 'Administrador' },
  { id: 'U-002', nombre: 'Prof. Carlos Ruiz', email: 'carlos@ccltpg.edu.co', rol: 'Educador' },
  { id: 'U-003', nombre: 'Prof. Elena Díaz', email: 'elena@ccltpg.edu.co', rol: 'Educador' },
];

export default function Admin() {
  const { hasPermission } = useAuth();

  if (!hasPermission('identity:user:manage')) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: 'center',
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h6">No tienes permiso para ver esta sección.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 2 }}>
        Administración de Usuarios
      </Typography>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell>Rol</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usuarios.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.rol}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
