import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  FileDownload as FileDownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type {
  ReportCatalogItemDto,
  ExportacionDto,
  ProblemDetailsDto,
} from '../api/client';

export default function Reportes() {
  const { hasPermission } = useAuth();
  const [catalogo, setCatalogo] = useState<ReportCatalogItemDto[]>([]);
  const [reporteSeleccionado, setReporteSeleccionado] = useState<ReportCatalogItemDto | null>(null);
  const [formatoSeleccionado, setFormatoSeleccionado] = useState<string>('');
  const [parametrosJson, setParametrosJson] = useState('{}');
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<ExportacionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const puedeExportar = hasPermission('exports:report:export');
  const puedeCrear = hasPermission('exports:report:create');

  const cargarCatalogo = useCallback(async () => {
    if (!puedeExportar && !puedeCrear) return;
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/reports/catalog');
      if (apiError || !data) {
        setError('No se pudo cargar el catálogo de reportes');
        return;
      }
      setCatalogo(data.items);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar catálogo de reportes');
    }
  }, [puedeExportar, puedeCrear]);

  useEffect(() => {
    void cargarCatalogo();
  }, [cargarCatalogo]);

  const seleccionarReporte = (reporte: ReportCatalogItemDto) => {
    setReporteSeleccionado(reporte);
    setFormatoSeleccionado(reporte.formatos[0] ?? '');
    setParametrosJson('{}');
    setResultado(null);
    setError(null);
    setExito(null);
  };

  const manejarGenerar = async () => {
    if (!reporteSeleccionado || !formatoSeleccionado) {
      setError('Selecciona un reporte y un formato');
      return;
    }
    if (!puedeExportar) {
      setError('No tienes permiso para generar reportes');
      return;
    }

    let parametros: Record<string, unknown>;
    try {
      parametros = JSON.parse(parametrosJson || '{}') as Record<string, unknown>;
    } catch {
      setError('El JSON de parámetros no es válido');
      return;
    }

    setGenerando(true);
    setError(null);
    setExito(null);
    setResultado(null);
    try {
      const {
        data,
        error: apiError,
        response,
      } = await (apiClient as any).POST(`/reports/${reporteSeleccionado.code}/generate`, {
        body: {
          plantilla: reporteSeleccionado.code,
          formato: formatoSeleccionado,
          parametros,
        },
      });

      if (apiError || response?.status !== 201) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al generar el reporte');
        return;
      }

      const dto = data as ExportacionDto;
      setResultado(dto);
      setExito(`Reporte "${dto.nombre}" generado correctamente`);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al generar el reporte');
    } finally {
      setGenerando(false);
    }
  };

  const descargarResultado = () => {
    if (!resultado?.descargaUrl) return;
    window.open(resultado.descargaUrl, '_blank');
  };

  if (!puedeExportar && !puedeCrear) {
    return (
      <Box
        sx={{
          p: 3,
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <DescriptionIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="h6">Reportes</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            No tienes permiso para ver reportes.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h1">Reportes y exportaciones</Typography>
        <Button
          startIcon={<RefreshIcon />}
          size="small"
          disabled={generando}
          onClick={cargarCatalogo}
        >
          {generando ? <CircularProgress size={20} /> : 'Actualizar'}
        </Button>
      </Box>

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

      {catalogo.length === 0 && !generando && (
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            minHeight: '40vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DescriptionIcon fontSize="large" sx={{ mb: 2, color: 'action.disabled' }} />
          <Typography variant="body1">No hay reportes disponibles.</Typography>
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* Catálogo de reportes */}
        <Paper sx={{ p: 3, flex: 1, minWidth: 300 }}>
          <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
            Catálogo de reportes
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Reporte</TableCell>
                  <TableCell>Formatos</TableCell>
                  <TableCell>Seleccionar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalogo.map((r) => (
                  <TableRow
                    key={r.code}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => void seleccionarReporte(r)}
                    hover
                  >
                    <TableCell sx={{ fontWeight: 'medium' }}>{r.nombre}</TableCell>
                    <TableCell>{r.formatos.join(', ').toUpperCase()}</TableCell>
                    <TableCell>
                      {reporteSeleccionado?.code === r.code ? (
                        <Chip label="Seleccionado" size="small" color="success" />
                      ) : (
                        'Abrir'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {catalogo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>No hay reportes disponibles.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Formulario de generación */}
        {reporteSeleccionado && (
          <Paper sx={{ p: 3, flex: 1, minWidth: 300 }}>
            <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
              Generar: {reporteSeleccionado.nombre}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {reporteSeleccionado.descripcion}
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="label-formato">Formato</InputLabel>
              <Select
                labelId="label-formato"
                id="select-formato"
                label="Formato"
                value={formatoSeleccionado}
                onChange={(e) => setFormatoSeleccionado(e.target.value)}
              >
                {reporteSeleccionado.formatos.map((f) => (
                  <MenuItem key={f} value={f}>
                    {f.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Parámetros (JSON)"
              placeholder='{"periodo": "2026-1"}'
              value={parametrosJson}
              onChange={(e) => setParametrosJson(e.target.value)}
              helperText="Parámetros de filtro para la plantilla (opcional)"
              sx={{ mb: 3 }}
            />

            <Button
              variant="contained"
              startIcon={<FileDownloadIcon />}
              disabled={generando || !formatoSeleccionado || !puedeExportar}
              onClick={manejarGenerar}
              fullWidth
            >
              {generando ? <CircularProgress size={20} /> : 'Generar reporte'}
            </Button>
          </Paper>
        )}
      </Box>

      {resultado && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
            Reporte generado
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Nombre
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {resultado.nombre}
              </Typography>
            </Box>
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Formato
              </Typography>
              <Typography variant="body2">{resultado.formato.toUpperCase()}</Typography>
            </Box>
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Tamaño
              </Typography>
              <Typography variant="body2">{resultado.tamano} bytes</Typography>
            </Box>
          </Box>
          <Button
            startIcon={<FileDownloadIcon />}
            variant="contained"
            onClick={descargarResultado}
            sx={{ mt: 2 }}
          >
            Descargar archivo
          </Button>
        </Paper>
      )}
    </Box>
  );
}
