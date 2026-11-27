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
import { canTransicionarE3 } from '../domain/emisora-states.js';
import type {
  OrdenEmisionEstado,
  PatrocinioEstado,
  PrestamoEstado,
  PromoEstado,
  PublicacionEstado,
  TransmisionEstado,
} from '../domain/emisora-states.js';
import { cumpleAntelacionMifi, esFechaValida } from '../domain/emisora-rules.js';
import { EmisoraError } from './emisora-error.js';
import type {
  ActorContext,
  OrdenEmisionView,
  PatrocinioView,
  PrestamoMifiView,
  PromoView,
  PublicacionView,
  ReporteDesplazamientoView,
  ResolucionView,
  SalidaEquipoView,
  TransmisionView,
  ViaticoView,
} from './emisora.types.js';
import { runIdempotentCreate } from './idempotent-create.js';
import { registrarEvento } from './registrar-evento.js';
import {
  EMISORA_REPORT_EXPORTER,
  type EmisoraReportExporter,
} from './ports/report-exporter.port.js';
import { EMISORA_REPOSITORY, type EmisoraRepository } from './ports/emisora.repository.js';
import { EmisoraUnitOfWork } from './ports/unit-of-work.js';

export interface CreateResolucionInput {
  incentivoId: string;
  periodo: string;
}

export interface CreatePatrocinioInput {
  nombre: string;
  entidad: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  contratoArchivoId?: string | null;
}

export interface PatrocinioTransitionInput {
  to: PatrocinioEstado;
  contratoArchivoId?: string | null;
}

export interface CreatePromoInput {
  patrocinioId: string;
  nombre: string;
  guion?: string | null;
  duracionSegundos: number;
}

export interface PromoTransitionInput {
  to: PromoEstado;
  audioArchivoId?: string | null;
}

export interface CreateOrdenInput {
  promoId: string;
  programacionItemId?: string | null;
  fechaEmision?: string | null;
}

export interface OrdenTransitionInput {
  to: OrdenEmisionEstado;
}

export interface CreatePublicacionInput {
  promoId?: string | null;
  canal: string;
  fechaPublicacion: string;
  archivoId?: string | null;
}

export interface PublicacionTransitionInput {
  to: PublicacionEstado;
  archivoId?: string | null;
}

export interface CreateTransmisionInput {
  programacionItemId?: string | null;
  fechaTransmision: string;
  esFueraCiudad: boolean;
  destino?: string | null;
}

export interface TransmisionTransitionInput {
  to: TransmisionEstado;
}

export interface CreateSalidaEquipoInput {
  transmisionId: string;
  equipoId: string;
  responsableId: string;
  fechaSalida?: string | null;
  observaciones?: string | null;
}

export interface CreateReporteDesplazamientoInput {
  transmisionId: string;
  conductorId?: string | null;
  vehiculo: string;
  horaSalida?: string | null;
  horaLlegada?: string | null;
  novedades?: string | null;
}

export interface CreatePrestamoMifiInput {
  transmisionId: string;
  usuarioId: string;
  observaciones?: string | null;
}

export interface PrestamoTransitionInput {
  to: PrestamoEstado;
}

export interface CreateViaticoInput {
  transmisionId: string;
  usuarioId: string;
  soporteArchivoId?: string | null;
}

const ISO_FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/u;

function fechaHora(valor: string | null | undefined, etiqueta: string): Date | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  if (!ISO_FECHA_HORA.test(valor) || Number.isNaN(Date.parse(valor))) {
    throw EmisoraError.invalidInput(`${etiqueta} debe ser una fecha y hora ISO 8601 válida.`);
  }
  return new Date(valor);
}

function texto(valor: string | null | undefined): string | null {
  const resultado = valor?.trim();
  return resultado ? resultado : null;
}

function iso(valor: Date | null): string | null {
  return valor ? valor.toISOString() : null;
}

/**
 * RF-04…RF-06 y RF-03.7 (plan §19). Todas las escrituras son transaccionales,
 * auditorizadas e idempotentes cuando crean un agregado. Las transiciones
 * filtran por el estado de origen, igual que el fix de E2; el evento de dominio
 * se emite dentro de la misma transacción que el cambio de estado.
 */
