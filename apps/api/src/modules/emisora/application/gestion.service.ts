import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { env } from '../../../shared/config/env.js';
import {
  FILE_DIRECTORY,
  type FileDirectory,
} from '../../../shared/integration/file-directory.port.js';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import { esFechaValida, esHoraValida, aMinutos, fechaBogota } from '../domain/emisora-rules.js';
import { canTransicionarE4 } from '../domain/emisora-states.js';
import type {
  ActualizacionEstado,
  ArchivoEmisoraTipo,
  EntidadReporte,
  EquipoEstado,
  InversionEstado,
  ProyeccionEstado,
  TramiteDestino,
  TramiteEstado,
  TurnoEstado,
} from '../domain/emisora-states.js';
import { EmisoraError } from './emisora-error.js';
import type {
  ActorContext,
  ActividadCulturalView,
  ActualizacionView,
  ArchivoEmisoraView,
  AsignacionEquipoView,
  BitacoraView,
  EquipoView,
  InversionView,
  LecturaView,
  ObraView,
  PagoDerechosView,
  PermisoGobiernoView,
  PlanillaView,
  ProyeccionView,
  ReporteObraView,
  SoporteTramiteView,
  TramiteView,
  TurnoView,
  VersionSoftwareView,
} from './emisora.types.js';
import { runIdempotentCreate } from './idempotent-create.js';
import { EMISORA_REPOSITORY, type EmisoraRepository } from './ports/emisora.repository.js';
import { registrarEvento } from './registrar-evento.js';
import {
  EMISORA_REPORT_EXPORTER,
  type EmisoraReportExporter,
} from './ports/report-exporter.port.js';
import { EmisoraUnitOfWork } from './ports/unit-of-work.js';

/* --------------------------------- Entradas -------------------------------- */

export interface CreateTurnoInput {
  transmisorId: string;
  operadorId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}
export interface TurnoTransitionInput {
  to: TurnoEstado;
}
export interface CreateLecturaInput {
  transmisorId: string;
  fecha: string;
  potenciaW?: number | null;
  frecuencia?: string | null;
  observaciones?: string | null;
}
export interface CreateBitacoraInput {
  transmisorId: string;
  turnoId?: string | null;
  fecha: string;
  incidente: string;
  accion?: string | null;
}
export interface CreateObraInput {
  titulo: string;
  compositorAutor: string;
  duracionSegundos: number;
  fechaInclusion: string;
  archivoId?: string | null;
}
export interface CreateReporteObraInput {
  entidad: EntidadReporte;
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
}
export interface CreatePagoInput {
  obraId: string;
  reporteId?: string | null;
  soporteArchivoId: string;
  referencia: string;
}
export interface CreateEquipoInput {
  nombre: string;
  tipo: string;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie: string;
  fechaAdquisicion?: string | null;
  archivoId?: string | null;
}
export interface EquipoEstadoInput {
  estado: EquipoEstado;
}
export interface CreateActualizacionInput {
  equipoId: string;
  descripcion: string;
  solicitadaPor?: string | null;
  fecha?: string | null;
  soporteArchivoId?: string | null;
}
export interface ActualizacionTransitionInput {
  to: ActualizacionEstado;
}
export interface CreateProyeccionInput {
  anio: number;
  equipoId?: string | null;
  descripcion: string;
  archivoId?: string | null;
}
export interface ProyeccionTransitionInput {
  to: ProyeccionEstado;
}
export interface CreateInversionInput {
  proyeccionId: string;
  contratoRef?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}
export interface InversionTransitionInput {
  to: InversionEstado;
  contratoRef?: string | null;
}
export interface CreateVersionSoftwareInput {
  equipoId?: string | null;
  nombre: string;
  version: string;
  fechaInstalacion: string;
  responsableId?: string | null;
}
export interface CreateAsignacionInput {
  equipoId: string;
  transmisorId?: string | null;
  usuarioId?: string | null;
  fechaAsignacion: string;
  fechaDevolucion?: string | null;
}
export interface CreateActividadInput {
  nombre: string;
  fecha: string;
  lugar?: string | null;
  descripcion?: string | null;
  responsableId?: string | null;
  archivoId?: string | null;
}
export interface CreatePermisoInput {
  actividadId: string;
  destino: string;
  referencia: string;
}
export interface CreateArchivoEmisoraInput {
  archivoId: string;
  tipo: ArchivoEmisoraTipo;
  duracionSegundos?: number | null;
  fecha: string;
  responsableId: string;
}
export interface CreatePlanillaInput {
  fecha: string;
  programacionDiariaId?: string | null;
  operadorId?: string | null;
  programa: string;
}
export interface CreateTramiteInput {
  destino: TramiteDestino;
  asunto: string;
  radicadoRef?: string | null;
  fechaRadicacion: string;
  responsableId?: string | null;
}
export interface CreateSoporteInput {
  archivoId: string;
  tipo?: string | null;
  descripcion?: string | null;
}
export interface TramiteTransitionInput {
  to: TramiteEstado;
  radicadoRef?: string | null;
}

