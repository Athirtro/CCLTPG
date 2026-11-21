import { useState } from 'react';
import { Box, Button, Paper, TextField, Typography, Alert } from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { ProblemDetailsDto } from '../api/client';

const LISTA_BLANCA_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_TAMANO_MB = 10;

export default function Archivos() {
  const { hasPermission } = useAuth();
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const validarAntesDeSubir = (file: File): string | null => {
    if (!file) return 'Selecciona un archivo';
    if (file.size > MAX_TAMANO_MB * 1024 * 1024) {
      return `El archivo supera los ${MAX_TAMANO_MB} MB`;
    }
    if (!LISTA_BLANCA_MIME.includes(file.type)) {
      return 'Tipo de archivo no permitido (pdf, png, jpg, docx, xlsx)';
    }
    return null;
  };

  const manejarSeleccionArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setArchivoSeleccionado(file);
    setNombreArchivo(file?.name ?? '');
    setError(null);
    setExito(null);
  };

  const manejarSubida = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExito(null);

    if (!archivoSeleccionado) {
      setError('Selecciona un archivo');
      return;
    }

    const errorValidacion = validarAntesDeSubir(archivoSeleccionado);
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('archivo', archivoSeleccionado);

      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/files', {
        body: formData,
        headers: {
          'Idempotency-Key': idempotencyKey.trim(),
        },
      });

      if (apiError || response?.status !== 200) {
        const problema = apiError as ProblemDetailsDto;
        setError(problema?.detail || 'Error al subir el archivo');
        return;
      }

      const dto = data;
      setExito(`Archivo "${dto.archivo.nombreOriginal}" subido correctamente`);
      setArchivoSeleccionado(null);
      setNombreArchivo('');
      setIdempotencyKey('');
    } catch (err) {
      setError(getErrorMessage(err) || 'Error inesperado al subir');
    } finally {
      setSubiendo(false);
    }
  };

  const puedeSubir = hasPermission('files:document:create');

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Gestión de Archivos</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Carga archivos con validación de tipo, tamaño ({MAX_TAMANO_MB} MB) e idempotencia. La
        descarga y el listado se habilitarán cuando el Rol B implemente los endpoints
        correspondientes.
      </Typography>

      {!puedeSubir && (
        <Alert severity="warning">
          No tienes permiso para subir archivos. Contacta al administrador.
        </Alert>
      )}

      {puedeSubir && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Subir archivo
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
          <form onSubmit={manejarSubida} noValidate>
            <Box sx={{ mb: 2 }}>
              <input
                type="file"
                accept=".pdf, .png, .jpg, .jpeg, .docx, .xlsx"
                onChange={manejarSeleccionArchivo}
                style={{ display: 'none' }}
                id="file-input"
              />
              <Box
                component="label"
                htmlFor="file-input"
                sx={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  border: '1px dashed',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <CloudUploadIcon fontSize="medium" />
                {nombreArchivo || 'Seleccionar archivo'}
              </Box>
            </Box>
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Límite: {MAX_TAMANO_MB} MB · Tipos: PDF, PNG, JPG, DOCX, XLSX
              </Typography>
            </Box>
            <TextField
              fullWidth
              label="Idempotency-Key (opcional)"
              placeholder="Clave para evitar duplicados"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              helperText="Si se repite la misma clave con el mismo cuerpo, se devuelve el resultado original"
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              startIcon={<CloudUploadIcon />}
              disabled={subiendo || !archivoSeleccionado}
            >
              {subiendo ? 'Subiendo…' : 'Subir archivo'}
            </Button>
          </form>
        </Paper>
      )}
    </Box>
  );
}