@Injectable()
export class EmisoraOperacionService {
  constructor(
    @Inject(EMISORA_REPOSITORY) private readonly repository: EmisoraRepository,
    @Inject(EmisoraUnitOfWork) private readonly unitOfWork: EmisoraUnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    @Inject(FILE_DIRECTORY) private readonly files: FileDirectory,
    @Inject(EMISORA_REPORT_EXPORTER) private readonly exporter: EmisoraReportExporter,
  ) {}

  /* ----------------------------- RF-03.7 -------------------------------- */

  async createResolucion(
    input: CreateResolucionInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<ResolucionView> {
    // Las comprobaciones viven dentro del callback: con la misma clave, un
    // replay devuelve la respuesta cacheada antes de mirar el incentivo (que
    // ya tiene resolución). Así se conserva el contrato idempotente de §6.5.
    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:resolucion:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const incentivo = await this.repository.findIncentivoById(input.incentivoId);
        if (!incentivo) {
          throw EmisoraError.notFound('Incentivo');
        }
        if (incentivo.estado !== 'resuelto' || !incentivo.referenciaCdp?.trim()) {
          throw EmisoraError.incentivoNoResuelto();
        }
        if (!/^\d{4}(-(0[1-9]|1[0-2]))?$/u.test(input.periodo)) {
          throw EmisoraError.invalidInput('El periodo debe tener formato YYYY o YYYY-MM.');
        }
        if (await this.repository.findResolucionByIncentivoId(incentivo.id)) {
          throw EmisoraError.resolucionYaExistente();
        }
        const realizador = await this.repository.findRealizadorById(incentivo.realizadorId);
        if (!realizador) {
          throw EmisoraError.notFound('Realizador');
        }

        // Exportaciones registra `reporte.generado` con su propia auditoría y
        // outbox; la creación de la resolución solo audita `resolucion.generada`
        // (ya publicada en E2) sin duplicar el evento en la cola.
        const pdf = await this.exporter.generarResolucion({
          periodo: input.periodo,
          filas: [
            {
              realizador: `${realizador.nombres} ${realizador.apellidos}`.trim(),
              concepto: 'Incentivo de realización de programas',
              estado: incentivo.estado,
            },
          ],
          idempotencyKey: clave ?? '',
          actor,
        });

        const creada = await this.unitOfWork.run(async (tx) => {
          const resolucion = await tx.emisora.createResolucion({
            id: uuidv7(),
            incentivoId: incentivo.id,
            pdfArchivoId: pdf.archivoId,
            referenciaCdp: incentivo.referenciaCdp ?? '',
          });
          await registrarEvento(tx, {
            accion: 'resolucion.generada',
            recurso: 'resolucion_incentivo',
            recursoId: resolucion.id,
            actor,
            datosDespues: {
              incentivoId: incentivo.id,
              archivoId: pdf.archivoId,
              referenciaCdp: resolucion.referenciaCdp,
            },
            eventos: [],
          });
          return resolucion;
        });

        return {
          id: creada.id,
          incentivoId: creada.incentivoId,
          archivoId: creada.pdfArchivoId,
          referenciaCdp: creada.referenciaCdp,
          emitidaEn: creada.emitidaEn.toISOString(),
          descargaUrl: `${env.API_PREFIX}/files/${creada.pdfArchivoId}/download`,
        };
      },
    );
  }

  async getResolucionPdf(id: string): Promise<ResolucionView> {
    const resolucion = await this.repository.findResolucionById(id);
    if (!resolucion) {
      throw EmisoraError.notFound('Resolución de incentivo');
    }
    return {
      id: resolucion.id,
      incentivoId: resolucion.incentivoId,
      archivoId: resolucion.pdfArchivoId,
      referenciaCdp: resolucion.referenciaCdp,
      emitidaEn: resolucion.emitidaEn.toISOString(),
      descargaUrl: `${env.API_PREFIX}/files/${resolucion.pdfArchivoId}/download`,
    };
  }

  /* ------------------------------ RF-04 --------------------------------- */

  createPatrocinio(
    input: CreatePatrocinioInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<PatrocinioView> {
    if (!texto(input.nombre) || !texto(input.entidad)) {
      throw EmisoraError.invalidInput('Nombre y entidad del patrocinio son obligatorios.');
    }
    for (const fecha of [input.fechaInicio, input.fechaFin]) {
      if (fecha !== null && fecha !== undefined && !esFechaValida(fecha)) {
        throw EmisoraError.invalidInput('Las fechas de vigencia deben estar en YYYY-MM-DD.');
      }
    }
    if (input.fechaInicio && input.fechaFin && input.fechaFin < input.fechaInicio) {
      throw EmisoraError.invalidInput('La fecha de fin no puede ser anterior a la de inicio.');
    }

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:patrocinio:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const creado = await this.unitOfWork.run(async (tx) => {
          const patrocinio = await tx.emisora.createPatrocinio({
            id: uuidv7(),
            nombre: texto(input.nombre) ?? '',
            entidad: texto(input.entidad) ?? '',
            fechaInicio: texto(input.fechaInicio),
            fechaFin: texto(input.fechaFin),
            contratoArchivoId: texto(input.contratoArchivoId),
          });
          await registrarEvento(tx, {
            accion: 'patrocinio.propuesto',
            recurso: 'patrocinio',
            recursoId: patrocinio.id,
            actor,
            datosDespues: { nombre: patrocinio.nombre, entidad: patrocinio.entidad },
            eventos: [],
          });
          return patrocinio;
        });
        return toPatrocinioView(creado);
      },
    );
  }

  async transitionPatrocinio(
    id: string,
    input: PatrocinioTransitionInput,
    actor: ActorContext,
  ): Promise<PatrocinioView> {
    const actualizado = await this.unitOfWork.run(async (tx) => {
      const patrocinio = await tx.emisora.findPatrocinioById(id);
      if (!patrocinio) {
        throw EmisoraError.notFound('Patrocinio');
      }
      if (!canTransicionarE3('patrocinio', patrocinio.estado, input.to)) {
        throw EmisoraError.invalidTransition(patrocinio.estado, input.to);
      }
      const contratoArchivoId = texto(input.contratoArchivoId) ?? patrocinio.contratoArchivoId;
      if (input.to === 'aprobado') {
        if (!contratoArchivoId) {
          throw EmisoraError.patrocinioSinContrato();
        }
        await this.validarArchivo(contratoArchivoId, 'application/pdf', 'Contrato del patrocinio');
      }
      const row = await tx.emisora.updatePatrocinioEstado(
        id,
        patrocinio.estado,
        input.to,
        contratoArchivoId,
      );
      await registrarEvento(tx, {
        accion: input.to === 'aprobado' ? 'patrocinio.aprobado' : 'patrocinio.rechazado',
        recurso: 'patrocinio',
        recursoId: id,
        actor,
        datosAntes: { estado: patrocinio.estado },
        datosDespues: { estado: row.estado, contratoArchivoId },
        eventos:
          input.to === 'aprobado'
            ? [{ tipo: 'patrocinio.aprobado', payload: { patrocinioId: id, entidad: row.entidad } }]
            : [],
      });
      return row;
    });
    return toPatrocinioView(actualizado);
  }

  /* ------------------------------ RF-05 --------------------------------- */

  createPromo(
    input: CreatePromoInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<PromoView> {
    if (
      !texto(input.nombre) ||
      !Number.isInteger(input.duracionSegundos) ||
      input.duracionSegundos <= 0
    ) {
      throw EmisoraError.invalidInput('La promo exige nombre y duración en segundos positiva.');
    }

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:promo:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const patrocinio = await this.repository.findPatrocinioById(input.patrocinioId);
        if (!patrocinio) {
          throw EmisoraError.notFound('Patrocinio');
        }
        if (patrocinio.estado !== 'aprobado') {
          throw EmisoraError.invalidInput('La promo exige un patrocinio aprobado.');
        }
        const creada = await this.unitOfWork.run(async (tx) => {
          const promo = await tx.emisora.createPromo({
            id: uuidv7(),
            patrocinioId: patrocinio.id,
            nombre: texto(input.nombre) ?? '',
            guion: texto(input.guion),
            duracionSegundos: input.duracionSegundos,
            audioArchivoId: null,
          });
          await registrarEvento(tx, {
            accion: 'promo.creada',
            recurso: 'promo',
            recursoId: promo.id,
            actor,
            datosDespues: { patrocinioId: promo.patrocinioId, nombre: promo.nombre },
            eventos: [],
          });
          return promo;
        });
        return toPromoView(creada);
      },
    );
  }

  async transitionPromo(
    id: string,
    input: PromoTransitionInput,
    actor: ActorContext,
  ): Promise<PromoView> {
    const actualizada = await this.unitOfWork.run(async (tx) => {
      const promo = await tx.emisora.findPromoById(id);
      if (!promo) {
        throw EmisoraError.notFound('Promo');
      }
      if (!canTransicionarE3('promo', promo.estado, input.to)) {
        throw EmisoraError.invalidTransition(promo.estado, input.to);
      }
      const audioArchivoId = texto(input.audioArchivoId) ?? promo.audioArchivoId;
      if (input.to === 'producida') {
        if (!audioArchivoId) {
          throw EmisoraError.promoSinAudio();
        }
        await this.validarArchivo(audioArchivoId, 'audio/mpeg', 'Audio de la promo');
      }
      const row = await tx.emisora.updatePromoEstado(id, promo.estado, input.to, audioArchivoId);
      await registrarEvento(tx, {
        accion: 'promo.producida',
        recurso: 'promo',
        recursoId: id,
        actor,
        datosAntes: { estado: promo.estado },
        datosDespues: { estado: row.estado, audioArchivoId },
        eventos:
          input.to === 'producida'
            ? [{ tipo: 'promo.producida', payload: { promoId: id, audioArchivoId } }]
            : [],
      });
      return row;
    });
    return toPromoView(actualizada);
  }

  createOrden(
    input: CreateOrdenInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<OrdenEmisionView> {
    if (input.fechaEmision && !esFechaValida(input.fechaEmision)) {
      throw EmisoraError.invalidInput('La fecha de emisión debe estar en YYYY-MM-DD.');
    }

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:orden:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const promo = await this.repository.findPromoById(input.promoId);
        if (!promo) {
          throw EmisoraError.notFound('Promo');
        }
        if (promo.estado !== 'producida') {
          throw EmisoraError.invalidInput('La orden exige una promo producida.');
        }
        if (
          input.programacionItemId &&
          !(await this.repository.findProgramacionItemById(input.programacionItemId))
        ) {
          throw EmisoraError.notFound('Franja de programación');
        }
        const creada = await this.unitOfWork.run(async (tx) => {
          const orden = await tx.emisora.createOrden({
            id: uuidv7(),
            promoId: promo.id,
            programacionItemId: texto(input.programacionItemId),
            fechaEmision: texto(input.fechaEmision),
          });
          await registrarEvento(tx, {
            accion: 'orden.creada',
            recurso: 'orden_emision',
            recursoId: orden.id,
            actor,
            datosDespues: { promoId: orden.promoId, programacionItemId: orden.programacionItemId },
            eventos: [],
          });
          return orden;
        });
        return toOrdenView(creada);
      },
    );
  }

  async transitionOrden(
    id: string,
    input: OrdenTransitionInput,
    actor: ActorContext,
  ): Promise<OrdenEmisionView> {
    const actualizada = await this.unitOfWork.run(async (tx) => {
      const orden = await tx.emisora.findOrdenById(id);
      if (!orden) {
        throw EmisoraError.notFound('Orden de emisión');
      }
      if (!canTransicionarE3('orden', orden.estado, input.to)) {
        throw EmisoraError.invalidTransition(orden.estado, input.to);
      }
      const row = await tx.emisora.updateOrdenEstado(
        id,
        orden.estado,
        input.to,
        input.to === 'emitida' ? new Date() : null,
      );
      await registrarEvento(tx, {
        accion: input.to === 'emitida' ? 'orden.emitida' : 'orden.programada',
        recurso: 'orden_emision',
        recursoId: id,
        actor,
        datosAntes: { estado: orden.estado },
        datosDespues: { estado: row.estado, fechaEmision: row.fechaEmision },
        eventos:
          input.to === 'emitida'
            ? [{ tipo: 'orden.emitida', payload: { ordenId: id, promoId: row.promoId } }]
            : [],
      });
      return row;
    });
    return toOrdenView(actualizada);
  }

  createPublicacion(
    input: CreatePublicacionInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<PublicacionView> {
    if (!texto(input.canal) || !esFechaValida(input.fechaPublicacion)) {
      throw EmisoraError.invalidInput('La publicación exige canal y fecha YYYY-MM-DD.');
    }
    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:publicacion:create',
        clave,
        cuerpo: input,
      },
      async () => {
        if (input.promoId && !(await this.repository.findPromoById(input.promoId))) {
          throw EmisoraError.notFound('Promo');
        }
        const creada = await this.unitOfWork.run(async (tx) => {
          const publicacion = await tx.emisora.createPublicacion({
            id: uuidv7(),
            promoId: texto(input.promoId),
            canal: texto(input.canal) ?? '',
            fechaPublicacion: input.fechaPublicacion,
            archivoId: texto(input.archivoId),
          });
          await registrarEvento(tx, {
            accion: 'publicacion.programada',
            recurso: 'publicacion',
            recursoId: publicacion.id,
            actor,
            datosDespues: { canal: publicacion.canal, fecha: publicacion.fechaPublicacion },
            eventos: [],
          });
          return publicacion;
        });
        return toPublicacionView(creada);
      },
    );
  }

  async transitionPublicacion(
    id: string,
    input: PublicacionTransitionInput,
    actor: ActorContext,
  ): Promise<PublicacionView> {
    const actualizada = await this.unitOfWork.run(async (tx) => {
      const publicacion = await tx.emisora.findPublicacionById(id);
      if (!publicacion) {
        throw EmisoraError.notFound('Publicación');
      }
      if (!canTransicionarE3('publicacion', publicacion.estado, input.to)) {
        throw EmisoraError.invalidTransition(publicacion.estado, input.to);
      }
      const row = await tx.emisora.updatePublicacionEstado(
        id,
        publicacion.estado,
        input.to,
        input.to === 'publicada' ? new Date() : null,
        texto(input.archivoId) ?? publicacion.archivoId,
      );
      await registrarEvento(tx, {
        accion: 'publicacion.realizada',
        recurso: 'publicacion',
        recursoId: id,
        actor,
        datosAntes: { estado: publicacion.estado },
        datosDespues: { estado: row.estado, canal: row.canal },
        eventos:
          input.to === 'publicada'
            ? [{ tipo: 'publicacion.realizada', payload: { publicacionId: id, canal: row.canal } }]
            : [],
      });
      return row;
    });
    return toPublicacionView(actualizada);
  }

  /* ------------------------------ RF-06 --------------------------------- */

  createTransmision(
    input: CreateTransmisionInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<TransmisionView> {
    if (!esFechaValida(input.fechaTransmision)) {
      throw EmisoraError.invalidInput('La fecha de transmisión debe estar en YYYY-MM-DD.');
    }
    if (input.esFueraCiudad && !texto(input.destino)) {
      throw EmisoraError.invalidInput('Una transmisión fuera de la ciudad exige destino.');
    }
    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:transmision:create',
        clave,
        cuerpo: input,
      },
      async () => {
        if (
          input.programacionItemId &&
          !(await this.repository.findProgramacionItemById(input.programacionItemId))
        ) {
          throw EmisoraError.notFound('Franja de programación');
        }
        const creada = await this.unitOfWork.run(async (tx) => {
          const transmision = await tx.emisora.createTransmision({
            id: uuidv7(),
            programacionItemId: texto(input.programacionItemId),
            fechaTransmision: input.fechaTransmision,
            esFueraCiudad: input.esFueraCiudad,
            destino: texto(input.destino),
          });
          await registrarEvento(tx, {
            accion: 'transmision.programada',
            recurso: 'transmision',
            recursoId: transmision.id,
            actor,
            datosDespues: {
              fechaTransmision: transmision.fechaTransmision,
              esFueraCiudad: transmision.esFueraCiudad,
            },
            eventos: [],
          });
          return transmision;
        });
        return toTransmisionView(creada);
      },
    );
  }

  async transitionTransmision(
    id: string,
    input: TransmisionTransitionInput,
    actor: ActorContext,
  ): Promise<TransmisionView> {
    const actualizada = await this.unitOfWork.run(async (tx) => {
      const transmision = await tx.emisora.findTransmisionById(id);
      if (!transmision) {
        throw EmisoraError.notFound('Transmisión');
      }
      if (!canTransicionarE3('transmision', transmision.estado, input.to)) {
        throw EmisoraError.invalidTransition(transmision.estado, input.to);
      }
      if (input.to === 'autorizada') {
        const salidas = await tx.emisora.findSalidaEquipoByTransmision(id);
        const reporte = await tx.emisora.findReporteDesplazamientoByTransmision(id);
        if (salidas.length === 0 || !reporte) {
          throw EmisoraError.transmisionSinSoportes();
        }
      }
      const row = await tx.emisora.updateTransmisionEstado(
        id,
        transmision.estado,
        input.to,
        input.to === 'autorizada' ? actor.userId : null,
        input.to === 'autorizada' ? new Date() : null,
      );
      await registrarEvento(tx, {
        accion: input.to === 'autorizada' ? 'transmision.autorizada' : `transmision.${input.to}`,
        recurso: 'transmision',
        recursoId: id,
        actor,
        datosAntes: { estado: transmision.estado },
        datosDespues: { estado: row.estado, autorizadaEn: iso(row.autorizadaEn) },
        eventos:
          input.to === 'autorizada'
            ? [
                {
                  tipo: 'transmision.autorizada',
                  payload: {
                    transmisionId: id,
                    fechaTransmision: row.fechaTransmision,
                    esFueraCiudad: row.esFueraCiudad,
                  },
                },
              ]
            : [],
      });
      return row;
    });
    return toTransmisionView(actualizada);
  }

  createSalidaEquipo(
    input: CreateSalidaEquipoInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<SalidaEquipoView> {
    const fechaSalida = fechaHora(input.fechaSalida, 'La fecha de salida');
    if (!texto(input.equipoId) || !texto(input.responsableId)) {
      throw EmisoraError.invalidInput('Equipo y responsable son obligatorios.');
    }
    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:salida-equipo:create',
        clave,
        cuerpo: input,
      },
      async () => {
        await this.exigirTransmision(input.transmisionId);
        const creada = await this.unitOfWork.run(async (tx) => {
          const salida = await tx.emisora.createSalidaEquipo({
            id: uuidv7(),
            transmisionId: input.transmisionId,
            equipoId: texto(input.equipoId) ?? '',
            responsableId: texto(input.responsableId) ?? '',
            fechaSalida: fechaSalida ?? new Date(),
            observaciones: texto(input.observaciones),
          });
          await registrarEvento(tx, {
            accion: 'salida_equipo.registrada',
            recurso: 'salida_equipo',
            recursoId: salida.id,
            actor,
            datosDespues: { transmisionId: salida.transmisionId, equipoId: salida.equipoId },
            eventos: [],
          });
          return salida;
        });
        return toSalidaView(creada);
      },
    );
  }

  createReporteDesplazamiento(
    input: CreateReporteDesplazamientoInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<ReporteDesplazamientoView> {
    const horaSalida = fechaHora(input.horaSalida, 'La hora de salida');
    const horaLlegada = fechaHora(input.horaLlegada, 'La hora de llegada');
    if (!texto(input.vehiculo)) {
      throw EmisoraError.invalidInput('El vehículo es obligatorio.');
    }
    if (horaSalida && horaLlegada && horaLlegada < horaSalida) {
      throw EmisoraError.invalidInput('La hora de llegada no puede ser anterior a la de salida.');
    }
    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:reporte-desplazamiento:create',
        clave,
        cuerpo: input,
      },
      async () => {
        await this.exigirTransmision(input.transmisionId);
        const creado = await this.unitOfWork.run(async (tx) => {
          const reporte = await tx.emisora.createReporteDesplazamiento({
            id: uuidv7(),
            transmisionId: input.transmisionId,
            conductorId: texto(input.conductorId),
            vehiculo: texto(input.vehiculo) ?? '',
            horaSalida,
            horaLlegada,
            novedades: texto(input.novedades),
          });
          await registrarEvento(tx, {
            accion: 'reporte_desplazamiento.registrado',
            recurso: 'reporte_desplazamiento',
            recursoId: reporte.id,
            actor,
            datosDespues: { transmisionId: reporte.transmisionId, vehiculo: reporte.vehiculo },
            eventos: [],
          });
          return reporte;
        });
        return toReporteView(creado);
      },
    );
  }

  createPrestamoMifi(
    input: CreatePrestamoMifiInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<PrestamoMifiView> {
    if (!texto(input.usuarioId)) {
      throw EmisoraError.invalidInput('El usuario del préstamo es obligatorio.');
    }
    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:prestamo:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const transmision = await this.exigirTransmision(input.transmisionId);
        const ahora = new Date();
        if (!cumpleAntelacionMifi(ahora, transmision.fechaTransmision)) {
          throw EmisoraError.mifiAntelacionInsuficiente();
        }
        const creado = await this.unitOfWork.run(async (tx) => {
          const prestamo = await tx.emisora.createPrestamoMifi({
            id: uuidv7(),
            transmisionId: transmision.id,
            usuarioId: texto(input.usuarioId) ?? '',
            fechaSolicitud: ahora,
            fechaTransmision: transmision.fechaTransmision,
            observaciones: texto(input.observaciones),
          });
          await registrarEvento(tx, {
            accion: 'prestamo.solicitado',
            recurso: 'prestamo_mifi',
            recursoId: prestamo.id,
            actor,
            datosDespues: {
              transmisionId: prestamo.transmisionId,
              fechaTransmision: prestamo.fechaTransmision,
            },
            eventos: [],
          });
          return prestamo;
        });
        return toPrestamoView(creado);
      },
    );
  }

  async transitionPrestamoMifi(
    id: string,
    input: PrestamoTransitionInput,
    actor: ActorContext,
  ): Promise<PrestamoMifiView> {
    const actualizado = await this.unitOfWork.run(async (tx) => {
      const prestamo = await tx.emisora.findPrestamoMifiById(id);
      if (!prestamo) {
        throw EmisoraError.notFound('Préstamo de mifi');
      }
      if (!canTransicionarE3('prestamo', prestamo.estado, input.to)) {
        throw EmisoraError.invalidTransition(prestamo.estado, input.to);
      }
      const row = await tx.emisora.updatePrestamoMifiEstado(id, prestamo.estado, input.to);
      await registrarEvento(tx, {
        accion: input.to === 'autorizado' ? 'prestamo.autorizado' : `prestamo.${input.to}`,
        recurso: 'prestamo_mifi',
        recursoId: id,
        actor,
        datosAntes: { estado: prestamo.estado },
        datosDespues: { estado: row.estado },
        eventos:
          input.to === 'autorizado'
            ? [
                {
                  tipo: 'prestamo.autorizado',
                  payload: { prestamoId: id, usuarioId: row.usuarioId },
                  usuarioIds: [row.usuarioId],
                },
              ]
            : [],
      });
      return row;
    });
    return toPrestamoView(actualizado);
  }

  createViatico(
    input: CreateViaticoInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<ViaticoView> {
    if (!texto(input.usuarioId)) {
      throw EmisoraError.invalidInput('El usuario del viático es obligatorio.');
    }
    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:viatico:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const transmision = await this.exigirTransmision(input.transmisionId);
        if (!transmision.esFueraCiudad) {
          throw EmisoraError.viaticoNoFueraCiudad();
        }
        const creado = await this.unitOfWork.run(async (tx) => {
          const viatico = await tx.emisora.createViatico({
            id: uuidv7(),
            transmisionId: transmision.id,
            usuarioId: texto(input.usuarioId) ?? '',
            soporteArchivoId: texto(input.soporteArchivoId),
          });
          await registrarEvento(tx, {
            accion: 'viatico.solicitado',
            recurso: 'viatico',
            recursoId: viatico.id,
            actor,
            datosDespues: { transmisionId: transmision.id },
            eventos: [
              {
                tipo: 'viatico.solicitado',
                payload: { viaticoId: viatico.id, transmisionId: transmision.id },
                usuarioIds: [viatico.usuarioId],
              },
            ],
          });
          return viatico;
        });
        return toViaticoView(creado);
      },
    );
  }

  /* ---------------------------- Apoyo ----------------------------------- */

  private async exigirTransmision(id: string) {
    const transmision = await this.repository.findTransmisionById(id);
    if (!transmision) {
      throw EmisoraError.notFound('Transmisión');
    }
    return transmision;
  }

  /** RF-04/RF-05: los soportes se comprueban en Archivos, sin leer `public`. */
  private async validarArchivo(archivoId: string, mime: string, etiqueta: string): Promise<void> {
    const tipos = mime === 'audio/mpeg' ? ['audio/mpeg', 'audio/mp3'] : [mime];
    const archivo = await this.files.findById(archivoId);
    if (!archivo || archivo.estadoEscaneo !== 'limpio' || !tipos.includes(archivo.mime)) {
      throw EmisoraError.invalidInput(`${etiqueta} debe ser un archivo limpio y compatible.`);
    }
  }
}

