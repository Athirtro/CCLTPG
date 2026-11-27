import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

/** Referencia lógica a un equipo de la emisora (UUID, sin FK a otros contextos). */
const EQUIPO_ID = 'dddddddd-0000-4000-8000-000000000001';

import {
  apiClient,
  descargarArchivo,
  type EmisoraIncentivoView,
  type EmisoraResolucionView,
} from '../../../api/client';
import { getErrorMessage } from '../../../api/errors';
import { useAuth } from '../../../contexts/AuthContext';
import DataTable, { type DataTableColumn } from '../../../components/common/DataTable';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import PageHeader from '../../../components/common/PageHeader';
import SectionCard from '../../../components/common/SectionCard';
import StatusChip from '../../../components/common/StatusChip';

/** Fecha sugerida con margen suficiente para la antelación del préstamo de mifi. */
const FECHA_SUGERIDA = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function guardar(mensaje: string): never {
  throw new Error(mensaje);
}

function clave(): string {
  return crypto.randomUUID();
}

/**
 * Operación E3: patrocinios, promos, órdenes, transmisiones y resolución PDF.
 *
 * La API no expone listados para estos agregados: los identificadores se toman
 * del resultado de cada creación y se reutilizan en el mismo recorrido. Cada
 * botón comprueba el permiso antes de llamar al backend, que sigue siendo la
 * autoridad final (RBAC y reglas de plazo se validan allí).
 */
