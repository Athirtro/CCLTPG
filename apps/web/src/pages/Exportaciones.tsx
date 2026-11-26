import { useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  FileCopy as FileCopyIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { CrearExportacionDto, ExportacionDto, ProblemDetailsDto } from '../api/client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';

const PLANTILLAS = [
  { valor: 'matriculas_por_programa', label: 'Matrículas por programa' },
  { valor: 'asistencia_por_grupo', label: 'Asistencia por grupo' },
  { valor: 'evaluaciones_por_periodo', label: 'Evaluaciones por periodo' },
  { valor: 'estudiantes_activos', label: 'Estudiantes activos' },
];

const FORMATOS: Array<{ valor: 'pdf' | 'xlsx' | 'csv'; label: string }> = [
  { valor: 'pdf', label: 'PDF' },
  { valor: 'xlsx', label: 'Excel (XLSX)' },
  { valor: 'csv', label: 'CSV' },
];

function Metadato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Box>
  );
}

export default function Exportaciones() {
  const { hasPermission } = useAuth();
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('');
  const [formatoSeleccionado, setFormatoSeleccionado] = useState<'pdf' | 'xlsx' | 'csv'>('pdf');
  const [entradaJson, setEntradaJson] = useState('{}');
  const [errorParametros, setErrorParametros] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<ExportacionDto | null>(null);
  const [generadoEn, setGeneradoEn] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const puedeExportar = hasPermission('exports:report:export');

  const limpiarFormulario = () => {
    setPlantillaSeleccionada('');
    setFormatoSeleccionado('pdf');
    setEntradaJson('{}');
    setErrorParametros(null);
    setResultado(null);
    setGeneradoEn(null);
    setError(null);
    setExito(null);
  };

  const manejarGenerar = async () => {
    if (!puedeExportar) {
      setError('No tienes permiso para generar exportaciones.');
      return;
    }
    setError(null);
    setExito(null);
    setResultado(null);
    setGeneradoEn(null);

    if (!plantillaSeleccionada) {
      setError('Selecciona una plantilla.');
      return;
    }

    let entrada: Record<string, unknown>;
    try {
      const parseado: unknown = JSON.parse(entradaJson || '{}');
      if (typeof parseado !== 'object' || parseado === null || Array.isArray(parseado)) {
        setErrorParametros(
          'Los parámetros deben ser un objeto JSON, por ejemplo {"periodo": "2026-1"}.',
        );
        return;
      }
      entrada = parseado as Record<string, unknown>;
      setErrorParametros(null);
    } catch {
      setErrorParametros('JSON no válido: revisa las comillas y las comas.');
      return;
    }

    setGenerando(true);
    try {
      const payload: CrearExportacionDto = {
        plantilla: plantillaSeleccionada,
        formato: formatoSeleccionado,
        parametros: entrada,
      };
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/exports', { body: payload });

      if (apiError || response?.status !== 201 || !data) {
        const problema = apiError as ProblemDetailsDto | null;
        setError(problema?.detail || 'No se pudo generar la exportación.');
        return;
      }

      setResultado(data);
      setGeneradoEn(new Date());
      setExito(
        `Exportación "${data.nombre}" generada correctamente (${data.formato.toUpperCase()}).`,
      );
      setEntradaJson('{}');
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al generar la exportación.');
    } finally {
      setGenerando(false);
    }
  };

  const cabecera = (
    <PageHeader
      title="Exportaciones"
      description="Genera archivos en PDF, Excel o CSV a partir de las plantillas disponibles."
      icon={<FileCopyIcon />}
      breadcrumbs={[
        { label: 'Inicio', to: '/' },
        { label: 'Reportes y exportaciones' },
        { label: 'Exportaciones' },
      ]}
      actions={
        puedeExportar ? (
          <Button startIcon={<RefreshIcon />} onClick={limpiarFormulario}>
            Nueva exportación
          </Button>
        ) : (
          <Button component={RouterLink} to="/" startIcon={<HomeIcon />}>
            Ir al inicio
          </Button>
        )
      }
    />
  );

  if (!puedeExportar) {
    return (
      <Box>
        {cabecera}
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para generar exportaciones (exports:report:export)."
          icon={<FileCopyIcon />}
        />
      </Box>
    );
  }

  return (
    <Box>
      {cabecera}

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

      <SectionCard
        title="Nueva exportación"
        subtitle="Configura la plantilla, el formato y los parámetros"
      >
        <Box component="form" noValidate onSubmit={(event) => event.preventDefault()}>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              mb: 2,
            }}
          >
            <FormControl fullWidth>
              <InputLabel id="exportacion-plantilla-label">Plantilla</InputLabel>
              <Select
                labelId="exportacion-plantilla-label"
                id="exportacion-plantilla"
                label="Plantilla"
                value={plantillaSeleccionada}
                onChange={(event) => setPlantillaSeleccionada(event.target.value)}
              >
                <MenuItem value="">Selecciona una plantilla</MenuItem>
                {PLANTILLAS.map((plantilla) => (
                  <MenuItem key={plantilla.valor} value={plantilla.valor}>
                    {plantilla.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="exportacion-formato-label">Formato</InputLabel>
              <Select
                labelId="exportacion-formato-label"
                id="exportacion-formato"
                label="Formato"
                value={formatoSeleccionado}
                onChange={(event) => setFormatoSeleccionado(event.target.value)}
              >
                {FORMATOS.map((formato) => (
                  <MenuItem key={formato.valor} value={formato.valor}>
                    {formato.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={5}
            id="exportacion-parametros"
            label="Parámetros (JSON)"
            placeholder='{"periodo": "2026-1"}'
            value={entradaJson}
            onChange={(event) => {
              setEntradaJson(event.target.value);
              setErrorParametros(null);
            }}
            error={Boolean(errorParametros)}
            helperText={
              errorParametros ??
              'Objeto JSON con los filtros de la plantilla. Usa {} si no se requieren parámetros.'
            }
            sx={{ mb: 2 }}
          />

          <Button
            type="button"
            variant="contained"
            startIcon={<FileCopyIcon />}
            disabled={generando || !plantillaSeleccionada}
            onClick={() => void manejarGenerar()}
          >
            {generando ? 'Generando…' : 'Generar exportación'}
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Resultado"
        subtitle="Última exportación generada en esta sesión"
        sx={{ mt: 3 }}
      >
        {generando ? (
          <LoadingState label="Generando exportación…" minHeight={160} />
        ) : resultado ? (
          <>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              <Metadato label="Nombre">
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {resultado.nombre}
                </Typography>
              </Metadato>
              <Metadato label="Formato">
                <StatusChip status="primary" label={resultado.formato.toUpperCase()} />
              </Metadato>
              <Metadato label="Tamaño">
                <Typography variant="body2">
                  {new Intl.NumberFormat('es-CO').format(resultado.tamano)} bytes
                </Typography>
              </Metadato>
              <Metadato label="Generado">
                <Typography variant="body2">
                  {generadoEn ? generadoEn.toLocaleString('es-CO') : '—'}
                </Typography>
              </Metadato>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                SHA-256: {resultado.hashSha256}
              </Typography>
            </Box>
            <Button
              component="a"
              href={resultado.descargaUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              startIcon={<FileCopyIcon />}
              disabled={!resultado.descargaUrl}
              sx={{ mt: 2 }}
            >
              Descargar archivo
            </Button>
          </>
        ) : (
          <EmptyState
            title="Sin resultados todavía"
            description="Genera una exportación para ver aquí sus metadatos y el enlace de descarga."
            icon={<FileCopyIcon />}
            minHeight={160}
          />
        )}
      </SectionCard>
    </Box>
  );
}