/* ----------------------------- Mapeadores ------------------------------- */

function toPatrocinioView(row: {
  id: string;
  nombre: string;
  entidad: string;
  estado: PatrocinioView['estado'];
  fechaInicio: string | null;
  fechaFin: string | null;
  contratoArchivoId: string | null;
}): PatrocinioView {
  return {
    id: row.id,
    nombre: row.nombre,
    entidad: row.entidad,
    estado: row.estado,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin,
    contratoArchivoId: row.contratoArchivoId,
  };
}

function toPromoView(row: {
  id: string;
  patrocinioId: string | null;
  nombre: string;
  duracionSegundos: number;
  audioArchivoId: string | null;
  estado: PromoView['estado'];
}): PromoView {
  return {
    id: row.id,
    patrocinioId: row.patrocinioId,
    nombre: row.nombre,
    duracionSegundos: row.duracionSegundos,
    audioArchivoId: row.audioArchivoId,
    estado: row.estado,
  };
}

function toOrdenView(row: {
  id: string;
  promoId: string;
  programacionItemId: string | null;
  estado: OrdenEmisionView['estado'];
  fechaEmision: string | null;
  emitidaEn: Date | null;
}): OrdenEmisionView {
  return {
    id: row.id,
    promoId: row.promoId,
    programacionItemId: row.programacionItemId,
    estado: row.estado,
    fechaEmision: row.fechaEmision,
    emitidaEn: iso(row.emitidaEn),
  };
}

