import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { FileCopy as FileCopyIcon, Description as DescriptionIcon, BarChart as BarChartIcon } from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import type { ExportacionDto, CrearExportacionDto, ProblemDetailsDto } from '../api/client';

const PLANTILLAS = [
  { valor: 'matriculas_por_programa', label: 'Matrículas por programa' },
  { valor: 'asistencia_por_grupo', label: 'Asistencia por grupo' },
  { valor: 'evaluaciones_por_periodo', label: 'Evaluaciones por periodo' },
  { valor: 'estudiantes_activos', label: 'Estudiantes activos' },
];

const FORMATOS = [
  { valor: 'pdf' as const, label: 'PDF', icon: <DescriptionIcon fontSize="small" /> },
  { valor: 'xlsx' as const, label: 'Excel', icon: <FileCopyIcon fontSize="small" /> },
  { valor: 'csv' as const, label: 'CSV', icon: <BarChartIcon fontSize="small" /> },
];

export default function Exportaciones() {
  const { hasPermission } = useAuth();
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>('');
  const [formatoSeleccionado, setFormatoSeleccionado] = useState<'pdf' | 'xlsx' | 'csv'>('pdf');
  const [entradaJson, setEntradaJson] = useState('{}');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const puedeExportar = hasPermission('exports:report:export');

  const manejarGenerar = async () => {
    if (!puedeExportar) {
      setError('No tienes permiso para generar exportaciones');
      return;
    }
    setError(null);
    setExito(null);

    if (!plantillaSeleccionada) {
      setError('Selecciona una plantilla');
      return;
    }

    let entrada: Record<string, unknown>;
    try {
      entrada = JSON.parse(entradaJson || '{}');
    } catch {
      setError('El JSON de entrada no es válido');
      return;
    }

    setGenerando(true);
    try {
      const payload: CrearExportacionDto = {
        plantilla: plantillaSeleccionada,
        formato: formatoSeleccionado,
        entrada,
      };
      const { data, error: apiError, response } = await apiClient.POST('/exports', {
        body: payload,
      });

      if (apiError || response?.status !== 200) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al generar la exportación');
        return;
      }

      const dto = data as ExportacionDto;
      setExito(`Exportación "${dto.plantilla}" generada (${dto.formato.toUpperCase()})`);
      setEntradaJson('{}');
    } catch (err: any) {
      setError(err.message || 'Error inesperado al generar');
    } finally {
      setGenerando(false);
    }
  };

  if (!puedeExportar) {
    return (
      <Box sx={{ p: 3, minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <BarChartIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Exportaciones</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para generar exportaciones.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Exportaciones y reportes</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Genera reportes en PDF, Excel o CSV a partir de plantillas disponibles.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {exito && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setExito(null)}>
          {exito}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Nueva exportación
        </Typography>
        <form noValidate>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Plantilla</InputLabel>
              <Select
                value={plantillaSeleccionada}
                onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                label="Plantilla"
              >
                <MenuItem value="">Selecciona una plantilla</MenuItem>
                {PLANTILLAS.map((p) => (
                  <MenuItem key={p.valor} value={p.valor}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Formato</InputLabel>
              <Select
                value={formatoSeleccionado}
                onChange={(e) => setFormatoSeleccionado(e.target.value as 'pdf' | 'xlsx' | 'csv')}
                label="Formato"
              >
                {FORMATOS.map((f) => (
                  <MenuItem key={f.valor} value={f.valor}>
                    {f.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Entrada (JSON)"
              placeholder='{"filtro": "valor"}'
              value={entradaJson}
              onChange={(e) => setEntradaJson(e.target.value)}
              helperText="Parámetros de filtro para la plantilla (opcional)"
            />
          </Box>
          <Button
            type="button"
            variant="contained"
            startIcon={<FileCopyIcon />}
            disabled={generando || !plantillaSeleccionada}
            onClick={manejarGenerar}
          >
            {generando ? <CircularProgress size={20} /> : 'Generar exportación'}
          </Button>
        </form>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Mis exportaciones
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Las exportaciones generadas aparecerán aquí una vez el Rol B implemente el servicio de exportaciones.
        </Typography>
      </Paper>
    </Box>
  );
}