const PERIODO = /^\d{4}(-(0[1-9]|1[0-2]))?$/u;
const TIPOS_ARCHIVO: Record<ArchivoEmisoraTipo, readonly string[]> = {
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'],
  documento: ['application/pdf'],
  imagen: ['image/png', 'image/jpeg'],
  acta: ['application/pdf'],
  formato: ['application/pdf'],
};

function texto(valor: string | null | undefined): string | null {
  const resultado = valor?.trim();
  return resultado ? resultado : null;
}

function obligatorio(valor: string | null | undefined, etiqueta: string): string {
  const resultado = texto(valor);
  if (!resultado) {
    throw EmisoraError.invalidInput(`${etiqueta} es obligatorio.`);
  }
  return resultado;
}

function fecha(valor: string | null | undefined, etiqueta: string): string {
  const resultado = obligatorio(valor, etiqueta);
  if (!esFechaValida(resultado)) {
    throw EmisoraError.invalidInput(`${etiqueta} debe estar en YYYY-MM-DD.`);
  }
  return resultado;
}

function fechaOpcional(valor: string | null | undefined, etiqueta: string): string | null {
  return valor === null || valor === undefined ? null : fecha(valor, etiqueta);
}

function entero(valor: number | null | undefined, etiqueta: string, minimo = 1): number {
  if (!Number.isInteger(valor) || (valor as number) < minimo) {
    throw EmisoraError.invalidInput(`${etiqueta} debe ser un entero mayor o igual a ${minimo}.`);
  }
  return valor as number;
}

function urlDescarga(archivoId: string): string {
  return `${env.API_PREFIX}/files/${archivoId}/download`;
}

/**
 * RF-07…RF-12 (plan §20). Escrituras transaccionales y auditorizadas; las
 * creaciones con efecto secundario usan la tienda de idempotencia compartida.
 * Las transiciones filtran por el estado de origen: un conflicto concurrente
 * devuelve 409 `INVALID_STATE_TRANSITION`, nunca 500.
 */
@Injectable()
export class EmisoraGestionService {
  constructor(
    @Inject(EMISORA_REPOSITORY) private readonly repository: EmisoraRepository,
    @Inject(EmisoraUnitOfWork) private readonly unitOfWork: EmisoraUnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    @Inject(FILE_DIRECTORY) private readonly files: FileDirectory,
    @Inject(EMISORA_REPORT_EXPORTER) private readonly exporter: EmisoraReportExporter,
  ) {}

  private async validarArchivo(
    archivoId: string,
    mime: readonly string[],
    etiqueta: string,
  ): Promise<{ archivoId: string; hashSha256: string | null; mime: string }> {
    const archivo = await this.files.findById(archivoId);
    if (!archivo || archivo.estadoEscaneo !== 'limpio' || !mime.includes(archivo.mime)) {
      throw EmisoraError.invalidInput(`${etiqueta} debe ser un archivo limpio y compatible.`);
    }
    return {
      archivoId,
      hashSha256: archivo.hashSha256 ?? null,
      mime: archivo.mime,
    };
  }