function toPublicacionView(row: {
  id: string;
  promoId: string | null;
  canal: string;
  fechaPublicacion: string;
  estado: PublicacionView['estado'];
  archivoId: string | null;
  publicadaEn: Date | null;
}): PublicacionView {
  return {
    id: row.id,
    promoId: row.promoId,
    canal: row.canal,
    fechaPublicacion: row.fechaPublicacion,
    estado: row.estado,
    archivoId: row.archivoId,
    publicadaEn: iso(row.publicadaEn),
  };
}

function toTransmisionView(row: {
  id: string;
  programacionItemId: string | null;
  fechaTransmision: string;
  esFueraCiudad: boolean;
  destino: string | null;
  estado: TransmisionView['estado'];
  autorizadaEn: Date | null;
}): TransmisionView {
  return {
    id: row.id,
    programacionItemId: row.programacionItemId,
    fechaTransmision: row.fechaTransmision,
    esFueraCiudad: row.esFueraCiudad,
    destino: row.destino,
    estado: row.estado,
    autorizadaEn: iso(row.autorizadaEn),
  };
}

function toSalidaView(row: {
  id: string;
  transmisionId: string;
  equipoId: string;
  responsableId: string;
  fechaSalida: Date;
  fechaDevolucion: Date | null;
}): SalidaEquipoView {
  return {
    id: row.id,
    transmisionId: row.transmisionId,
    equipoId: row.equipoId,
    responsableId: row.responsableId,
    fechaSalida: row.fechaSalida.toISOString(),
    fechaDevolucion: iso(row.fechaDevolucion),
  };
}

