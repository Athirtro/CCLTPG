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

const estudiantes = [
  {
    id: 'E-001',
    nombre: 'Ana García',
    email: 'ana@email.com',
    programa: 'Música',
    estado: 'Activo',
  },
  {
    id: 'E-002',
    nombre: 'Luis Pérez',
    email: 'luis@email.com',
    programa: 'Pintura',
    estado: 'Activo',
  },
  {
    id: 'E-003',
    nombre: 'María López',
    email: 'maria@email.com',
    programa: 'Danza',
    estado: 'Inactivo',
  },
];

export default function Estudiantes() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 2 }}>
        Gestión de Estudiantes
      </Typography>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell>Programa</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {estudiantes.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.programa}</TableCell>
                  <TableCell>{row.estado}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