  private async crear<T>(
    operacion: string,
    cuerpo: unknown,
    actor: ActorContext,
    clave: string | null,
    accion: () => Promise<T>,
  ): Promise<T> {
    // Todas las comprobaciones de negocio viven dentro del callback: un replay
    // con la misma clave devuelve la respuesta cacheada antes de repetir efectos.
    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion,
        clave,
        cuerpo,
      },
      accion,
    );
  }

  private async transmisor(transmisorId: string): Promise<void> {
    if (!(await this.repository.findTransmisorById(transmisorId))) {
      throw EmisoraError.notFound('Transmisor');
    }
  }

  /* -------------------------------- RF-07 -------------------------------- */

  createTurno(
    input: CreateTurnoInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<TurnoView> {
    const dia = fecha(input.fecha, 'La fecha del turno');
    if (!esHoraValida(input.horaInicio) || !esHoraValida(input.horaFin)) {
      throw EmisoraError.invalidInput('Las horas del turno deben usar HH:mm.');
    }
    if (aMinutos(input.horaFin) <= aMinutos(input.horaInicio)) {
      throw EmisoraError.invalidInput('La hora de fin debe ser posterior a la de inicio.');
    }
    obligatorio(input.operadorId, 'El operador del turno');

    return this.crear('emisora:turno:create', input, actor, clave, async () => {
      await this.transmisor(input.transmisorId);
      const turno = await this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createTurno({
          id: uuidv7(),
          transmisorId: input.transmisorId,
          operadorId: input.operadorId,
          fecha: dia,
          horaInicio: input.horaInicio,
          horaFin: input.horaFin,
        });
        await registrarEvento(tx, {
          accion: 'turno.asignado',
          recurso: 'turno_operador',
          recursoId: fila.id,
          actor,
          datosDespues: {
            transmisorId: fila.transmisorId,
            operadorId: fila.operadorId,
            fecha: fila.fecha,
          },
          eventos: [
            {
              tipo: 'turno.asignado',
              payload: { turnoId: fila.id, operadorId: fila.operadorId, fecha: fila.fecha },
            },
          ],
        });
        return fila;
      });
      return turno;
    });
  }

  async transitionTurno(
    id: string,
    input: TurnoTransitionInput,
    actor: ActorContext,
  ): Promise<TurnoView> {
    return this.unitOfWork.run(async (tx) => {
      const actual = await tx.emisora.findTurnoById(id);
      if (!actual) throw EmisoraError.notFound('Turno');
      if (!canTransicionarE4('turno', actual.estado, input.to)) {
        throw EmisoraError.invalidTransition(actual.estado, input.to);
      }
      const fila = await tx.emisora.updateTurnoEstado(id, actual.estado, input.to);
      await registrarEvento(tx, {
        accion: 'turno.asignado',
        recurso: 'turno_operador',
        recursoId: id,
        actor,
        datosAntes: { estado: actual.estado },
        datosDespues: { estado: fila.estado },
        eventos: [],
      });
      return fila;
    });
  }

  createLectura(
    input: CreateLecturaInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<LecturaView> {
    const dia = fecha(input.fecha, 'La fecha de la lectura');
    if (input.potenciaW !== null && input.potenciaW !== undefined) {
      entero(input.potenciaW, 'La potencia', 0);
    }

    return this.crear('emisora:lectura:create', input, actor, clave, async () => {
      await this.transmisor(input.transmisorId);
      if (await this.repository.findLecturaByTransmisorFecha(input.transmisorId, dia)) {
        throw EmisoraError.lecturaDuplicada();
      }
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createLectura({
          id: uuidv7(),
          transmisorId: input.transmisorId,
          fecha: dia,
          potenciaW: input.potenciaW ?? null,
          frecuencia: texto(input.frecuencia),
          observaciones: texto(input.observaciones),
          registradoPor: actor.userId,
        });
        await registrarEvento(tx, {
          accion: 'lectura.registrada',
          recurso: 'lectura_transmisor',
          recursoId: fila.id,
          actor,
          datosDespues: {
            transmisorId: fila.transmisorId,
            fecha: fila.fecha,
            potenciaW: fila.potenciaW,
          },
          eventos: [
            {
              tipo: 'lectura.registrada',
              payload: { lecturaId: fila.id, transmisorId: fila.transmisorId, fecha: fila.fecha },
            },
          ],
        });
        return fila;
      });
    });
  }

  listLecturas(transmisorId: string | null): Promise<readonly LecturaView[]> {
    return this.repository.listLecturas(transmisorId);
  }

  createBitacora(
    input: CreateBitacoraInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<BitacoraView> {
    const dia = fecha(input.fecha, 'La fecha de la bitácora');
    const incidente = obligatorio(input.incidente, 'El incidente');

    return this.crear('emisora:bitacora:create', input, actor, clave, async () => {
      await this.transmisor(input.transmisorId);
      if (input.turnoId && !(await this.repository.findTurnoById(input.turnoId))) {
        throw EmisoraError.notFound('Turno');
      }
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createBitacora({
          id: uuidv7(),
          transmisorId: input.transmisorId,
          turnoId: texto(input.turnoId),
          fecha: dia,
          incidente,
          accion: texto(input.accion),
          actorId: actor.userId,
          requestId: actor.requestId,
        });
        await registrarEvento(tx, {
          accion: 'bitacora.registrada',
          recurso: 'bitacora_sede',
          recursoId: fila.id,
          actor,
          datosDespues: {
            transmisorId: fila.transmisorId,
            fecha: fila.fecha,
            incidente: fila.incidente,
          },
          eventos: [
            {
              tipo: 'bitacora.registrada',
              payload: { bitacoraId: fila.id, transmisorId: fila.transmisorId },
            },
          ],
        });
        return fila;
      });
    });
  }

  /* -------------------------------- RF-08 -------------------------------- */

  createObra(input: CreateObraInput, actor: ActorContext, clave: string | null): Promise<ObraView> {
    const titulo = obligatorio(input.titulo, 'El título de la obra');
    const compositor = obligatorio(input.compositorAutor, 'El compositor o autor de la obra');
    const duracion = entero(input.duracionSegundos, 'La duración de la obra');
    const inclusion = fecha(input.fechaInclusion, 'La fecha de inclusión');

    return this.crear('emisora:obra:create', input, actor, clave, async () =>
      this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createObra({
          id: uuidv7(),
          titulo,
          compositorAutor: compositor,
          duracionSegundos: duracion,
          fechaInclusion: inclusion,
          archivoId: texto(input.archivoId),
        });
        await registrarEvento(tx, {
          accion: 'obra.incluida',
          recurso: 'obra',
          recursoId: fila.id,
          actor,
          datosDespues: { titulo: fila.titulo, compositorAutor: fila.compositorAutor },
          eventos: [
            {
              tipo: 'obra.incluida',
              payload: { obraId: fila.id, titulo: fila.titulo },
            },
          ],
        });
        return fila;
      }),
    );
  }

  listObras(): Promise<readonly ObraView[]> {
    return this.repository.listObras();
  }

  createReporteObra(
    input: CreateReporteObraInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<ReporteObraView> {
    if (!PERIODO.test(input.periodo)) {
      throw EmisoraError.invalidInput('El periodo debe tener formato YYYY o YYYY-MM.');
    }
    const inicio = fecha(input.fechaInicio, 'La fecha de inicio');
    const fin = fecha(input.fechaFin, 'La fecha de fin');
    if (fin < inicio) {
      throw EmisoraError.invalidInput('La fecha de fin no puede ser anterior a la de inicio.');
    }

    return this.crear('emisora:reporte-obra:create', input, actor, clave, async () => {
      const obras = (await this.repository.listObras()).filter(
        (obra) => obra.fechaInclusion >= inicio && obra.fechaInclusion <= fin,
      );
      if (obras.length === 0) {
        throw EmisoraError.invalidInput('No hay obras incluidas en el periodo del reporte.');
      }
      const documento = await this.exporter.generarReporteObras({
        entidad: input.entidad,
        periodo: input.periodo,
        filas: obras.map((obra) => ({
          titulo: obra.titulo,
          compositor: obra.compositorAutor,
          duracion: `${Math.floor(obra.duracionSegundos / 60)}:${String(obra.duracionSegundos % 60).padStart(2, '0')}`,
        })),
        idempotencyKey: clave ?? '',
        actor,
      });
      const fila = await this.unitOfWork.run(async (tx) => {
        const reporte = await tx.emisora.createReporteObra({
          id: uuidv7(),
          entidad: input.entidad,
          periodo: input.periodo,
          fechaInicio: inicio,
          fechaFin: fin,
          archivoId: documento.archivoId,
        });
        await registrarEvento(tx, {
          accion: 'reporte_obra.generado',
          recurso: 'reporte_obra',
          recursoId: reporte.id,
          actor,
          datosDespues: {
            entidad: reporte.entidad,
            periodo: reporte.periodo,
            archivoId: reporte.archivoId,
          },
          eventos: [
            {
              tipo: 'reporte_obra.generado',
              payload: {
                reporteId: reporte.id,
                entidad: reporte.entidad,
                periodo: reporte.periodo,
              },
            },
          ],
        });
        return reporte;
      });
      return { ...fila, descargaUrl: urlDescarga(documento.archivoId) };
    });
  }

  createPago(
    input: CreatePagoInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<PagoDerechosView> {
    obligatorio(input.referencia, 'La referencia del pago');
    obligatorio(input.soporteArchivoId, 'El soporte del pago');

    return this.crear('emisora:pago:create', input, actor, clave, async () => {
      if (!(await this.repository.findObraById(input.obraId))) {
        throw EmisoraError.notFound('Obra');
      }
      await this.validarArchivo(input.soporteArchivoId, ['application/pdf'], 'El soporte del pago');
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createPagoDerechos({
          id: uuidv7(),
          obraId: input.obraId,
          reporteId: texto(input.reporteId),
          soporteArchivoId: input.soporteArchivoId,
          referencia: obligatorio(input.referencia, 'La referencia del pago'),
        });
        await registrarEvento(tx, {
          accion: 'pago.registrado',
          recurso: 'pago_derechos',
          recursoId: fila.id,
          actor,
          datosDespues: {
            obraId: fila.obraId,
            reporteId: fila.reporteId,
            referencia: fila.referencia,
          },
          eventos: [
            {
              tipo: 'pago.registrado',
              payload: { pagoId: fila.id, obraId: fila.obraId },
            },
          ],
        });
        return fila;
      });
    });
  }

  /* -------------------------------- RF-09 -------------------------------- */

  createEquipo(
    input: CreateEquipoInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<EquipoView> {
    obligatorio(input.nombre, 'El nombre del equipo');
    obligatorio(input.tipo, 'El tipo de equipo');
    obligatorio(input.numeroSerie, 'El número de serie');
    const adquisicion = fechaOpcional(input.fechaAdquisicion, 'La fecha de adquisición');

    return this.crear('emisora:equipo:create', input, actor, clave, async () =>
      this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createEquipo({
          id: uuidv7(),
          nombre: obligatorio(input.nombre, 'El nombre del equipo'),
          tipo: obligatorio(input.tipo, 'El tipo de equipo'),
          marca: texto(input.marca),
          modelo: texto(input.modelo),
          numeroSerie: obligatorio(input.numeroSerie, 'El número de serie'),
          fechaAdquisicion: adquisicion,
          archivoId: texto(input.archivoId),
        });
        await registrarEvento(tx, {
          accion: 'equipo.actualizado',
          recurso: 'hoja_vida_equipo',
          recursoId: fila.id,
          actor,
          datosDespues: { nombre: fila.nombre, numeroSerie: fila.numeroSerie },
          eventos: [],
        });
        return fila;
      }),
    );
  }

  async updateEquipoEstado(
    id: string,
    input: EquipoEstadoInput,
    actor: ActorContext,
  ): Promise<EquipoView> {
    const fila = await this.unitOfWork.run(async (tx) => {
      const actual = await tx.emisora.findEquipoById(id);
      if (!actual) throw EmisoraError.notFound('Equipo');
      const actualizado = await tx.emisora.updateEquipoEstado(id, input.estado);
      await registrarEvento(tx, {
        accion: 'equipo.actualizado',
        recurso: 'hoja_vida_equipo',
        recursoId: id,
        actor,
        datosAntes: { estado: actual.estado },
        datosDespues: { estado: actualizado.estado },
        eventos: [
          {
            tipo: 'equipo.actualizado',
            payload: { equipoId: id, estado: actualizado.estado },
          },
        ],
      });
      return actualizado;
    });
    return fila;
  }

  createActualizacion(
    input: CreateActualizacionInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<ActualizacionView> {
    obligatorio(input.descripcion, 'La descripción de la actualización');
    const dia = fechaOpcional(input.fecha, 'La fecha de la actualización');

    return this.crear('emisora:actualizacion:create', input, actor, clave, async () => {
      if (!(await this.repository.findEquipoById(input.equipoId))) {
        throw EmisoraError.notFound('Equipo');
      }
      const soporte = texto(input.soporteArchivoId);
      if (soporte) {
        await this.validarArchivo(soporte, ['application/pdf'], 'El soporte de la actualización');
      }
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createActualizacion({
          id: uuidv7(),
          equipoId: input.equipoId,
          descripcion: obligatorio(input.descripcion, 'La descripción de la actualización'),
          solicitadaPor: texto(input.solicitadaPor),
          fecha: dia,
          soporteArchivoId: soporte,
        });
        await registrarEvento(tx, {
          accion: 'equipo.actualizado',
          recurso: 'actualizacion_tecnologica',
          recursoId: fila.id,
          actor,
          datosDespues: { equipoId: fila.equipoId, descripcion: fila.descripcion },
          eventos: [],
        });
        return fila;
      });
    });
  }

  async transitionActualizacion(
    id: string,
    input: ActualizacionTransitionInput,
    actor: ActorContext,
  ): Promise<ActualizacionView> {
    return this.unitOfWork.run(async (tx) => {
      const actual = await tx.emisora.findActualizacionById(id);
      if (!actual) throw EmisoraError.notFound('Actualización tecnológica');
      if (!canTransicionarE4('actualizacion', actual.estado, input.to)) {
        throw EmisoraError.invalidTransition(actual.estado, input.to);
      }
      const fila = await tx.emisora.updateActualizacionEstado(id, actual.estado, input.to);
      await registrarEvento(tx, {
        accion: 'equipo.actualizado',
        recurso: 'actualizacion_tecnologica',
        recursoId: id,
        actor,
        datosAntes: { estado: actual.estado },
        datosDespues: { estado: fila.estado },
        eventos: [],
      });
      return fila;
    });
  }

  createProyeccion(
    input: CreateProyeccionInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<ProyeccionView> {
    const anio = entero(input.anio, 'El año de la proyección', 2000);
    if (anio > 2100) throw EmisoraError.invalidInput('El año de la proyección no es válido.');
    obligatorio(input.descripcion, 'La descripción de la proyección');

    return this.crear('emisora:proyeccion:create', input, actor, clave, async () => {
      if (input.equipoId && !(await this.repository.findEquipoById(input.equipoId))) {
        throw EmisoraError.notFound('Equipo');
      }
      if (await this.repository.findProyeccionByAnio(anio)) {
        throw EmisoraError.proyeccionDuplicada();
      }
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createProyeccion({
          id: uuidv7(),
          anio,
          equipoId: texto(input.equipoId),
          descripcion: obligatorio(input.descripcion, 'La descripción de la proyección'),
          archivoId: texto(input.archivoId),
        });
        await registrarEvento(tx, {
          accion: 'proyeccion.generada',
          recurso: 'proyeccion_anual',
          recursoId: fila.id,
          actor,
          datosDespues: { anio: fila.anio, descripcion: fila.descripcion },
          eventos: [],
        });
        return fila;
      });
    });
  }

  async transitionProyeccion(
    id: string,
    input: ProyeccionTransitionInput,
    actor: ActorContext,
  ): Promise<ProyeccionView> {
    return this.unitOfWork.run(async (tx) => {
      const actual = await tx.emisora.findProyeccionById(id);
      if (!actual) throw EmisoraError.notFound('Proyección anual');
      if (!canTransicionarE4('proyeccion', actual.estado, input.to)) {
        throw EmisoraError.invalidTransition(actual.estado, input.to);
      }
      const fila = await tx.emisora.updateProyeccionEstado(id, actual.estado, input.to);
      await registrarEvento(tx, {
        accion: 'proyeccion.generada',
        recurso: 'proyeccion_anual',
        recursoId: id,
        actor,
        datosAntes: { estado: actual.estado },
        datosDespues: { estado: fila.estado },
        eventos: [{ tipo: 'proyeccion.generada', payload: { proyeccionId: id, anio: fila.anio } }],
      });
      return fila;
    });
  }

  createInversion(
    input: CreateInversionInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<InversionView> {
    const inicio = fechaOpcional(input.fechaInicio, 'La fecha de inicio');
    const fin = fechaOpcional(input.fechaFin, 'La fecha de fin');
    if (inicio && fin && fin < inicio) {
      throw EmisoraError.invalidInput('La fecha de fin no puede ser anterior a la de inicio.');
    }

    return this.crear('emisora:inversion:create', input, actor, clave, async () => {
      if (!(await this.repository.findProyeccionById(input.proyeccionId))) {
        throw EmisoraError.notFound('Proyección anual');
      }
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createInversion({
          id: uuidv7(),
          proyeccionId: input.proyeccionId,
          contratoRef: texto(input.contratoRef),
          fechaInicio: inicio,
          fechaFin: fin,
        });
        await registrarEvento(tx, {
          accion: 'inversion.registrada',
          recurso: 'inversion_seguimiento',
          recursoId: fila.id,
          actor,
          datosDespues: { proyeccionId: fila.proyeccionId, estado: fila.estado },
          eventos: [
            {
              tipo: 'inversion.registrada',
              payload: { inversionId: fila.id, proyeccionId: fila.proyeccionId },
            },
          ],
        });
        return fila;
      });
    });
  }

  async transitionInversion(
    id: string,
    input: InversionTransitionInput,
    actor: ActorContext,
  ): Promise<InversionView> {
    return this.unitOfWork.run(async (tx) => {
      const actual = await tx.emisora.findInversionById(id);
      if (!actual) throw EmisoraError.notFound('Seguimiento de inversión');
      if (!canTransicionarE4('inversion', actual.estado, input.to)) {
        throw EmisoraError.invalidTransition(actual.estado, input.to);
      }
      const referencia = texto(input.contratoRef) ?? actual.contratoRef;
      if (input.to === 'aprobada' && !referencia) {
        throw EmisoraError.invalidInput('Aprobar una inversión exige la referencia del contrato.');
      }
      const fila = await tx.emisora.updateInversionEstado(id, actual.estado, input.to, referencia);
      await registrarEvento(tx, {
        accion: 'inversion.registrada',
        recurso: 'inversion_seguimiento',
        recursoId: id,
        actor,
        datosAntes: { estado: actual.estado },
        datosDespues: { estado: fila.estado, contratoRef: fila.contratoRef },
        eventos: [],
      });
      return fila;
    });
  }

  createVersionSoftware(
    input: CreateVersionSoftwareInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<VersionSoftwareView> {
    obligatorio(input.nombre, 'El nombre del software');
    obligatorio(input.version, 'La versión del software');
    const instalacion = fecha(input.fechaInstalacion, 'La fecha de instalación');

    return this.crear('emisora:version-software:create', input, actor, clave, async () => {
      if (input.equipoId && !(await this.repository.findEquipoById(input.equipoId))) {
        throw EmisoraError.notFound('Equipo');
      }
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createVersionSoftware({
          id: uuidv7(),
          equipoId: texto(input.equipoId),
          nombre: obligatorio(input.nombre, 'El nombre del software'),
          version: obligatorio(input.version, 'La versión del software'),
          fechaInstalacion: instalacion,
          responsableId: texto(input.responsableId),
        });
        await registrarEvento(tx, {
          accion: 'equipo.actualizado',
          recurso: 'version_software',
          recursoId: fila.id,
          actor,
          datosDespues: { nombre: fila.nombre, version: fila.version },
          eventos: [],
        });
        return fila;
      });
    });
  }

  createAsignacion(
    input: CreateAsignacionInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<AsignacionEquipoView> {
    const asignacion = fecha(input.fechaAsignacion, 'La fecha de asignación');
    const devolucion = fechaOpcional(input.fechaDevolucion, 'La fecha de devolución');
    if (devolucion && devolucion < asignacion) {
      throw EmisoraError.invalidInput('La devolución no puede ser anterior a la asignación.');
    }

    return this.crear('emisora:asignacion:create', input, actor, clave, async () => {
      if (!(await this.repository.findEquipoById(input.equipoId))) {
        throw EmisoraError.notFound('Equipo');
      }
      if (input.transmisorId) await this.transmisor(input.transmisorId);
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createAsignacionEquipo({
          id: uuidv7(),
          equipoId: input.equipoId,
          transmisorId: texto(input.transmisorId),
          usuarioId: texto(input.usuarioId),
          fechaAsignacion: asignacion,
          fechaDevolucion: devolucion,
        });
        await registrarEvento(tx, {
          accion: 'equipo.actualizado',
          recurso: 'asignacion_equipo',
          recursoId: fila.id,
          actor,
          datosDespues: { equipoId: fila.equipoId, fechaAsignacion: fila.fechaAsignacion },
          eventos: [],
        });
        return fila;
      });
    });
  }

  /* ------------------------------- RF-10 -------------------------------- */

  createActividad(
    input: CreateActividadInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<ActividadCulturalView> {
    const nombre = obligatorio(input.nombre, 'El nombre de la actividad');
    const dia = fecha(input.fecha, 'La fecha de la actividad');

    return this.crear('emisora:actividad:create', input, actor, clave, async () =>
      this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createActividad({
          id: uuidv7(),
          nombre,
          fecha: dia,
          lugar: texto(input.lugar),
          descripcion: texto(input.descripcion),
          responsableId: texto(input.responsableId),
          archivoId: texto(input.archivoId),
        });
        await registrarEvento(tx, {
          accion: 'actividad.registrada',
          recurso: 'actividad_cultural',
          recursoId: fila.id,
          actor,
          datosDespues: { nombre: fila.nombre, fecha: fila.fecha },
          eventos: [
            {
              tipo: 'actividad.registrada',
              payload: { actividadId: fila.id, nombre: fila.nombre },
            },
          ],
        });
        return fila;
      }),
    );
  }

  listActividades(): Promise<readonly ActividadCulturalView[]> {
    return this.repository.listActividades();
  }

  createPermiso(
    input: CreatePermisoInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<PermisoGobiernoView> {
    const destino = obligatorio(input.destino, 'El destino del oficio');
    const referencia = obligatorio(input.referencia, 'La referencia del oficio');

    return this.crear('emisora:permiso:create', input, actor, clave, async () => {
      const actividad = await this.repository.findActividadById(input.actividadId);
      if (!actividad) throw EmisoraError.notFound('Actividad cultural');
      const documento = await this.exporter.generarOficioSalida({
        destino,
        asunto: `Permiso para la actividad ${actividad.nombre}`,
        referencia,
        idempotencyKey: clave ?? '',
        actor,
      });
      const hoy = fechaBogota(new Date()) ?? new Date().toISOString().slice(0, 10);
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createPermisoGobierno({
          id: uuidv7(),
          actividadId: actividad.id,
          oficioArchivoId: documento.archivoId,
          destino,
          fechaEmision: hoy,
        });
        await registrarEvento(tx, {
          accion: 'permiso.emitido',
          recurso: 'permiso_gobierno',
          recursoId: fila.id,
          actor,
          datosDespues: {
            actividadId: fila.actividadId,
            destino: fila.destino,
            oficioArchivoId: fila.oficioArchivoId,
          },
          eventos: [
            {
              tipo: 'permiso.emitido',
              payload: { permisoId: fila.id, actividadId: fila.actividadId },
            },
          ],
        });
        return { ...fila, descargaUrl: urlDescarga(documento.archivoId) };
      });
    });
  }

  /* -------------------------------- RF-11 -------------------------------- */

  createArchivo(
    input: CreateArchivoEmisoraInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<ArchivoEmisoraView> {
    obligatorio(input.archivoId, 'El archivo');
    const dia = fecha(input.fecha, 'La fecha del archivo');
    if (input.tipo === 'audio') {
      entero(input.duracionSegundos, 'La duración del audio');
    }

    return this.crear('emisora:archivo:create', input, actor, clave, async () => {
      if (await this.repository.findArchivoEmisoraByArchivoId(input.archivoId)) {
        throw EmisoraError.invalidInput('El archivo ya está registrado en la emisora.');
      }
      const archivo = await this.validarArchivo(
        input.archivoId,
        TIPOS_ARCHIVO[input.tipo],
        'El archivo de la emisora',
      );
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createArchivoEmisora({
          id: uuidv7(),
          archivoId: archivo.archivoId,
          tipo: input.tipo,
          duracionSegundos: input.duracionSegundos ?? null,
          fecha: dia,
          responsableId: obligatorio(input.responsableId, 'El responsable del archivo'),
          hashSha256: archivo.hashSha256,
          mime: archivo.mime,
        });
        await registrarEvento(tx, {
          accion: input.tipo === 'audio' ? 'audio.archivado' : 'archivo.registrado',
          recurso: 'archivo_emisora',
          recursoId: fila.id,
          actor,
          datosDespues: {
            archivoId: fila.archivoId,
            tipo: fila.tipo,
            hashSha256: fila.hashSha256,
          },
          eventos:
            input.tipo === 'audio'
              ? [
                  {
                    tipo: 'audio.archivado',
                    payload: { archivoEmisoraId: fila.id, archivoId: fila.archivoId },
                  },
                ]
              : [],
        });
        return { ...fila, descargaUrl: urlDescarga(fila.archivoId) };
      });
    });
  }

  createPlanilla(
    input: CreatePlanillaInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<PlanillaView> {
    const dia = fecha(input.fecha, 'La fecha de la planilla');
    const programa = obligatorio(input.programa, 'El programa de la planilla');

    return this.crear('emisora:planilla:create', input, actor, clave, async () => {
      if (await this.repository.findPlanillaByFecha(dia)) {
        throw EmisoraError.planillaDuplicada();
      }
      if (
        input.programacionDiariaId &&
        !(await this.repository.findProgramacionById(input.programacionDiariaId))
      ) {
        throw EmisoraError.notFound('Programación diaria');
      }
      const borrador = await this.exporter.generarPlanilla({
        fecha: dia,
        programa,
        archivoId: uuidv7(),
        idempotencyKey: clave ?? '',
        actor,
      });
      const fila = await this.unitOfWork.run(async (tx) => {
        const planilla = await tx.emisora.createPlanilla({
          id: uuidv7(),
          fecha: dia,
          programacionDiariaId: texto(input.programacionDiariaId),
          operadorId: texto(input.operadorId),
          archivoId: borrador.archivoId,
        });
        await registrarEvento(tx, {
          accion: 'planilla.registrada',
          recurso: 'planilla_emision',
          recursoId: planilla.id,
          actor,
          datosDespues: { fecha: planilla.fecha, archivoId: planilla.archivoId },
          eventos: [
            {
              tipo: 'planilla.registrada',
              payload: { planillaId: planilla.id, fecha: planilla.fecha },
            },
          ],
        });
        return planilla;
      });
      return { ...fila, descargaUrl: urlDescarga(borrador.archivoId) };
    });
  }

  /* -------------------------------- RF-12 -------------------------------- */

  createTramite(
    input: CreateTramiteInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<TramiteView> {
    const asunto = obligatorio(input.asunto, 'El asunto del trámite');
    const radicacion = fecha(input.fechaRadicacion, 'La fecha de radicación');

    return this.crear('emisora:tramite:create', input, actor, clave, async () =>
      this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createTramite({
          id: uuidv7(),
          destino: input.destino,
          asunto,
          radicadoRef: texto(input.radicadoRef),
          fechaRadicacion: radicacion,
          responsableId: texto(input.responsableId),
        });
        await registrarEvento(tx, {
          accion: 'tramite.radicado',
          recurso: 'tramite_externo',
          recursoId: fila.id,
          actor,
          datosDespues: {
            destino: fila.destino,
            asunto: fila.asunto,
            fechaRadicacion: fila.fechaRadicacion,
          },
          eventos: [
            {
              tipo: 'tramite.radicado',
              payload: { tramiteId: fila.id, destino: fila.destino },
            },
          ],
        });
        return fila;
      }),
    );
  }

  listTramites(): Promise<readonly TramiteView[]> {
    return this.repository.listTramites();
  }

  createSoporte(
    tramiteId: string,
    input: CreateSoporteInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<SoporteTramiteView> {
    obligatorio(input.archivoId, 'El archivo de soporte');

    return this.crear('emisora:soporte:create', { tramiteId, ...input }, actor, clave, async () => {
      if (!(await this.repository.findTramiteById(tramiteId))) {
        throw EmisoraError.notFound('Trámite externo');
      }
      await this.validarArchivo(input.archivoId, ['application/pdf'], 'El soporte del trámite');
      return this.unitOfWork.run(async (tx) => {
        const fila = await tx.emisora.createSoporteTramite({
          id: uuidv7(),
          tramiteId,
          archivoId: input.archivoId,
          tipo: texto(input.tipo),
          descripcion: texto(input.descripcion),
        });
        await registrarEvento(tx, {
          accion: 'soporte.adjuntado',
          recurso: 'soporte_tramite',
          recursoId: fila.id,
          actor,
          datosDespues: { tramiteId: fila.tramiteId, archivoId: fila.archivoId },
          eventos: [
            {
              tipo: 'soporte.adjuntado',
              payload: { soporteId: fila.id, tramiteId: fila.tramiteId },
            },
          ],
        });
        return fila;
      });
    });
  }

  async transitionTramite(
    id: string,
    input: TramiteTransitionInput,
    actor: ActorContext,
  ): Promise<TramiteView> {
    return this.unitOfWork.run(async (tx) => {
      const actual = await tx.emisora.findTramiteById(id);
      if (!actual) throw EmisoraError.notFound('Trámite externo');
      if (!canTransicionarE4('tramite', actual.estado, input.to)) {
        throw EmisoraError.invalidTransition(actual.estado, input.to);
      }
      const referencia = texto(input.radicadoRef) ?? actual.radicadoRef;
      if (input.to === 'en_tramite' && !referencia) {
        throw EmisoraError.invalidInput('Poner en trámite exige el número de radicado.');
      }
      const fila = await tx.emisora.updateTramiteEstado(id, actual.estado, input.to, referencia);
      await registrarEvento(tx, {
        accion: 'tramite.radicado',
        recurso: 'tramite_externo',
        recursoId: id,
        actor,
        datosAntes: { estado: actual.estado },
        datosDespues: { estado: fila.estado, radicadoRef: fila.radicadoRef },
        eventos: [],
      });
      return fila;
    });
  }

  async listSoportes(tramiteId: string): Promise<readonly SoporteTramiteView[]> {
    if (!(await this.repository.findTramiteById(tramiteId))) {
      throw EmisoraError.notFound('Trámite externo');
    }
    return this.repository.listSoportesTramite(tramiteId);
  }
}