function toReporteView(row: {
  id: string;
  transmisionId: string;
  conductorId: string | null;
  vehiculo: string;
  horaSalida: Date | null;
  horaLlegada: Date | null;
  novedades: string | null;
}): ReporteDesplazamientoView {
  return {
    id: row.id,
    transmisionId: row.transmisionId,
    conductorId: row.conductorId,
    vehiculo: row.vehiculo,
    horaSalida: iso(row.horaSalida),
    horaLlegada: iso(row.horaLlegada),
    novedades: row.novedades,
  };
}

function toPrestamoView(row: {
  id: string;
  transmisionId: string;
  usuarioId: string;
  fechaSolicitud: Date;
  fechaTransmision: string;
  estado: PrestamoMifiView['estado'];
}): PrestamoMifiView {
  return {
    id: row.id,
    transmisionId: row.transmisionId,
    usuarioId: row.usuarioId,
    fechaSolicitud: row.fechaSolicitud.toISOString(),
    fechaTransmision: row.fechaTransmision,
    estado: row.estado,
  };
}

function toViaticoView(row: {
  id: string;
  transmisionId: string;
  usuarioId: string;
  estado: ViaticoView['estado'];
  referenciaCompromiso: string | null;
  referenciaOrden: string | null;
  soporteArchivoId: string | null;
}): ViaticoView {
  return {
    id: row.id,
    transmisionId: row.transmisionId,
    usuarioId: row.usuarioId,
    estado: row.estado,
    referenciaCompromiso: row.referenciaCompromiso,
    referenciaOrden: row.referenciaOrden,
    soporteArchivoId: row.soporteArchivoId,
  };
}
