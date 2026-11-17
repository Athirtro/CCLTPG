import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';

const grupos = [
  { id: 'G-001', nombre: 'Guitarra Básica', programa: 'Música', horario: 'Lun 18:00', cupo: 15 },
  { id: 'G-002', nombre: 'Acuarela', programa: 'Pintura', horario: 'Mar 16:00', cupo: 10 },
  { id: 'G-003', nombre: 'Danza Contemporánea', programa: 'Danza', horario: 'Jue 19:00', cupo: 12 },
];

export default function Grupos() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 2 }}>
        Gestión de Grupos
      </Typography>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Programa</TableCell>
                <TableCell>Horario</TableCell>
                <TableCell>Cupo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {grupos.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.nombre}</TableCell>
                  <TableCell>{row.programa}</TableCell>
                  <TableCell>{row.horario}</TableCell>
                  <TableCell>{row.cupo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
