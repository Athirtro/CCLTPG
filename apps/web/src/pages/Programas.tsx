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

const programas = [
  { id: 'P-001', nombre: 'Música', cupo: 30, inscritos: 12 },
  { id: 'P-002', nombre: 'Pintura', cupo: 25, inscritos: 20 },
  { id: 'P-003', nombre: 'Danza', cupo: 20, inscritos: 8 },
];

export default function Programas() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 2 }}>
        Gestión de Programas
      </Typography>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Cupo</TableCell>
                <TableCell>Inscritos</TableCell>
                <TableCell>Disponibles</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {programas.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell>{row.cupo}</TableCell>
                  <TableCell>{row.inscritos}</TableCell>
                  <TableCell>{row.cupo - row.inscritos}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
