import { useState } from 'react';
import { Alert, Box, Button, LinearProgress, TextField, Typography } from '@mui/material';

import { apiClient } from '../../../api/client';
import type {
  EmisoraArchivoTipo,
  EmisoraEntidadReporte,
  EmisoraTramiteDestino,
} from '../../../api/client';
import { getErrorMessage } from '../../../api/errors';
import { useAuth } from '../../../contexts/AuthContext';
import ErrorState from '../../../components/common/ErrorState';
import PageHeader from '../../../components/common/PageHeader';
import SectionCard from '../../../components/common/SectionCard';

/** Datos reservados para el recorrido determinista de la emisora. */
const TRANSMISOR_ID = 'dddddddd-0000-4000-8000-000000000001';
const JEFE_ID = '55555555-5555-4555-8555-555555555555';
const FECHA = '2026-01-19';
const ARCHIVO_PDF = 'cccccccc-0000-4000-8000-00000000000b';
const ARCHIVO_AUDIO = 'cccccccc-0000-4000-8000-00000000000c';
const SERIE_EQUIPO = 'E2E-EQUIPO-001';

function guardar(mensaje: string): never {
  throw new Error(mensaje);
}

function clave(): string {
  return crypto.randomUUID();
}

type CampoProps = {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  tipo?: 'text' | 'date' | 'number' | 'time';
  ancho?: string;
  minimo?: number;
};

function Campo({
  etiqueta,
  valor,
  alCambiar,
  tipo = 'text',
  ancho = '200px',
  minimo = 0,
}: CampoProps) {
  return (
    <TextField
      label={etiqueta}
      type={tipo}
      value={valor}
      onChange={(evento) => alCambiar(evento.target.value)}
      {...(tipo === 'date' ? { slotProps: { inputLabel: { shrink: true } } } : {})}
      {...(tipo === 'number' ? { slotProps: { htmlInput: { min: minimo } } } : {})}
      sx={{ flex: `1 1 ${ancho}` }}
    />
  );
}

/**
 * Operación E4 (RF-07…RF-12): sede, derechos, tecnología, oferta cultural,
 * emisión y trámites. La API sigue siendo la autoridad: los botones solo
 * comprueban el permiso local para ofrecer una interfaz coherente con el RBAC.
 */
