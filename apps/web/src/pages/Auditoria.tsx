import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import {
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

import { apiClient, type EventoAuditoriaDto } from '../api/client';
import { getErrorMessage } from '../api/errors';
import { useAuth } from '../contexts/AuthContext';
import DataTable, { type DataTableColumn } from '../components/common/DataTable';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatusChip from '../components/common/StatusChip';

type Filtros = {
  desde: string;
  hasta: string;
  actorId: string;
  recurso: string;
  accion: string;
};

const FILTROS_VACIOS: Filtros = {
  desde: '',
  hasta: '',
  actorId: '',
  recurso: '',
  accion: '',
};

const LIMITE = 25;

function aIso(valor: string): string | undefined {
  if (!valor) return undefined;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleString('es-CO');
}

function comoTexto(valor: unknown): string {
  return valor === null || valor === undefined ? '—' : JSON.stringify(valor, null, 2);
}

export default function Auditoria() {
  const { hasPermission } = useAuth();
  const puedeConsultar = hasPermission('audit:event:read');

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VACIOS);
  const [eventos, setEventos] = useState<EventoAuditoriaDto[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<EventoAuditoriaDto | null>(null);

  const cargar = useCallback(async () => {
    if (!puedeConsultar) return;
    setCargando(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.GET('/audit/events', {
        params: {
          query: {
            from: aIso(aplicados.desde),
            to: aIso(aplicados.hasta),
            actorId: aplicados.actorId.trim() || undefined,
            recurso: aplicados.recurso.trim() || undefined,
            accion: aplicados.accion.trim() || undefined,
            limit: LIMITE,
            offset,
          },
        },
      });
      if (apiError || !data) {
        setError(apiError?.detail ?? 'No se pudo consultar la auditoría.');
        return;
      }
      setEventos(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al consultar la auditoría.');
    } finally {
      setCargando(false);
    }
  }, [puedeConsultar, aplicados, offset]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const actualizarFiltro = (campo: keyof Filtros, valor: string) => {
    setFiltros((previos) => ({ ...previos, [campo]: valor }));
  };

  const aplicar = () => {
    setOffset(0);
    setAplicados({ ...filtros });
  };

  const limpiar = () => {
    setFiltros(FILTROS_VACIOS);
    setAplicados(FILTROS_VACIOS);
    setOffset(0);
  };

  const columnas: DataTableColumn<EventoAuditoriaDto>[] = [
    {
      id: 'ocurridoEn',
      label: 'Fecha',
      minWidth: 180,
      render: (evento) => (
        <Typography variant="body2">{formatearFecha(evento.ocurridoEn)}</Typography>
      ),
    },
    {
      id: 'accion',
      label: 'Acción',
      minWidth: 180,
      render: (evento) => <StatusChip status="info" label={evento.accion} />,
    },
    {
      id: 'actor',
      label: 'Actor',
      minWidth: 200,
      render: (evento) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {evento.actorPerfil ?? 'Sistema'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {evento.actorId ?? '—'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'recurso',
      label: 'Recurso',
      minWidth: 190,
      render: (evento) => (
        <Box>
          <Typography variant="body2">{evento.recurso}</Typography>
          <Typography variant="caption" color="text.secondary">
            {evento.recursoId ?? '—'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'requestId',
      label: 'requestId',
      minWidth: 180,
      render: (evento) => (
        <Typography variant="caption" color="text.secondary">
          {evento.requestId ?? '—'}
        </Typography>
      ),
    },
    {
      id: 'acciones',
      label: 'Acciones',
      align: 'right',
      minWidth: 120,
      render: (evento) => (
        <Button
          size="small"
          startIcon={<VisibilityIcon fontSize="small" />}
          onClick={() => setDetalle(evento)}
        >
          Detalle
        </Button>
      ),
    },
  ];

  if (!puedeConsultar) {
    return (
      <Box>
        <PageHeader
          title="Auditoría"
          description="Consulta de eventos de seguridad y trazabilidad."
          icon={<HistoryIcon />}
          breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Auditoría' }]}
        />
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para consultar los eventos de auditoría."
          icon={<HistoryIcon />}
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Auditoría"
        description="Consulta los eventos registrados por el sistema, filtrando por fecha, actor o recurso."
        icon={<HistoryIcon />}
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Auditoría' }]}
        actions={
          <Button startIcon={<RefreshIcon />} onClick={() => void cargar()} disabled={cargando}>
            Actualizar
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <SectionCard
        title="Filtros"
        subtitle="La propia consulta queda registrada en auditoría."
        sx={{ mb: 2 }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(5, minmax(0, 1fr))',
            },
          }}
        >
          <TextField
            label="Desde"
            type="datetime-local"
            value={filtros.desde}
            onChange={(event) => actualizarFiltro('desde', event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
          />
          <TextField
            label="Hasta"
            type="datetime-local"
            value={filtros.hasta}
            onChange={(event) => actualizarFiltro('hasta', event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
          />
          <TextField
            label="ID del actor"
            value={filtros.actorId}
            onChange={(event) => actualizarFiltro('actorId', event.target.value)}
            size="small"
          />
          <TextField
            label="Recurso"
            value={filtros.recurso}
            onChange={(event) => actualizarFiltro('recurso', event.target.value)}
            size="small"
          />
          <TextField
            label="Acción"
            value={filtros.accion}
            onChange={(event) => actualizarFiltro('accion', event.target.value)}
            size="small"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
          <Button variant="contained" onClick={aplicar} disabled={cargando}>
            Aplicar filtros
          </Button>
          <Button onClick={limpiar} disabled={cargando}>
            Limpiar
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Eventos"
        subtitle={`${total} evento(s) registrado(s)`}
        action={
          error && eventos.length === 0 ? (
            <ErrorState message={error} onRetry={() => void cargar()} minHeight={120} />
          ) : null
        }
      >
        {cargando && eventos.length === 0 ? (
          <LoadingState label="Cargando eventos…" minHeight={180} />
        ) : (
          <DataTable
            ariaLabel="Eventos de auditoría"
            columns={columnas}
            rows={eventos}
            rowKey={(evento) => evento.id}
            loading={cargando}
            page={Math.floor(offset / LIMITE)}
            pageSize={LIMITE}
            total={total}
            onPageChange={(pagina) => setOffset(pagina * LIMITE)}
            onPageSizeChange={() => setOffset(0)}
            emptyMessage="No hay eventos que coincidan con los filtros."
          />
        )}
      </SectionCard>

      <Dialog
        open={Boolean(detalle)}
        onClose={() => setDetalle(null)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="titulo-detalle-evento"
      >
        <DialogTitle id="titulo-detalle-evento">Detalle del evento</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {detalle && (
            <>
              <Typography variant="body2">
                <strong>Acción:</strong> {detalle.accion}
              </Typography>
              <Typography variant="body2">
                <strong>Fecha:</strong> {formatearFecha(detalle.ocurridoEn)}
              </Typography>
              <Typography variant="body2">
                <strong>IP:</strong> {detalle.ip ?? '—'}
              </Typography>
              <Typography variant="body2">
                <strong>Dispositivo:</strong> {detalle.dispositivo ?? '—'}
              </Typography>
              <Typography variant="subtitle2">Datos antes</Typography>
              <Typography component="pre" variant="caption" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                {comoTexto(detalle.datosAntes)}
              </Typography>
              <Typography variant="subtitle2">Datos después</Typography>
              <Typography component="pre" variant="caption" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                {comoTexto(detalle.datosDespues)}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetalle(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
