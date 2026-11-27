import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  Description as DescriptionIcon,
  FileDownload as FileDownloadIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import {
  descargarArchivo,
  type ReportCatalogItemDto,
  type ExportacionDto,
  type ProblemDetailsDto,
} from '../api/client';
import { postWithIdempotency } from '../api/idempotent-client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import SearchToolbar from '../components/common/SearchToolbar';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';

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

export default function Reportes() {
  const { hasPermission } = useAuth();
  const [catalogo, setCatalogo] = useState<ReportCatalogItemDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const [tamanoPagina, setTamanoPagina] = useState(5);
  const [reporteSeleccionado, setReporteSeleccionado] = useState<ReportCatalogItemDto | null>(null);
  const [formatoSeleccionado, setFormatoSeleccionado] = useState('');
  const [parametrosJson, setParametrosJson] = useState('{}');
  const [errorParametros, setErrorParametros] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [resultado, setResultado] = useState<ExportacionDto | null>(null);
  const [generadoEn, setGeneradoEn] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const puedeExportar = hasPermission('exports:report:export');
  const puedeCrear = hasPermission('exports:report:create');

  const cargarCatalogo = useCallback(async () => {
    if (!puedeExportar && !puedeCrear) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/reports/catalog');
      if (apiError || !data) {
        setError('No se pudo cargar el catálogo de reportes.');
        return;
      }
      setCatalogo(data.items);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cargar el catálogo de reportes.');
    } finally {
      setCargando(false);
    }
  }, [puedeExportar, puedeCrear]);

  useEffect(() => {
    void cargarCatalogo();
  }, [cargarCatalogo]);

  useEffect(() => {
    setPagina(0);
  }, [busqueda]);

  const catalogoFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es');
    if (!texto) return catalogo;
    return catalogo.filter((reporte) =>
      `${reporte.nombre} ${reporte.descripcion} ${reporte.code}`
        .toLocaleLowerCase('es')
        .includes(texto),
    );
  }, [catalogo, busqueda]);

  const seleccionarReporte = (reporte: ReportCatalogItemDto) => {
    setReporteSeleccionado(reporte);
    setFormatoSeleccionado(reporte.formatos[0] ?? '');
    setParametrosJson('{}');
    setErrorParametros(null);
    setResultado(null);
    setGeneradoEn(null);
    setError(null);
    setExito(null);
  };

  const manejarGenerar = async () => {
    if (!reporteSeleccionado || !formatoSeleccionado) {
      setError('Selecciona un reporte y un formato.');
      return;
    }
    if (!puedeCrear) {
      setError('No tienes permiso para generar reportes.');
      return;
    }

    setError(null);
    let parametros: Record<string, unknown>;
    try {
      const parseado: unknown = JSON.parse(parametrosJson || '{}');
      if (typeof parseado !== 'object' || parseado === null || Array.isArray(parseado)) {
        setErrorParametros(
          'Los parámetros deben ser un objeto JSON, por ejemplo {"periodo": "2026-1"}.',
        );
        return;
      }
      parametros = parseado as Record<string, unknown>;
      if (typeof parametros.periodo !== 'string' || !/^\d{4}-\d+$/.test(parametros.periodo)) {
        setErrorParametros('El parámetro "periodo" debe tener el formato YYYY-P.');
        return;
      }
      setErrorParametros(null);
    } catch {
      setErrorParametros('JSON no válido: revisa las comillas y las comas.');
      return;
    }

    setGenerando(true);
    setError(null);
    setExito(null);
    setResultado(null);
    setGeneradoEn(null);
    try {
      const cuerpo: Record<string, unknown> = {
        periodo: parametros.periodo,
        formato: formatoSeleccionado,
      };
      if (typeof parametros.programaId === 'string') cuerpo.programaId = parametros.programaId;
      if (typeof parametros.grupoId === 'string') cuerpo.grupoId = parametros.grupoId;

      const result = await postWithIdempotency(`/reports/${reporteSeleccionado.code}/generate`, {
        body: cuerpo,
        idempotencyKey: crypto.randomUUID(),
      });

      if (result.error || result.response?.status !== 201) {
        const problema = result.error as ProblemDetailsDto | null;
        setError(problema?.detail || 'No se pudo generar el reporte.');
        return;
      }
      if (!result.data || typeof result.data !== 'object' || !('archivoId' in result.data)) {
        setError('El servicio no devolvió un archivo de reporte.');
        return;
      }
      const dto = result.data as ExportacionDto;
      setResultado(dto);
      setGeneradoEn(new Date());
      setExito(`Reporte "${dto.nombre}" generado correctamente.`);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al generar el reporte.');
    } finally {
      setGenerando(false);
    }
  };

  const descargarResultado = async () => {
    if (!resultado) return;
    setDescargando(true);
    setError(null);
    try {
      // `descargaUrl` apunta a GET /files/{id}/download, que exige Bearer. Abrirlo
      // con window.open no envía la cabecera y el API responde 401; el cliente
      // autenticado añade el token y reintenta tras refrescarlo si expiró.
      const descarga = await descargarArchivo(resultado.archivoId, resultado.nombre);
      if (descarga.ok) {
        setExito(`Archivo "${descarga.nombre}" descargado correctamente.`);
      } else {
        setError(descarga.detail || 'No se pudo descargar el archivo.');
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo descargar el archivo.');
    } finally {
      setDescargando(false);
    }
  };

  const columnas: DataTableColumn<ReportCatalogItemDto>[] = [
    {
      id: 'nombre',
      label: 'Reporte',
      minWidth: 240,
      render: (reporte) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {reporte.nombre}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {reporte.descripcion}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'formatos',
      label: 'Formatos',
      minWidth: 170,
      render: (reporte) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {reporte.formatos.map((formato) => (
            <StatusChip key={formato} status="primary" label={formato.toUpperCase()} />
          ))}
        </Box>
      ),
    },
    {
      id: 'columnas',
      label: 'Columnas',
      minWidth: 180,
      render: (reporte) => (
        <Typography variant="caption" color="text.secondary">
          {reporte.columnas.map((columna) => columna.label).join(', ') || '—'}
        </Typography>
      ),
    },
    {
      id: 'accion',
      label: 'Acción',
      align: 'right',
      minWidth: 130,
      render: (reporte) => (
        <Button size="small" onClick={() => seleccionarReporte(reporte)}>
          {reporteSeleccionado?.code === reporte.code ? 'Seleccionado' : 'Seleccionar'}
        </Button>
      ),
    },
  ];

  const cabecera = (
    <PageHeader
      title="Reportes"
      description="Selecciona un reporte del catálogo, ajusta sus parámetros y descarga el archivo generado."
      icon={<DescriptionIcon />}
      breadcrumbs={[
        { label: 'Inicio', to: '/' },
        { label: 'Reportes y exportaciones' },
        { label: 'Reportes' },
      ]}
      actions={
        puedeExportar || puedeCrear ? (
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void cargarCatalogo()}
            disabled={cargando || generando}
          >
            Actualizar
          </Button>
        ) : (
          <Button component={RouterLink} to="/" startIcon={<HomeIcon />}>
            Ir al inicio
          </Button>
        )
      }
    />
  );

  if (!puedeExportar && !puedeCrear) {
    return (
      <Box>
        {cabecera}
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para consultar reportes (exports:report:export o exports:report:create)."
          icon={<DescriptionIcon />}
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
        title="Catálogo de reportes"
        subtitle="Reportes disponibles según el contrato de la API"
      >
        {cargando && catalogo.length === 0 ? (
          <LoadingState label="Cargando catálogo…" />
        ) : error && catalogo.length === 0 ? (
          <ErrorState message={error} onRetry={() => void cargarCatalogo()} />
        ) : catalogo.length === 0 ? (
          <EmptyState
            title="Sin reportes disponibles"
            description="El catálogo no devolvió reportes para mostrar."
            icon={<DescriptionIcon />}
          />
        ) : (
          <>
            <SearchToolbar
              value={busqueda}
              onChange={setBusqueda}
              label="Buscar reporte"
              placeholder="Nombre, descripción o código"
              resultCount={catalogoFiltrado.length}
            />
            <DataTable
              ariaLabel="Catálogo de reportes"
              columns={columnas}
              rows={catalogoFiltrado.slice(pagina * tamanoPagina, (pagina + 1) * tamanoPagina)}
              rowKey={(reporte) => reporte.code}
              loading={cargando}
              page={pagina}
              pageSize={tamanoPagina}
              total={catalogoFiltrado.length}
              onPageChange={setPagina}
              onPageSizeChange={setTamanoPagina}
            />
          </>
        )}
      </SectionCard>

      <SectionCard
        title={reporteSeleccionado ? `Generar: ${reporteSeleccionado.nombre}` : 'Generar reporte'}
        subtitle={
          reporteSeleccionado
            ? reporteSeleccionado.descripcion
            : 'Selecciona un reporte del catálogo para configurar la generación.'
        }
        sx={{ mt: 3 }}
      >
        {reporteSeleccionado ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 640 }}>
            <FormControl fullWidth>
              <InputLabel id="reporte-formato-label">Formato</InputLabel>
              <Select
                labelId="reporte-formato-label"
                id="reporte-formato"
                label="Formato"
                value={formatoSeleccionado}
                onChange={(event) => setFormatoSeleccionado(event.target.value)}
              >
                {reporteSeleccionado.formatos.map((formato) => (
                  <MenuItem key={formato} value={formato}>
                    {formato.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={5}
              id="reporte-parametros"
              label="Parámetros (JSON)"
              placeholder='{"periodo": "2026-1"}'
              value={parametrosJson}
              onChange={(event) => {
                setParametrosJson(event.target.value);
                setErrorParametros(null);
              }}
              error={Boolean(errorParametros)}
              helperText={
                errorParametros ??
                'Objeto JSON con los filtros de la plantilla. Usa {} si no se requieren parámetros.'
              }
            />

            <Box>
              <Button
                variant="contained"
                startIcon={<FileDownloadIcon />}
                disabled={generando || !formatoSeleccionado || !puedeCrear}
                onClick={() => void manejarGenerar()}
              >
                {generando ? 'Generando…' : 'Generar reporte'}
              </Button>
              {!puedeCrear && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1 }}
                >
                  Necesitas el permiso exports:report:create para generar reportes.
                </Typography>
              )}
            </Box>
          </Box>
        ) : (
          <EmptyState
            title="Selecciona un reporte"
            description="Usa el botón «Seleccionar» del catálogo para cargar sus formatos y parámetros."
            icon={<DescriptionIcon />}
            minHeight={180}
          />
        )}
      </SectionCard>

      <SectionCard
        title="Resultado"
        subtitle="Último archivo generado en esta sesión"
        sx={{ mt: 3 }}
      >
        {generando ? (
          <LoadingState label="Generando reporte…" minHeight={160} />
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
            <Button
              startIcon={<FileDownloadIcon />}
              variant="contained"
              onClick={() => void descargarResultado()}
              disabled={descargando || !resultado.archivoId}
              sx={{ mt: 2 }}
            >
              Descargar archivo
            </Button>
          </>
        ) : (
          <EmptyState
            title="Sin resultados todavía"
            description="Genera un reporte para ver aquí sus metadatos y el enlace de descarga."
            icon={<FileDownloadIcon />}
            minHeight={160}
          />
        )}
      </SectionCard>
    </Box>
  );
}