export default function EmisoraOperacionE3() {
  const { hasPermission } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [resolucionUrl, setResolucionUrl] = useState<string | null>(null);

  const [nombrePatrocinio, setNombrePatrocinio] = useState('Cultura en la plaza');
  const [entidadPatrocinio, setEntidadPatrocinio] = useState('Alcaldía municipal');
  const [contratoArchivoId, setContratoArchivoId] = useState('');
  const [patrocinioId, setPatrocinioId] = useState('');
  const [nombrePromo, setNombrePromo] = useState('Promo de la semana cultural');
  const [duracionPromo, setDuracionPromo] = useState('30');
  const [audioPromoId, setAudioPromoId] = useState('');
  const [promoId, setPromoId] = useState('');
  const [ordenId, setOrdenId] = useState('');
  const [publicacionId, setPublicacionId] = useState('');
  const [canalPublicacion, setCanalPublicacion] = useState('facebook');
  const [fechaPublicacion, setFechaPublicacion] = useState(FECHA_SUGERIDA);
  const [fechaTransmision, setFechaTransmision] = useState(FECHA_SUGERIDA);
  const [esFueraCiudad, setEsFueraCiudad] = useState(true);
  const [destino, setDestino] = useState('Villa de Leyva');
  const [transmisionId, setTransmisionId] = useState('');
  const [equipoId, setEquipoId] = useState(EQUIPO_ID);
  const [responsableId, setResponsableId] = useState('');
  const [vehiculo, setVehiculo] = useState('Vehículo 01');
  const [usuarioMifi, setUsuarioMifi] = useState('');
  const [prestamoId, setPrestamoId] = useState('');
  const [usuarioViatico, setUsuarioViatico] = useState('');
  const [incentivoId, setIncentivoId] = useState('');
  const [periodo, setPeriodo] = useState('2026');
  const [incentivos, setIncentivos] = useState<EmisoraIncentivoView[]>([]);
  const [resolucion, setResolucion] = useState<EmisoraResolucionView | null>(null);
  const [estadoIncentivo, setEstadoIncentivo] = useState('calificado');
  const [calificacion, setCalificacion] = useState('85');
  const [referenciaCdp, setReferenciaCdp] = useState('');

  const cargarIncentivos = useCallback(async () => {
    const { data, error: apiError } = await apiClient.GET('/emisora/incentivos');
    if (apiError || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo cargar el listado de incentivos.');
    }
    setIncentivos(data);
  }, []);

  useEffect(() => {
    if (hasPermission('emisora:incentivo:read')) void cargarIncentivos().catch(() => undefined);
  }, [cargarIncentivos, hasPermission]);

  async function ejecutar(accion: () => Promise<void>, exito: string): Promise<void> {
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      await accion();
      setMensaje(exito);
    } catch (err) {
      setError(getErrorMessage(err) || 'La operación no pudo completarse.');
    } finally {
      setEnviando(false);
    }
  }

  async function proponerPatrocinio(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/patrocinios', {
      body: {
        nombre: nombrePatrocinio.trim(),
        entidad: entidadPatrocinio.trim(),
        ...(contratoArchivoId.trim() ? { contratoArchivoId: contratoArchivoId.trim() } : {}),
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo proponer el patrocinio.');
    }
    setPatrocinioId(data.id);
  }

  async function aprobarPatrocinio(): Promise<void> {
    if (!patrocinioId.trim()) guardar('Primero propón un patrocinio.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/patrocinios/{id}/transitions',
      {
        params: { path: { id: patrocinioId.trim() } },
        body: {
          to: 'aprobado',
          ...(contratoArchivoId.trim() ? { contratoArchivoId: contratoArchivoId.trim() } : {}),
        },
      },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo aprobar el patrocinio.');
    }
  }

  async function registrarPromo(): Promise<void> {
    if (!patrocinioId.trim()) guardar('Primero aproba un patrocinio.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/promos', {
      body: {
        patrocinioId: patrocinioId.trim(),
        nombre: nombrePromo.trim(),
        duracionSegundos: Number(duracionPromo),
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar la promo.');
    }
    setPromoId(data.id);
  }

  async function producirPromo(): Promise<void> {
    if (!promoId.trim() || !audioPromoId.trim()) {
      guardar('Indica la promo y el ID del audio limpio.');
    }
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/promos/{id}/transitions',
      {
        params: { path: { id: promoId.trim() } },
        body: { to: 'producida', audioArchivoId: audioPromoId.trim() },
      },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo producir la promo.');
    }
  }

  async function crearOrden(): Promise<void> {
    if (!promoId.trim()) guardar('Primero produce una promo.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/ordenes-emision', {
      body: { promoId: promoId.trim(), fechaEmision: fechaPublicacion },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo crear la orden de emisión.');
    }
    setOrdenId(data.id);
  }

  async function programarOrden(): Promise<void> {
    if (!ordenId.trim()) guardar('Primero crea una orden de emisión.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/ordenes-emision/{id}/transitions',
      { params: { path: { id: ordenId.trim() } }, body: { to: 'programada' } },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo programar la orden.');
    }
  }

  async function emitirOrden(): Promise<void> {
    if (!ordenId.trim()) guardar('Primero crea una orden de emisión.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/ordenes-emision/{id}/transitions',
      { params: { path: { id: ordenId.trim() } }, body: { to: 'emitida' } },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo emitir la orden.');
    }
  }

  async function programarPublicacion(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/publicaciones', {
      body: {
        ...(promoId.trim() ? { promoId: promoId.trim() } : {}),
        canal: canalPublicacion.trim(),
        fechaPublicacion,
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo programar la publicación.');
    }
    setPublicacionId(data.id);
  }

  async function publicar(): Promise<void> {
    if (!publicacionId.trim()) guardar('Primero programa una publicación.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/publicaciones/{id}/transitions',
      { params: { path: { id: publicacionId.trim() } }, body: { to: 'publicada' } },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo marcar la publicación como realizada.');
    }
  }

  async function programarTransmision(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/transmisiones', {
      body: {
        fechaTransmision,
        esFueraCiudad,
        ...(esFueraCiudad && destino.trim() ? { destino: destino.trim() } : {}),
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo programar la transmisión.');
    }
    setTransmisionId(data.id);
  }

  async function registrarSalida(): Promise<void> {
    if (!transmisionId.trim() || !responsableId.trim()) {
      guardar('Indica la transmisión y el responsable del equipo.');
    }
    const { error: apiError, response } = await apiClient.POST('/emisora/salidas-equipo', {
      body: {
        transmisionId: transmisionId.trim(),
        equipoId: equipoId.trim(),
        responsableId: responsableId.trim(),
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar la salida de equipo.');
    }
  }

  async function registrarDesplazamiento(): Promise<void> {
    if (!transmisionId.trim()) guardar('Primero programa una transmisión.');
    const { error: apiError, response } = await apiClient.POST('/emisora/reportes-desplazamiento', {
      body: { transmisionId: transmisionId.trim(), vehiculo: vehiculo.trim() },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar el desplazamiento.');
    }
  }

  async function autorizarTransmision(): Promise<void> {
    if (!transmisionId.trim()) guardar('Primero programa una transmisión.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/transmisiones/{id}/transitions',
      { params: { path: { id: transmisionId.trim() } }, body: { to: 'autorizada' } },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo autorizar la transmisión.');
    }
  }

  async function solicitarMifi(): Promise<void> {
    if (!transmisionId.trim() || !usuarioMifi.trim()) {
      guardar('Indica la transmisión y el usuario del mifi.');
    }
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/prestamos-mifi', {
      body: { transmisionId: transmisionId.trim(), usuarioId: usuarioMifi.trim() },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo solicitar el mifi.');
    }
    setPrestamoId(data.id);
  }

  async function autorizarMifi(): Promise<void> {
    if (!prestamoId.trim()) guardar('Primero solicita el préstamo del mifi.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/prestamos-mifi/{id}/transitions',
      { params: { path: { id: prestamoId.trim() } }, body: { to: 'autorizado' } },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo autorizar el préstamo.');
    }
  }

  async function solicitarViatico(): Promise<void> {
    if (!transmisionId.trim() || !usuarioViatico.trim()) {
      guardar('Indica la transmisión y el usuario del viático.');
    }
    const { error: apiError, response } = await apiClient.POST('/emisora/viaticos', {
      body: { transmisionId: transmisionId.trim(), usuarioId: usuarioViatico.trim() },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo solicitar el viático.');
    }
  }

  async function calificarIncentivo(): Promise<void> {
    if (!incentivoId.trim()) guardar('Indica el incentivo a calificar.');
    const nota = Number(calificacion);
    if (!Number.isFinite(nota) || nota < 0 || nota > 100) {
      guardar('La calificación debe estar entre 0 y 100.');
    }
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.PATCH('/emisora/incentivos/{id}', {
      params: { path: { id: incentivoId.trim() } },
      body: {
        to: estadoIncentivo as 'calificado' | 'asignado' | 'resuelto' | 'solicitud_cdp',
        calificacion: nota,
        ...(referenciaCdp.trim() ? { referenciaCdp: referenciaCdp.trim() } : {}),
      },
    });
    if (apiError || response?.status !== 200 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo actualizar el incentivo.');
    }
    await cargarIncentivos();
  }

  async function consultarResolucionPdf(): Promise<void> {
    if (!resolucion) guardar('Primero genera o consulta una resolución.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.GET('/emisora/resoluciones/{id}/pdf', {
      params: { path: { id: resolucion.id } },
    });
    if (apiError || response?.status !== 200 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo consultar la resolución.');
    }
    setResolucion(data);
    setResolucionUrl(data.descargaUrl);
  }

  async function descargarResolucion(): Promise<void> {
    const archivoId = resolucion?.archivoId ?? resolucionUrl?.split('/').at(-2);
    if (!archivoId) guardar('Primero genera la resolución.');
    const resultado = await descargarArchivo(archivoId, 'resolucion-incentivos.pdf');
    if (!resultado.ok) {
      guardar(resultado.detail || 'No se pudo descargar la resolución.');
    }
  }

  async function generarResolucion(): Promise<void> {
    if (!incentivoId.trim()) guardar('Indica el incentivo resuelto.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/resoluciones', {
      body: { incentivoId: incentivoId.trim(), periodo: periodo.trim() },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo generar la resolución.');
    }
    setResolucion(data);
    setResolucionUrl(data.descargaUrl);
    await cargarIncentivos();
  }

  const columnasIncentivos: DataTableColumn<EmisoraIncentivoView>[] = [
    { id: 'realizador', label: 'Realizador', render: (fila) => fila.realizadorId },
    { id: 'informe', label: 'Informe', render: (fila) => fila.informeId },
    { id: 'estado', label: 'Estado', render: (fila) => <StatusChip status={fila.estado} /> },
    {
      id: 'calificacion',
      label: 'Calificación',
      render: (fila) => (fila.calificacion === null ? '—' : fila.calificacion),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Operación E3 de la emisora"
        description="Patrocinios, promos, órdenes de emisión, transmisiones, mifi, viáticos y resolución PDF (RF-03.7, RF-04, RF-05 y RF-06)."
        breadcrumbs={[
          { label: 'Inicio', to: '/' },
          { label: 'Emisora R.A.C.', to: '/emisora' },
          { label: 'Operación E3' },
        ]}
      />

      {error && <ErrorState message={error} sx={{ mb: 3 }} />}
      {mensaje && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {mensaje}
        </Alert>
      )}
      {enviando && <LinearProgress sx={{ mb: 2 }} aria-label="Procesando operación E3" />}

      <SectionCard
        title="Patrocinios y promos"
        subtitle="RF-04/RF-05 — contrato PDF y audio limpio verificados en Archivos"
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
          <TextField
            label="Nombre del patrocinio"
            value={nombrePatrocinio}
            onChange={(event) => setNombrePatrocinio(event.target.value)}
            sx={{ flex: '1 1 240px' }}
          />
          <TextField
            label="Entidad patrocinadora"
            value={entidadPatrocinio}
            onChange={(event) => setEntidadPatrocinio(event.target.value)}
            sx={{ flex: '1 1 240px' }}
          />
          <TextField
            label="ID del contrato PDF"
            value={contratoArchivoId}
            onChange={(event) => setContratoArchivoId(event.target.value)}
            placeholder="UUID del archivo cargado en Archivos"
            sx={{ flex: '1 1 280px' }}
          />
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:patrocinio:create')}
            onClick={() => void ejecutar(proponerPatrocinio, 'Patrocinio propuesto.')}
          >
            Proponer patrocinio
          </Button>
          <Button
            variant="contained"
            disabled={enviando || !patrocinioId || !hasPermission('emisora:patrocinio:update')}
            onClick={() => void ejecutar(aprobarPatrocinio, 'Patrocinio aprobado con contrato.')}
          >
            Aprobar patrocinio
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            label="ID del patrocinio"
            value={patrocinioId}
            onChange={(event) => setPatrocinioId(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <TextField
            label="Nombre de la promo"
            value={nombrePromo}
            onChange={(event) => setNombrePromo(event.target.value)}
            sx={{ flex: '1 1 240px' }}
          />
          <TextField
            label="Duración (segundos)"
            type="number"
            value={duracionPromo}
            onChange={(event) => setDuracionPromo(event.target.value)}
            slotProps={{ htmlInput: { min: 1 } }}
            sx={{ flex: '1 1 160px' }}
          />
          <TextField
            label="ID del audio limpio"
            value={audioPromoId}
            onChange={(event) => setAudioPromoId(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <TextField
            label="ID de la promo"
            value={promoId}
            onChange={(event) => setPromoId(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:promo:create')}
            onClick={() => void ejecutar(registrarPromo, 'Promo registrada en borrador.')}
          >
            Registrar promo
          </Button>
          <Button
            variant="contained"
            disabled={enviando || !promoId || !hasPermission('emisora:promo:update')}
            onClick={() => void ejecutar(producirPromo, 'Promo producida con audio verificado.')}
          >
            Producir promo
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Orden de emisión y publicación"
        subtitle="La orden exige promo producida; la publicación conserva su canal y fecha"
        sx={{ mt: 3 }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            label="ID de la orden"
            value={ordenId}
            onChange={(event) => setOrdenId(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <TextField
            label="Canal de publicación"
            value={canalPublicacion}
            onChange={(event) => setCanalPublicacion(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <TextField
            label="Fecha de publicación"
            type="date"
            value={fechaPublicacion}
            onChange={(event) => setFechaPublicacion(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: '1 1 200px' }}
          />
          <TextField
            label="ID de la publicación"
            value={publicacionId}
            onChange={(event) => setPublicacionId(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:patrocinio:create')}
            onClick={() => void ejecutar(crearOrden, 'Orden de emisión creada.')}
          >
            Crear orden
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !ordenId || !hasPermission('emisora:patrocinio:update')}
            onClick={() => void ejecutar(programarOrden, 'Orden de emisión programada.')}
          >
            Programar orden
          </Button>
          <Button
            variant="contained"
            disabled={enviando || !ordenId || !hasPermission('emisora:patrocinio:update')}
            onClick={() => void ejecutar(emitirOrden, 'Orden de emisión emitida.')}
          >
            Emitir orden
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:publicacion:create')}
            onClick={() => void ejecutar(programarPublicacion, 'Publicación programada.')}
          >
            Programar publicación
          </Button>
          <Button
            variant="contained"
            disabled={enviando || !publicacionId || !hasPermission('emisora:publicacion:update')}
            onClick={() => void ejecutar(publicar, 'Publicación realizada.')}
          >
            Publicar
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Transmisiones y soportes"
        subtitle="RF-06 — autorizar exige salida de equipo y reporte de desplazamiento"
        sx={{ mt: 3 }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
          <TextField
            label="Fecha de transmisión"
            type="date"
            value={fechaTransmision}
            onChange={(event) => setFechaTransmision(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: '1 1 200px' }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={esFueraCiudad}
                onChange={(event) => setEsFueraCiudad(event.target.checked)}
              />
            }
            label="Fuera de la ciudad"
          />
          <TextField
            label="Destino"
            value={destino}
            onChange={(event) => setDestino(event.target.value)}
            disabled={!esFueraCiudad}
            sx={{ flex: '1 1 220px' }}
          />
          <TextField
            label="ID de la transmisión"
            value={transmisionId}
            onChange={(event) => setTransmisionId(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:transmision:create')}
            onClick={() => void ejecutar(programarTransmision, 'Transmisión programada.')}
          >
            Programar transmisión
          </Button>
          <Button
            variant="contained"
            disabled={enviando || !transmisionId || !hasPermission('emisora:transmision:update')}
            onClick={() => void ejecutar(autorizarTransmision, 'Transmisión autorizada.')}
          >
            Autorizar transmisión
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            label="Equipo"
            value={equipoId}
            onChange={(event) => setEquipoId(event.target.value)}
            sx={{ flex: '1 1 160px' }}
          />
          <TextField
            label="Responsable del equipo"
            value={responsableId}
            onChange={(event) => setResponsableId(event.target.value)}
            sx={{ flex: '1 1 240px' }}
          />
          <TextField
            label="Vehículo"
            value={vehiculo}
            onChange={(event) => setVehiculo(event.target.value)}
            sx={{ flex: '1 1 200px' }}
          />
          <Button
            variant="outlined"
            disabled={enviando || !transmisionId || !hasPermission('emisora:transmision:create')}
            onClick={() => void ejecutar(registrarSalida, 'Salida de equipo registrada.')}
          >
            Registrar salida
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !transmisionId || !hasPermission('emisora:transmision:create')}
            onClick={() => void ejecutar(registrarDesplazamiento, 'Desplazamiento registrado.')}
          >
            Registrar desplazamiento
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Mifi y viáticos"
        subtitle="Dos días calendario de antelación en Bogotá; viático solo fuera de la ciudad"
        sx={{ mt: 3 }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            label="Usuario del mifi"
            value={usuarioMifi}
            onChange={(event) => setUsuarioMifi(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <TextField
            label="ID del préstamo"
            value={prestamoId}
            onChange={(event) => setPrestamoId(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <TextField
            label="Usuario del viático"
            value={usuarioViatico}
            onChange={(event) => setUsuarioViatico(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <Button
            variant="outlined"
            disabled={enviando || !transmisionId || !hasPermission('emisora:prestamo:create')}
            onClick={() => void ejecutar(solicitarMifi, 'Préstamo de mifi solicitado.')}
          >
            Solicitar mifi
          </Button>
          <Button
            variant="contained"
            disabled={enviando || !prestamoId || !hasPermission('emisora:prestamo:update')}
            onClick={() => void ejecutar(autorizarMifi, 'Préstamo de mifi autorizado.')}
          >
            Autorizar mifi
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !transmisionId || !hasPermission('emisora:viatico:create')}
            onClick={() => void ejecutar(solicitarViatico, 'Viático solicitado.')}
          >
            Solicitar viático
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Resolución de incentivos"
        subtitle="RF-03.7 — calificación, resolución y PDF generado con la plantilla de Exportaciones"
        sx={{ mt: 3 }}
      >
        {hasPermission('emisora:incentivo:read') && (
          <DataTable
            columns={columnasIncentivos}
            rows={incentivos}
            rowKey={(fila) => fila.id}
            ariaLabel="Incentivos de la emisora"
            emptyMessage="Todavía no hay incentivos registrados."
          />
        )}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mt: 2 }}>
          <TextField
            label="ID del incentivo"
            value={incentivoId}
            onChange={(event) => setIncentivoId(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <TextField
            label="Estado destino"
            value={estadoIncentivo}
            onChange={(event) => setEstadoIncentivo(event.target.value)}
            sx={{ flex: '1 1 180px' }}
          />
          <TextField
            label="Calificación (0-100)"
            type="number"
            value={calificacion}
            onChange={(event) => setCalificacion(event.target.value)}
            slotProps={{ htmlInput: { min: 0, max: 100 } }}
            sx={{ flex: '1 1 170px' }}
          />
          <TextField
            label="Referencia CDP"
            value={referenciaCdp}
            onChange={(event) => setReferenciaCdp(event.target.value)}
            sx={{ flex: '1 1 200px' }}
          />
          <Button
            variant="outlined"
            disabled={enviando || !incentivoId || !hasPermission('emisora:incentivo:update')}
            onClick={() => void ejecutar(calificarIncentivo, 'Incentivo actualizado.')}
          >
            Calificar incentivo
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mt: 2 }}>
          <TextField
            label="Periodo (YYYY o YYYY-MM)"
            value={periodo}
            onChange={(event) => setPeriodo(event.target.value)}
            sx={{ flex: '1 1 220px' }}
          />
          <Button
            variant="contained"
            disabled={enviando || !incentivoId || !hasPermission('emisora:resolucion:create')}
            onClick={() => void ejecutar(generarResolucion, 'Resolución PDF generada.')}
          >
            Generar resolución
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !resolucion || !hasPermission('emisora:resolucion:read')}
            onClick={() => void ejecutar(consultarResolucionPdf, 'Resolución consultada.')}
          >
            Consultar PDF
          </Button>
        </Box>
        {resolucionUrl ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => void ejecutar(descargarResolucion, 'Descarga iniciada.')}
            >
              Descargar resolución generada
            </Button>
          </Alert>
        ) : (
          <EmptyState
            title="Sin resolución en esta sesión"
            description="Selecciona un incentivo resuelto para generar su oficio PDF."
            minHeight={120}
          />
        )}
      </SectionCard>

      <Typography variant="body2" sx={{ mt: 3 }}>
        <RouterLink to="/emisora">Volver a la visión general de la emisora</RouterLink>
      </Typography>
    </Box>
  );
}
