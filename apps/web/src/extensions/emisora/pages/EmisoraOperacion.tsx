import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, LinearProgress, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { apiClient } from '../../../api/client';
import type {
  EmisoraAudioView,
  EmisoraConvocatoriaView,
  EmisoraGrabacionView,
  EmisoraProgramacionView,
  EmisoraRejillaView,
} from '../../../api/client';
import { getErrorMessage } from '../../../api/errors';
import { useAuth } from '../../../contexts/AuthContext';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DataTable, { type DataTableColumn } from '../../../components/common/DataTable';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import LoadingState from '../../../components/common/LoadingState';
import PageHeader from '../../../components/common/PageHeader';
import SectionCard from '../../../components/common/SectionCard';
import StatusChip from '../../../components/common/StatusChip';

// Valores iniciales del recorrido E2; al cargar, el año y la fecha se derivan
// de la rejilla, la programación y las grabaciones existentes.
const ANIO = 2026;
const FECHA = '2026-01-19';
const HORA_INICIO = '06:00';
const HORA_FIN = '07:00';
const FECHA_COMITE = '2026-02-10';
const DURACION_SEGUNDOS = '60';
const TIPO_AUDIO = 'programa';

function guardar(mensaje: string): never {
  throw new Error(mensaje);
}

/** Operación E2: convocatoria → rejilla → programación → grabación → audio. */
export default function EmisoraOperacion() {
  const { hasPermission, user } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [convocatorias, setConvocatorias] = useState<EmisoraConvocatoriaView[]>([]);
  const [rejilla, setRejilla] = useState<EmisoraRejillaView | null>(null);
  const [programacion, setProgramacion] = useState<EmisoraProgramacionView | null>(null);
  const [grabaciones, setGrabaciones] = useState<EmisoraGrabacionView[]>([]);
  const [audios, setAudios] = useState<EmisoraAudioView[]>([]);
  const [actaArchivoId, setActaArchivoId] = useState('');
  const [fechaComite, setFechaComite] = useState(FECHA_COMITE);
  const [duracionSegundos, setDuracionSegundos] = useState(DURACION_SEGUNDOS);
  const [tipoAudio, setTipoAudio] = useState(TIPO_AUDIO);
  const [audio, setAudio] = useState<File | null>(null);
  const [confirmarRejilla, setConfirmarRejilla] = useState(false);
  const [anioConvocatoria, setAnioConvocatoria] = useState(String(ANIO));
  const [idActaBases, setIdActaBases] = useState('');
  const [estadoGrabacion, setEstadoGrabacion] = useState('realizada');

  const anio = rejilla?.anio ?? convocatorias[0]?.anio ?? ANIO;
  const fecha = programacion?.fecha ?? grabaciones[0]?.fecha ?? FECHA;

  const cargar = useCallback(async () => {
    try {
      const [convocatoriasRes, rejillaRes, programacionRes, grabacionesRes, audiosRes] =
        await Promise.all([
          apiClient.GET('/emisora/convocatorias'),
          apiClient.GET('/emisora/rejilla-anual', { params: { query: { anio: ANIO } } }),
          apiClient.GET('/emisora/programacion-diaria', { params: { query: { fecha: FECHA } } }),
          apiClient.GET('/emisora/grabaciones'),
          apiClient.GET('/emisora/audios', { params: { query: {} } }),
        ]);
      const errorCarga =
        convocatoriasRes.error ??
        rejillaRes.error ??
        programacionRes.error ??
        grabacionesRes.error ??
        audiosRes.error;
      if (errorCarga) {
        guardar(getErrorMessage(errorCarga));
      }
      setConvocatorias(convocatoriasRes.data ?? []);
      setRejilla(rejillaRes.data ?? null);
      setProgramacion(programacionRes.data ?? null);
      setGrabaciones(grabacionesRes.data ?? []);
      setAudios(audiosRes.data ?? []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo cargar la operación de la emisora.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function ejecutar(accion: () => Promise<void>, exito: string): Promise<void> {
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      await accion();
      setMensaje(exito);
      await cargar();
    } catch (err) {
      setError(getErrorMessage(err) || 'La operación no pudo completarse.');
    } finally {
      setEnviando(false);
    }
  }

  async function abrirConvocatoria(): Promise<void> {
    const anioNumero = Number(anioConvocatoria);
    if (!Number.isInteger(anioNumero) || anioNumero < 1000 || anioNumero > 9999) {
      guardar('Indica un año de convocatoria válido (4 dígitos).');
    }
    if (!idActaBases.trim()) guardar('Indica el ID del PDF de bases ya cargado en Archivos.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/convocatorias', {
      body: {
        anio: anioNumero,
        fechaApertura: `${anioNumero}-01-15`,
        basesArchivoId: idActaBases.trim(),
      },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo abrir la convocatoria.');
    }
  }

  async function transicionarGrabacion(): Promise<void> {
    const grabacion = grabaciones[0];
    if (!grabacion) guardar('No hay grabación para cambiar de estado.');
    if (!estadoGrabacion.trim()) guardar('Indica el estado destino de la grabación.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/grabaciones/{id}/transitions', {
      params: { path: { id: grabacion.id } },
      body: {
        to: estadoGrabacion.trim() as 'programada' | 'realizada' | 'aprobada' | 'cancelada',
      },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    if (apiError || response?.status !== 200 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo cambiar el estado de la grabación.');
    }
  }

  async function registrarComite(): Promise<void> {
    const convocatoria = convocatorias.find((entrada) => entrada.anio === anio);
    if (!convocatoria) guardar('No hay convocatoria disponible para registrar el comité.');
    if (!actaArchivoId.trim()) guardar('Indica el identificador del acta PDF ya cargada.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/comites', {
      body: {
        convocatoriaId: convocatoria.id,
        fecha: fechaComite,
        actaArchivoId: actaArchivoId.trim(),
        integrantes: [user?.id ?? ''],
      },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar el comité.');
    }
  }

  async function aprobarRejilla(): Promise<void> {
    if (!rejilla) guardar('No hay rejilla anual para aprobar.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.PATCH('/emisora/rejilla-anual/{id}/transitions', {
      params: { path: { id: rejilla.id } },
      body: { to: 'aprobada' },
    });
    if (apiError || response?.status !== 200 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo aprobar la rejilla.');
    }
  }

  async function crearProgramacion(): Promise<void> {
    if (!rejilla) guardar('No hay rejilla anual para programar.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/programacion-diaria', {
      body: {
        rejillaAnualId: rejilla.id,
        fecha,
        items: [
          {
            fecha,
            horaInicio: HORA_INICIO,
            horaFin: HORA_FIN,
            tipo: 'programa',
            titulo: 'Voces de la semana',
          },
        ],
      },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo crear la programación.');
    }
  }

  async function aprobarProgramacion(): Promise<void> {
    if (!programacion) guardar('No hay programación para aprobar.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/programacion-diaria/{id}/transitions', {
      params: { path: { id: programacion.id } },
      body: { to: 'aprobada' },
    });
    if (apiError || response?.status !== 200 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo aprobar la programación.');
    }
  }

  async function crearGrabacion(): Promise<void> {
    const item = programacion?.items[0];
    if (!item) guardar('La programación no tiene franjas para grabar.');
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/grabaciones', {
      body: { programacionItemId: item.id, fecha },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo agendar la grabación.');
    }
  }

  async function registrarAsistencia(): Promise<void> {
    const grabacion = grabaciones[0];
    if (!grabacion) guardar('No hay grabación para registrar asistencia.');
    const { error: apiError, response } = await apiClient.PUT(
      '/emisora/grabaciones/{id}/asistencia-cabina',
      {
        params: { path: { id: grabacion.id } },
        body: { entries: [{ usuarioId: user?.id ?? '', estado: 'presente' }] },
      },
    );
    if (apiError || response?.status !== 200) {
      guardar(getErrorMessage(apiError) || 'No se pudo registrar la asistencia.');
    }
  }

  async function subirAudio(): Promise<void> {
    const grabacion = grabaciones[0];
    if (!grabacion) guardar('No hay grabación para archivar el audio.');
    if (!audio) guardar('Selecciona un archivo de audio.');
    const cuerpo = new FormData();
    cuerpo.set('sesionGrabacionId', grabacion.id);
    cuerpo.set('tipo', tipoAudio);
    cuerpo.set('duracionSegundos', duracionSegundos);
    cuerpo.set('fecha', fecha);
    cuerpo.set('file', audio);
    const {
      data,
      error: apiError,
      response,
    } = await apiClient.POST('/emisora/audios', {
      body: cuerpo,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    if (apiError || response?.status !== 201 || !data) {
      guardar(getErrorMessage(apiError) || 'No se pudo archivar el audio.');
    }
  }

  const columnasConvocatorias: DataTableColumn<EmisoraConvocatoriaView>[] = [
    { id: 'anio', label: 'Año', render: (fila) => fila.anio },
    { id: 'apertura', label: 'Apertura', render: (fila) => fila.fechaApertura },
    { id: 'cierre', label: 'Cierre', render: (fila) => fila.fechaCierre },
    { id: 'estado', label: 'Estado', render: (fila) => <StatusChip status={fila.estado} /> },
  ];
  const columnasRejilla: DataTableColumn<EmisoraRejillaView>[] = [
    { id: 'anio', label: 'Año', render: (fila) => fila.anio },
    { id: 'estado', label: 'Estado', render: (fila) => <StatusChip status={fila.estado} /> },
    { id: 'franjas', label: 'Franjas', render: (fila) => fila.items.length },
    {
      id: 'aprobada',
      label: 'Aprobada',
      render: (fila) => (fila.aprobadaEn ? fila.aprobadaEn.slice(0, 10) : '—'),
    },
  ];
  const columnasProgramacion: DataTableColumn<EmisoraProgramacionView>[] = [
    { id: 'fecha', label: 'Fecha', render: (fila) => fila.fecha },
    { id: 'estado', label: 'Estado', render: (fila) => <StatusChip status={fila.estado} /> },
    {
      id: 'concuerda',
      label: 'Concuerda',
      render: (fila) =>
        fila.concuerda === null ? '—' : fila.concuerda ? 'Sí' : `No (${fila.desviaciones.length})`,
    },
    { id: 'franjas', label: 'Franjas', render: (fila) => fila.items.length },
  ];
  const columnasGrabaciones: DataTableColumn<EmisoraGrabacionView>[] = [
    { id: 'fecha', label: 'Fecha', render: (fila) => fila.fecha },
    { id: 'estado', label: 'Estado', render: (fila) => <StatusChip status={fila.estado} /> },
    {
      id: 'franja',
      label: 'Franja',
      render: (fila) => fila.programacionItemId?.slice(0, 8) ?? 'Sin franja',
    },
  ];
  const columnasAudios: DataTableColumn<EmisoraAudioView>[] = [
    { id: 'tipo', label: 'Tipo', render: (fila) => fila.tipo },
    { id: 'duracion', label: 'Segundos', render: (fila) => fila.duracionSegundos },
    { id: 'archivo', label: 'Archivo', render: (fila) => fila.archivo.nombreOriginal },
    {
      id: 'escaneo',
      label: 'Escaneo',
      render: (fila) => <StatusChip status={fila.archivo.estadoEscaneo} />,
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Operación E2 de la emisora"
        description="Recorrido de extremo a extremo: convocatoria, rejilla, programación diaria, grabación y archivo de audio."
        breadcrumbs={[
          { label: 'Inicio', to: '/' },
          { label: 'Emisora R.A.C.', to: '/emisora' },
          { label: 'Operación E2' },
        ]}
      />

      {cargando ? (
        <LoadingState label="Cargando la operación de la emisora…" />
      ) : (
        <>
          {error && <ErrorState message={error} onRetry={() => void cargar()} sx={{ mb: 3 }} />}
          {mensaje && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {mensaje}
            </Alert>
          )}
          {enviando && <LinearProgress sx={{ mb: 2 }} aria-label="Procesando operación" />}

          <SectionCard
            title="Convocatoria anual"
            subtitle="RF-03.1 — apertura en enero y cierre a 21 días"
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
              <TextField
                label="Año de la convocatoria"
                type="number"
                value={anioConvocatoria}
                onChange={(event) => setAnioConvocatoria(event.target.value)}
                slotProps={{ htmlInput: { min: 1000, max: 9999 } }}
                sx={{ flex: '1 1 180px' }}
              />
              <TextField
                label="ID del PDF de bases"
                value={idActaBases}
                onChange={(event) => setIdActaBases(event.target.value)}
                placeholder="UUID del archivo cargado en Archivos"
                sx={{ flex: '1 1 300px' }}
              />
              <Button
                variant="outlined"
                disabled={enviando || !hasPermission('emisora:convocatoria:create')}
                onClick={() =>
                  void ejecutar(abrirConvocatoria, 'Convocatoria anual abierta correctamente.')
                }
              >
                Abrir convocatoria
              </Button>
            </Box>
            {convocatorias.length === 0 ? (
              <EmptyState
                title="Sin convocatorias"
                description="Todavía no hay convocatorias registradas."
              />
            ) : (
              <DataTable
                columns={columnasConvocatorias}
                rows={convocatorias}
                rowKey={(fila) => fila.id}
                ariaLabel="Convocatorias de la emisora"
              />
            )}
          </SectionCard>

          <SectionCard
            title="Rejilla anual y comité"
            subtitle="RF-03.3 — el acta del comité es requisito para aprobar la rejilla"
            sx={{ mt: 3 }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
              <TextField
                label="ID del acta PDF"
                value={actaArchivoId}
                onChange={(event) => setActaArchivoId(event.target.value)}
                placeholder="UUID del archivo cargado en Archivos"
                sx={{ flex: '1 1 320px' }}
              />
              <TextField
                label="Fecha del comité"
                type="date"
                value={fechaComite}
                onChange={(event) => setFechaComite(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: '1 1 200px' }}
              />
              <Button
                variant="outlined"
                disabled={enviando || !hasPermission('emisora:comite:create')}
                onClick={() =>
                  void ejecutar(registrarComite, 'Comité registrado y vinculado a la rejilla.')
                }
              >
                Registrar comité
              </Button>
              <Button
                variant="contained"
                disabled={
                  enviando ||
                  !rejilla ||
                  rejilla.estado !== 'borrador' ||
                  !hasPermission('emisora:rejilla:update')
                }
                onClick={() => setConfirmarRejilla(true)}
              >
                Aprobar rejilla
              </Button>
            </Box>
            {rejilla ? (
              <DataTable
                columns={columnasRejilla}
                rows={[rejilla]}
                rowKey={(fila) => fila.id}
                ariaLabel="Rejilla anual"
              />
            ) : (
              <EmptyState title="Sin rejilla" description={`No hay rejilla para ${anio}.`} />
            )}
          </SectionCard>

          <SectionCard
            title="Programación diaria"
            subtitle="RF-01 — verificación contra la rejilla sin modificarla"
            sx={{ mt: 3 }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Button
                variant="outlined"
                disabled={
                  enviando ||
                  !rejilla ||
                  Boolean(programacion) ||
                  !hasPermission('emisora:programacion:create')
                }
                onClick={() =>
                  void ejecutar(
                    crearProgramacion,
                    'Programación creada y verificada contra la rejilla.',
                  )
                }
              >
                Crear programación
              </Button>
              <Button
                variant="contained"
                disabled={
                  enviando ||
                  !programacion ||
                  programacion.estado !== 'borrador' ||
                  !hasPermission('emisora:programacion:update')
                }
                onClick={() =>
                  void ejecutar(aprobarProgramacion, 'Programación aprobada correctamente.')
                }
              >
                Aprobar programación
              </Button>
            </Box>
            {programacion ? (
              <DataTable
                columns={columnasProgramacion}
                rows={[programacion]}
                rowKey={(fila) => fila.id}
                ariaLabel="Programación diaria"
              />
            ) : (
              <EmptyState
                title="Sin programación"
                description={`No hay programación para ${fecha}.`}
              />
            )}
          </SectionCard>

          <SectionCard
            title="Grabación y audio"
            subtitle="RF-02 — asistencia en cabina y archivo con política opt-in"
            sx={{ mt: 3 }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
              <Button
                variant="outlined"
                disabled={
                  enviando ||
                  !programacion?.items.length ||
                  grabaciones.length > 0 ||
                  !hasPermission('emisora:grabacion:create')
                }
                onClick={() => void ejecutar(crearGrabacion, 'Sesión de grabación agendada.')}
              >
                Agendar grabación
              </Button>
              <Button
                variant="outlined"
                disabled={
                  enviando ||
                  grabaciones.length === 0 ||
                  !hasPermission('emisora:asistencia-cabina:create')
                }
                onClick={() => void ejecutar(registrarAsistencia, 'Asistencia registrada.')}
              >
                Registrar asistencia
              </Button>
              <TextField
                label="Estado destino de grabación"
                value={estadoGrabacion}
                onChange={(event) => setEstadoGrabacion(event.target.value)}
                sx={{ flex: '1 1 180px' }}
              />
              <Button
                variant="outlined"
                disabled={
                  enviando || grabaciones.length === 0 || !hasPermission('emisora:grabacion:update')
                }
                onClick={() =>
                  void ejecutar(
                    transicionarGrabacion,
                    'Estado de la grabación actualizado correctamente.',
                  )
                }
              >
                Cambiar estado
              </Button>
              <TextField
                label="Tipo de audio"
                value={tipoAudio}
                onChange={(event) => setTipoAudio(event.target.value)}
                sx={{ flex: '1 1 160px' }}
              />
              <TextField
                label="Duración (segundos)"
                type="number"
                value={duracionSegundos}
                onChange={(event) => setDuracionSegundos(event.target.value)}
                slotProps={{ htmlInput: { min: 1 } }}
                sx={{ flex: '1 1 160px' }}
              />
              <Box sx={{ flex: '1 1 260px' }}>
                <Typography component="label" htmlFor="audio-emisora" variant="body2">
                  Archivo de audio (MP3, WAV u OGG)
                </Typography>
                <input
                  id="audio-emisora"
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/ogg"
                  aria-label="Archivo de audio"
                  onChange={(event) => setAudio(event.target.files?.[0] ?? null)}
                  style={{ display: 'block', marginTop: 8 }}
                />
              </Box>
              <Button
                variant="contained"
                disabled={
                  enviando ||
                  !audio ||
                  grabaciones.length === 0 ||
                  !hasPermission('emisora:audio:create')
                }
                onClick={() => void ejecutar(subirAudio, 'Audio archivado con metadatos.')}
              >
                Subir audio
              </Button>
            </Box>
            <Typography variant="h3" component="h3" sx={{ mb: 1 }}>
              Sesiones
            </Typography>
            {grabaciones.length === 0 ? (
              <EmptyState title="Sin grabaciones" description="Agenda una sesión para continuar." />
            ) : (
              <DataTable
                columns={columnasGrabaciones}
                rows={grabaciones}
                rowKey={(fila) => fila.id}
                ariaLabel="Sesiones de grabación"
              />
            )}
            <Typography variant="h3" component="h3" sx={{ mt: 3, mb: 1 }}>
              Audios archivados
            </Typography>
            {audios.length === 0 ? (
              <EmptyState
                title="Sin audios"
                description="Todavía no se ha archivado ningún audio."
              />
            ) : (
              <DataTable
                columns={columnasAudios}
                rows={audios}
                rowKey={(fila) => fila.id}
                ariaLabel="Audios archivados"
              />
            )}
          </SectionCard>

          <ConfirmDialog
            open={confirmarRejilla}
            title="Aprobar rejilla anual"
            description="Se verificará que el acta del comité esté adjunta. La rejilla anterior no se versiona: el histórico queda en auditoría."
            confirmLabel="Aprobar rejilla"
            onCancel={() => setConfirmarRejilla(false)}
            onConfirm={() => {
              setConfirmarRejilla(false);
              void ejecutar(aprobarRejilla, 'Rejilla aprobada con acta de comité.');
            }}
          />

          <Typography variant="body2" sx={{ mt: 3 }}>
            <RouterLink to="/emisora">Volver a la visión general de la emisora</RouterLink>
          </Typography>
        </>
      )}
    </Box>
  );
}