export default function EmisoraOperacionE4() {
  const { hasPermission } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [transmisorId, setTransmisorId] = useState(TRANSMISOR_ID);
  const [operadorId, setOperadorId] = useState(JEFE_ID);
  const [fecha, setFecha] = useState(FECHA);
  const [horaInicio, setHoraInicio] = useState('06:00');
  const [horaFin, setHoraFin] = useState('07:00');
  const [turnoId, setTurnoId] = useState('');

  const [tituloObra, setTituloObra] = useState('Obra E4 de prueba');
  const [autorObra, setAutorObra] = useState('Compositor E4');
  const [duracionObra, setDuracionObra] = useState('210');
  const [obraId, setObraId] = useState('');
  const [reporteId, setReporteId] = useState('');

  const [nombreEquipo, setNombreEquipo] = useState('Transmisor E4');
  const [tipoEquipo, setTipoEquipo] = useState('transmisor');
  const [serieEquipo, setSerieEquipo] = useState(SERIE_EQUIPO);
  const [equipoId, setEquipoId] = useState('');
  const [actualizacionId, setActualizacionId] = useState('');
  const [anio, setAnio] = useState('2026');
  const [proyeccionId, setProyeccionId] = useState('');
  const [inversionId, setInversionId] = useState('');

  const [nombreActividad, setNombreActividad] = useState('Festival E4');
  const [actividadId, setActividadId] = useState('');

  const [archivoAudioId, setArchivoAudioId] = useState(ARCHIVO_AUDIO);
  const [duracionAudio, setDuracionAudio] = useState('210');
  const [programa, setPrograma] = useState('Programa matutino E4');

  const [destino, setDestino] = useState<EmisoraTramiteDestino>('gobierno');
  const [asunto, setAsunto] = useState('Solicitud E4');
  const [radicadoRef, setRadicadoRef] = useState('RAD-E2E-2026-001');
  const [tramiteId, setTramiteId] = useState('');

  async function ejecutar(accion: () => Promise<void>, exito: string | null): Promise<void> {
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      await accion();
      if (exito) setMensaje(exito);
    } catch (err) {
      setError(getErrorMessage(err) || 'La operación no pudo completarse.');
    } finally {
      setEnviando(false);
    }
  }

  /* ------------------------------- RF-07 ------------------------------- */

  async function asignarTurno(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/turnos', {
      body: {
        transmisorId: transmisorId.trim(),
        operadorId: operadorId.trim(),
        fecha,
        horaInicio,
        horaFin,
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo asignar el turno.');
    }
    setTurnoId(data.id);
  }

  async function confirmarTurno(): Promise<void> {
    if (!turnoId.trim()) guardar('Primero asigna un turno.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/turnos/{id}/transitions',
      {
        params: { path: { id: turnoId.trim() } },
        body: { to: 'confirmado' },
      },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo confirmar el turno.');
    }
  }

  async function registrarLectura(): Promise<void> {
    const { error: apiError, response } = await apiClient.POST('/emisora/lecturas', {
      body: {
        transmisorId: transmisorId.trim(),
        fecha,
        potenciaW: 1000,
        frecuencia: '107.9',
        observaciones: 'Lectura E4',
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar la lectura.');
    }
  }

  async function listarLecturas(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.GET('/emisora/lecturas', {
      params: { query: { transmisorId: transmisorId.trim() } },
    });
    if (apiError || response?.status !== 200 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudieron consultar las lecturas.');
    }
    setMensaje(`${data.length} lectura(s) consultada(s).`);
  }

  async function registrarBitacora(): Promise<void> {
    const { error: apiError, response } = await apiClient.POST('/emisora/bitacoras', {
      body: {
        transmisorId: transmisorId.trim(),
        ...(turnoId.trim() ? { turnoId: turnoId.trim() } : {}),
        fecha,
        incidente: 'Incidente E4 de prueba',
        accion: 'Verificación registrada',
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar la bitácora.');
    }
  }

  /* ------------------------------- RF-08 ------------------------------- */

  async function incluirObra(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/obras', {
      body: {
        titulo: tituloObra.trim(),
        compositorAutor: autorObra.trim(),
        duracionSegundos: Number(duracionObra),
        fechaInclusion: fecha,
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo incluir la obra.');
    }
    setObraId(data.id);
  }

  async function generarReporteObras(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/reportes-obras', {
      body: {
        entidad: 'sayco' satisfies EmisoraEntidadReporte,
        periodo: '2026-01',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-01-31',
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo generar el reporte de obras.');
    }
    setReporteId(data.id);
  }

  async function registrarPago(): Promise<void> {
    if (!obraId.trim()) guardar('Primero incluye una obra.');
    const { error: apiError, response } = await apiClient.POST('/emisora/pagos-derechos', {
      body: {
        obraId: obraId.trim(),
        ...(reporteId.trim() ? { reporteId: reporteId.trim() } : {}),
        soporteArchivoId: ARCHIVO_PDF,
        referencia: 'PAGO-E2E-2026-01',
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar el pago.');
    }
  }

  /* ------------------------------- RF-09 ------------------------------- */

  async function registrarEquipo(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/equipos', {
      body: {
        nombre: nombreEquipo.trim(),
        tipo: tipoEquipo.trim(),
        numeroSerie: serieEquipo.trim(),
        fechaAdquisicion: fecha,
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar el equipo.');
    }
    setEquipoId(data.id);
  }

  async function actualizarEquipo(): Promise<void> {
    if (!equipoId.trim()) guardar('Primero registra un equipo.');
    const { error: apiError, response } = await apiClient.PATCH('/emisora/equipos/{id}/estado', {
      params: { path: { id: equipoId.trim() } },
      body: { estado: 'en_uso' },
    });
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo actualizar el equipo.');
    }
  }

  async function solicitarActualizacion(): Promise<void> {
    if (!equipoId.trim()) guardar('Primero registra un equipo.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/actualizaciones-tecnologicas', {
      body: {
        equipoId: equipoId.trim(),
        descripcion: 'Actualización E4',
        solicitadaPor: operadorId.trim(),
        fecha,
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo solicitar la actualización.');
    }
    setActualizacionId(data.id);
  }

  async function aprobarActualizacion(): Promise<void> {
    if (!actualizacionId.trim()) guardar('Primero solicita una actualización.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/actualizaciones-tecnologicas/{id}/transitions',
      { params: { path: { id: actualizacionId.trim() } }, body: { to: 'aprobada' } },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo aprobar la actualización.');
    }
  }

  async function registrarProyeccion(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/proyecciones', {
      body: { anio: Number(anio), descripcion: 'Proyección E4' },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar la proyección.');
    }
    setProyeccionId(data.id);
  }

  async function aprobarProyeccion(): Promise<void> {
    if (!proyeccionId.trim()) guardar('Primero registra una proyección.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/proyecciones/{id}/transitions',
      { params: { path: { id: proyeccionId.trim() } }, body: { to: 'aprobada' } },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo aprobar la proyección.');
    }
  }

  async function registrarInversion(): Promise<void> {
    if (!proyeccionId.trim()) guardar('Primero registra una proyección.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/inversiones', {
      body: {
        proyeccionId: proyeccionId.trim(),
        contratoRef: 'CONTRATO-E4',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar la inversión.');
    }
    setInversionId(data.id);
  }

  async function aprobarInversion(): Promise<void> {
    if (!inversionId.trim()) guardar('Primero registra una inversión.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/inversiones/{id}/transitions',
      {
        params: { path: { id: inversionId.trim() } },
        body: { to: 'aprobada', contratoRef: 'CONTRATO-E4' },
      },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo aprobar la inversión.');
    }
  }

  async function registrarSoftware(): Promise<void> {
    if (!equipoId.trim()) guardar('Primero registra un equipo.');
    const { error: apiError, response } = await apiClient.POST('/emisora/versiones-software', {
      body: {
        equipoId: equipoId.trim(),
        nombre: 'Firmware E4',
        version: '1.0.0',
        fechaInstalacion: fecha,
        responsableId: operadorId.trim(),
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar la versión de software.');
    }
  }

  async function asignarEquipo(): Promise<void> {
    if (!equipoId.trim()) guardar('Primero registra un equipo.');
    const { error: apiError, response } = await apiClient.POST('/emisora/asignaciones-equipo', {
      body: {
        equipoId: equipoId.trim(),
        transmisorId: transmisorId.trim(),
        usuarioId: operadorId.trim(),
        fechaAsignacion: fecha,
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo asignar el equipo.');
    }
  }

  /* -------------------------- RF-10 y RF-11 ---------------------------- */

  async function registrarActividad(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/actividades', {
      body: {
        nombre: nombreActividad.trim(),
        fecha,
        lugar: 'Plaza cultural',
        responsableId: operadorId.trim(),
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar la actividad.');
    }
    setActividadId(data.id);
  }

  async function listarActividades(): Promise<void> {
    const { data, error: apiError, response } = await apiClient.GET('/emisora/actividades');
    if (apiError || response?.status !== 200 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudieron consultar las actividades.');
    }
    setMensaje(`${data.length} actividad(es) consultada(s).`);
  }

  async function emitirPermiso(): Promise<void> {
    if (!actividadId.trim()) guardar('Primero registra una actividad.');
    const { error: apiError, response } = await apiClient.POST('/emisora/permisos-salida', {
      body: {
        actividadId: actividadId.trim(),
        destino: 'Alcaldía municipal',
        referencia: 'OFICIO-E4-001',
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo emitir el permiso de salida.');
    }
  }

  async function archivarAudio(): Promise<void> {
    const { error: apiError, response } = await apiClient.POST('/emisora/archivos-emisora', {
      body: {
        archivoId: archivoAudioId.trim(),
        tipo: 'audio' satisfies EmisoraArchivoTipo,
        duracionSegundos: Number(duracionAudio),
        fecha,
        responsableId: operadorId.trim(),
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo archivar el audio.');
    }
  }

  async function generarPlanilla(): Promise<void> {
    const { error: apiError, response } = await apiClient.POST('/emisora/planillas-emision', {
      body: { fecha, programa: programa.trim(), operadorId: operadorId.trim() },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo generar la planilla.');
    }
  }

  /* ------------------------------- RF-12 ------------------------------- */

  async function radicarTramite(): Promise<void> {
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/tramites', {
      body: {
        destino,
        asunto: asunto.trim(),
        fechaRadicacion: fecha,
        responsableId: operadorId.trim(),
      },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo radicar el trámite.');
    }
    setTramiteId(data.id);
  }

  async function listarTramites(): Promise<void> {
    const { data, error: apiError, response } = await apiClient.GET('/emisora/tramites');
    if (apiError || response?.status !== 200 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudieron consultar los trámites.');
    }
    setMensaje(`${data.length} trámite(s) consultado(s).`);
  }

  async function adjuntarSoporte(): Promise<void> {
    if (!tramiteId.trim()) guardar('Primero radica un trámite.');
    const { error: apiError, response } = await apiClient.POST('/emisora/tramites/{id}/soportes', {
      params: { path: { id: tramiteId.trim() } },
      body: { archivoId: ARCHIVO_PDF, tipo: 'pdf', descripcion: 'Soporte E4' },
      headers: { 'Idempotency-Key': clave() },
    });
    if (apiError || response?.status !== 201) {
      guardar(getErrorMessage(apiError) || 'No se pudo adjuntar el soporte.');
    }
  }

  async function ponerEnTramite(): Promise<void> {
    if (!tramiteId.trim()) guardar('Primero radica un trámite.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/tramites/{id}/transitions',
      { params: { path: { id: tramiteId.trim() } }, body: { to: 'en_tramite', radicadoRef } },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo avanzar el trámite.');
    }
  }

  async function registrarRespuesta(): Promise<void> {
    if (!tramiteId.trim()) guardar('Primero radica un trámite.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/tramites/{id}/transitions',
      { params: { path: { id: tramiteId.trim() } }, body: { to: 'respondido' } },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar la respuesta.');
    }
  }

  async function archivarTramite(): Promise<void> {
    if (!tramiteId.trim()) guardar('Primero radica un trámite.');
    const { error: apiError, response } = await apiClient.PATCH(
      '/emisora/tramites/{id}/transitions',
      { params: { path: { id: tramiteId.trim() } }, body: { to: 'archivado' } },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo archivar el trámite.');
    }
  }

  return (
    <Box>
      <PageHeader
        title="Operación E4 de la emisora"
        description="Sede de transmisores, derechos, tecnología, oferta cultural, emisión y trámites (RF-07 a RF-12)."
        breadcrumbs={[
          { label: 'Inicio', to: '/' },
          { label: 'Emisora R.A.C.', to: '/emisora' },
          { label: 'Operación E4' },
        ]}
      />

      {error && <ErrorState message={error} sx={{ mb: 3 }} />}
      {mensaje && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {mensaje}
        </Alert>
      )}
      {enviando && <LinearProgress sx={{ mb: 2 }} aria-label="Procesando operación E4" />}

      <SectionCard title="Sede de transmisores" subtitle="RF-07 — turno, lectura única y bitácora">
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Campo
            etiqueta="ID del transmisor"
            valor={transmisorId}
            alCambiar={setTransmisorId}
            ancho="280px"
          />
          <Campo
            etiqueta="ID del operador"
            valor={operadorId}
            alCambiar={setOperadorId}
            ancho="280px"
          />
          <Campo etiqueta="Fecha de operación" tipo="date" valor={fecha} alCambiar={setFecha} />
          <Campo
            etiqueta="Hora de inicio"
            tipo="time"
            valor={horaInicio}
            alCambiar={setHoraInicio}
          />
          <Campo etiqueta="Hora de fin" tipo="time" valor={horaFin} alCambiar={setHoraFin} />
          <Button
            variant="contained"
            disabled={enviando || !hasPermission('emisora:turno:create')}
            onClick={() => void ejecutar(asignarTurno, 'Turno asignado.')}
          >
            Asignar turno
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !turnoId || !hasPermission('emisora:turno:update')}
            onClick={() => void ejecutar(confirmarTurno, 'Turno confirmado.')}
          >
            Confirmar turno
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:lectura:create')}
            onClick={() => void ejecutar(registrarLectura, 'Lectura registrada.')}
          >
            Registrar lectura
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:lectura:read')}
            onClick={() => void ejecutar(listarLecturas, null)}
          >
            Listar lecturas
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:bitacora:create')}
            onClick={() => void ejecutar(registrarBitacora, 'Bitácora registrada.')}
          >
            Registrar bitácora
          </Button>
        </Box>
        {turnoId && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Turno activo: {turnoId}
          </Typography>
        )}
      </SectionCard>

      <SectionCard
        title="Derechos de autor"
        subtitle="RF-08 — catálogo de obras, reporte PDF y soporte de pago"
        sx={{ mt: 3 }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Campo
            etiqueta="Título de la obra"
            valor={tituloObra}
            alCambiar={setTituloObra}
            ancho="240px"
          />
          <Campo
            etiqueta="Compositor o autor"
            valor={autorObra}
            alCambiar={setAutorObra}
            ancho="240px"
          />
          <Campo
            etiqueta="Duración (segundos)"
            tipo="number"
            valor={duracionObra}
            alCambiar={setDuracionObra}
            minimo={1}
          />
          <Button
            variant="contained"
            disabled={enviando || !hasPermission('emisora:obra:create')}
            onClick={() => void ejecutar(incluirObra, 'Obra incluida.')}
          >
            Incluir obra
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:derecho:create')}
            onClick={() => void ejecutar(generarReporteObras, 'Reporte de obras generado.')}
          >
            Generar reporte de obras
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !obraId || !hasPermission('emisora:derecho:create')}
            onClick={() => void ejecutar(registrarPago, 'Pago de derechos registrado.')}
          >
            Registrar pago
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Tecnología e inversión"
        subtitle="RF-09 — hoja de vida, proyección anual y seguimiento de inversión"
        sx={{ mt: 3 }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Campo
            etiqueta="Nombre del equipo"
            valor={nombreEquipo}
            alCambiar={setNombreEquipo}
            ancho="220px"
          />
          <Campo
            etiqueta="Tipo de equipo"
            valor={tipoEquipo}
            alCambiar={setTipoEquipo}
            ancho="180px"
          />
          <Campo
            etiqueta="Número de serie"
            valor={serieEquipo}
            alCambiar={setSerieEquipo}
            ancho="200px"
          />
          <Campo
            etiqueta="Año de proyección"
            tipo="number"
            valor={anio}
            alCambiar={setAnio}
            minimo={2000}
          />
          <Button
            variant="contained"
            disabled={enviando || !hasPermission('emisora:equipo:create')}
            onClick={() => void ejecutar(registrarEquipo, 'Equipo registrado.')}
          >
            Registrar equipo
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !equipoId || !hasPermission('emisora:equipo:update')}
            onClick={() => void ejecutar(actualizarEquipo, 'Equipo actualizado.')}
          >
            Actualizar equipo
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !equipoId || !hasPermission('emisora:equipo:create')}
            onClick={() => void ejecutar(solicitarActualizacion, 'Actualización solicitada.')}
          >
            Solicitar actualización
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !actualizacionId || !hasPermission('emisora:equipo:update')}
            onClick={() => void ejecutar(aprobarActualizacion, 'Actualización aprobada.')}
          >
            Aprobar actualización
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:proyeccion:create')}
            onClick={() => void ejecutar(registrarProyeccion, 'Proyección registrada.')}
          >
            Registrar proyección
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !proyeccionId || !hasPermission('emisora:proyeccion:update')}
            onClick={() => void ejecutar(aprobarProyeccion, 'Proyección aprobada.')}
          >
            Aprobar proyección
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !proyeccionId || !hasPermission('emisora:inversion:create')}
            onClick={() => void ejecutar(registrarInversion, 'Inversión registrada.')}
          >
            Registrar inversión
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !inversionId || !hasPermission('emisora:inversion:update')}
            onClick={() => void ejecutar(aprobarInversion, 'Inversión aprobada.')}
          >
            Aprobar inversión
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !equipoId || !hasPermission('emisora:equipo:create')}
            onClick={() => void ejecutar(registrarSoftware, 'Versión de software registrada.')}
          >
            Registrar software
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !equipoId || !hasPermission('emisora:equipo:create')}
            onClick={() => void ejecutar(asignarEquipo, 'Equipo asignado.')}
          >
            Asignar equipo
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Oferta cultural y permisos"
        subtitle="RF-10 — agenda cultural y oficio de salida"
        sx={{ mt: 3 }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Campo
            etiqueta="Nombre de la actividad"
            valor={nombreActividad}
            alCambiar={setNombreActividad}
            ancho="240px"
          />
          <Button
            variant="contained"
            disabled={enviando || !hasPermission('emisora:actividad:create')}
            onClick={() => void ejecutar(registrarActividad, 'Actividad registrada.')}
          >
            Registrar actividad
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:actividad:read')}
            onClick={() => void ejecutar(listarActividades, null)}
          >
            Listar actividades
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !actividadId || !hasPermission('emisora:permiso-salida:create')}
            onClick={() => void ejecutar(emitirPermiso, 'Permiso de salida emitido.')}
          >
            Emitir permiso
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Emisión y archivo"
        subtitle="RF-11 — archivo sonoro limpio y planilla única por fecha"
        sx={{ mt: 3 }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Campo
            etiqueta="ID del audio limpio"
            valor={archivoAudioId}
            alCambiar={setArchivoAudioId}
            ancho="280px"
          />
          <Campo
            etiqueta="Duración del audio"
            tipo="number"
            valor={duracionAudio}
            alCambiar={setDuracionAudio}
            minimo={1}
          />
          <Campo
            etiqueta="Programa de la planilla"
            valor={programa}
            alCambiar={setPrograma}
            ancho="240px"
          />
          <Button
            variant="contained"
            disabled={enviando || !hasPermission('emisora:archivo-emisora:create')}
            onClick={() => void ejecutar(archivarAudio, 'Audio archivado.')}
          >
            Archivar audio
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:planilla:create')}
            onClick={() => void ejecutar(generarPlanilla, 'Planilla generada.')}
          >
            Generar planilla
          </Button>
        </Box>
      </SectionCard>

      <SectionCard
        title="Trámites externos"
        subtitle="RF-12 — radicación, soporte PDF y ciclo de estado"
        sx={{ mt: 3 }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            label="Destino del trámite"
            select
            value={destino}
            onChange={(evento) => setDestino(evento.target.value as EmisoraTramiteDestino)}
            sx={{ flex: '1 1 200px' }}
          >
            <option value="gobierno">Gobierno</option>
            <option value="hacienda">Hacienda</option>
            <option value="saia">SAIA</option>
            <option value="secretaria_tic">Secretaría TIC</option>
            <option value="otro">Otro</option>
          </TextField>
          <Campo etiqueta="Asunto" valor={asunto} alCambiar={setAsunto} ancho="220px" />
          <Campo
            etiqueta="Número de radicado"
            valor={radicadoRef}
            alCambiar={setRadicadoRef}
            ancho="220px"
          />
          <Button
            variant="contained"
            disabled={enviando || !hasPermission('emisora:tramite:create')}
            onClick={() => void ejecutar(radicarTramite, 'Trámite radicado.')}
          >
            Radicar trámite
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !hasPermission('emisora:tramite:read')}
            onClick={() => void ejecutar(listarTramites, null)}
          >
            Listar trámites
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !tramiteId || !hasPermission('emisora:tramite:create')}
            onClick={() => void ejecutar(adjuntarSoporte, 'Soporte adjuntado.')}
          >
            Adjuntar soporte
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !tramiteId || !hasPermission('emisora:tramite:update')}
            onClick={() => void ejecutar(ponerEnTramite, 'Trámite en trámite.')}
          >
            Poner en trámite
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !tramiteId || !hasPermission('emisora:tramite:update')}
            onClick={() => void ejecutar(registrarRespuesta, 'Respuesta registrada.')}
          >
            Registrar respuesta
          </Button>
          <Button
            variant="outlined"
            disabled={enviando || !tramiteId || !hasPermission('emisora:tramite:update')}
            onClick={() => void ejecutar(archivarTramite, 'Trámite archivado.')}
          >
            Archivar trámite
          </Button>
        </Box>
      </SectionCard>
    </Box>
  );
}
