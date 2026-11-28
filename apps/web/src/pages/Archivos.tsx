import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Alert, Box, Button, LinearProgress, TextField, Typography } from '@mui/material';
import { CloudUpload as CloudUploadIcon, Home as HomeIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { FileResponseDto, ProblemDetailsDto } from '../api/client';
import { postWithIdempotency } from '../api/idempotent-client';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';

const LISTA_BLANCA_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_TAMANO_MB = 10;

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleString('es-CO');
}

function Metadato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ mt: 0.5, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export default function Archivos() {
  const { hasPermission } = useAuth();
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [resultado, setResultado] = useState<FileResponseDto | null>(null);

  const puedeSubir = hasPermission('files:document:create');

  const validarAntesDeSubir = (file: File): string | null => {
    if (file.size > MAX_TAMANO_MB * 1024 * 1024) {
      return `El archivo supera los ${MAX_TAMANO_MB} MB.`;
    }
    if (!LISTA_BLANCA_MIME.includes(file.type)) {
      return 'Tipo de archivo no permitido. Usa PDF, PNG, JPG, DOCX o XLSX.';
    }
    return null;
  };

  const manejarSeleccionArchivo = (event: ChangeEvent<HTMLInputElement>) => {
    setArchivoSeleccionado(event.target.files?.[0] ?? null);
    setError(null);
    setExito(null);
    setResultado(null);
  };

  const manejarSubida = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setExito(null);

    if (!puedeSubir) {
      setError('No tienes permiso para subir archivos.');
      return;
    }
    if (!archivoSeleccionado) {
      setError('Selecciona un archivo.');
      return;
    }
    const errorValidacion = validarAntesDeSubir(archivoSeleccionado);
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    setSubiendo(true);
    setResultado(null);
    try {
      const formData = new FormData();
      formData.append('file', archivoSeleccionado);

      // `POST /files` exige Idempotency-Key. Si el usuario no escribió una,
      // generamos una y la dejamos visible para que un reintento con el mismo
      // archivo reutilice la clave en lugar de crear otra carga.
      const clave = idempotencyKey.trim() || crypto.randomUUID();
      setIdempotencyKey(clave);

      const result = await postWithIdempotency('/files', {
        body: formData,
        idempotencyKey: clave,
      });

      if (result.error || result.response?.status !== 201) {
        const problema = result.error as ProblemDetailsDto | null;
        setError(problema?.detail || 'No se pudo subir el archivo.');
        return;
      }
      const dto = result.data as FileResponseDto | null;
      if (
        !dto ||
        typeof dto !== 'object' ||
        typeof dto.id !== 'string' ||
        typeof dto.nombreOriginal !== 'string'
      ) {
        setError('El servicio no devolvió los metadatos del archivo.');
        return;
      }

      setResultado(dto);
      setExito(`Archivo "${dto.nombreOriginal}" subido correctamente.`);
      setArchivoSeleccionado(null);
      setIdempotencyKey('');
      const input = document.getElementById('archivo-input') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al subir el archivo.');
    } finally {
      setSubiendo(false);
    }
  };

  const cabecera = (
    <PageHeader
      title="Gestión de archivos"
      description="Carga documentos con validación de tipo y tamaño; la clave de idempotencia se genera automáticamente si se deja vacía."
      icon={<CloudUploadIcon />}
      breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Operaciones' }, { label: 'Archivos' }]}
      actions={
        <Button component={RouterLink} to="/" startIcon={<HomeIcon />}>
          Ir al inicio
        </Button>
      }
    />
  );

  return (
    <Box>
      {cabecera}

      {!puedeSubir ? (
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para subir archivos (files:document:create)."
          icon={<CloudUploadIcon />}
        />
      ) : (
        <>
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
          <SectionCard title="Subir archivo" subtitle="PDF, PNG, JPG, DOCX o XLSX · Máximo 10 MB">
            <Box component="form" noValidate onSubmit={(event) => void manejarSubida(event)}>
              <input
                type="file"
                accept=".pdf, .png, .jpg, .jpeg, .docx, .xlsx"
                onChange={manejarSeleccionArchivo}
                id="archivo-input"
                style={{ display: 'none' }}
              />
              <Box
                component="label"
                htmlFor="archivo-input"
                sx={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 2,
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'background.default',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <CloudUploadIcon fontSize="medium" color="primary" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {archivoSeleccionado ? archivoSeleccionado.name : 'Seleccionar archivo'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {archivoSeleccionado
                      ? formatearTamano(archivoSeleccionado.size)
                      : 'Haz clic para elegir un archivo'}
                  </Typography>
                </Box>
              </Box>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1, mb: 2 }}
              >
                Límite: {MAX_TAMANO_MB} MB · Tipos permitidos: PDF, PNG, JPG, DOCX, XLSX
              </Typography>

              <TextField
                fullWidth
                id="archivo-idempotencia"
                label="Idempotency-Key (se genera sola)"
                placeholder="Déjala vacía para generar una clave única"
                value={idempotencyKey}
                onChange={(event) => setIdempotencyKey(event.target.value)}
                helperText="Se envía siempre. Si repites la clave con el mismo archivo, se devuelve el resultado original."
                sx={{ mb: 2 }}
              />

              {subiendo && <LinearProgress sx={{ mb: 2 }} aria-label="Subiendo archivo" />}

              <Button
                type="submit"
                variant="contained"
                startIcon={<CloudUploadIcon />}
                disabled={subiendo || !archivoSeleccionado}
              >
                {subiendo ? 'Subiendo…' : 'Subir archivo'}
              </Button>
            </Box>
          </SectionCard>

          <SectionCard
            title="Resultado de la última carga"
            subtitle="Metadatos devueltos por el servicio de archivos"
            sx={{ mt: 3 }}
          >
            {subiendo ? (
              <LoadingState label="Subiendo archivo…" minHeight={160} />
            ) : resultado ? (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(3, minmax(0, 1fr))',
                    },
                  }}
                >
                  <Metadato label="Identificador">
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {resultado.id}
                    </Typography>
                  </Metadato>
                  <Metadato label="Nombre original">
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {resultado.nombreOriginal}
                    </Typography>
                  </Metadato>
                  <Metadato label="Tipo MIME">
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {resultado.mime}
                    </Typography>
                  </Metadato>
                  <Metadato label="Tamaño">
                    <Typography variant="body2">
                      {formatearTamano(resultado.tamano)} ({resultado.tamano} bytes)
                    </Typography>
                  </Metadato>
                  <Metadato label="Estado del escaneo">
                    <StatusChip status={resultado.estadoEscaneo} />
                  </Metadato>
                  <Metadato label="Creado en">
                    <Typography variant="body2">{formatearFecha(resultado.creadoEn)}</Typography>
                  </Metadato>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ wordBreak: 'break-all' }}
                  >
                    SHA-256: {resultado.hashSha256}
                  </Typography>
                </Box>
              </>
            ) : (
              <EmptyState
                title="Sin cargas recientes"
                description="El contrato no dispone de un endpoint para listar archivos. Tras subir uno, aquí se mostrarán sus metadatos reales."
                icon={<CloudUploadIcon />}
                minHeight={160}
              />
            )}
          </SectionCard>
        </>
      )}
    </Box>
  );
}
