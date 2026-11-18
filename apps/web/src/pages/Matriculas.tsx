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

const matriculas = [
  {
    id: 'M-001',
    estudiante: 'Ana García',
    programa: 'Música',
    grupo: 'G-001',
    estado: 'Confirmada',
  },
  {
    id: 'M-002',
    estudiante: 'Luis Pérez',
    programa: 'Pintura',
    grupo: 'G-002',
    estado: 'Pendiente',
  },
  {
    id: 'M-003',
    estudiante: 'María López',
    programa: 'Danza',
    grupo: 'G-003',
    estado: 'Cancelada',
  },
];

export default function Matriculas() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 2 }}>
        Gestión de Matrículas
      </Typography>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Estudiante</TableCell>
                <TableCell>Programa</TableCell>
                <TableCell>Grupo</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matriculas.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.estudiante}</TableCell>
                  <TableCell>{row.programa}</TableCell>
                  <TableCell>{row.grupo}</TableCell>
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
