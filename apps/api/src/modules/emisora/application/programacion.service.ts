import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  canTransicionarProgramacion,
  type FranjaTipo,
  type ProgramacionEstado,
} from '../domain/emisora-states.js';
import {
  esFechaValida,
  esHoraValida,
  haySolape,
  verificarContraRejilla,
} from '../domain/emisora-rules.js';
import { EmisoraError } from './emisora-error.js';
import type { ActorContext, ProgramacionView } from './emisora.types.js';
import { runIdempotentCreate } from './idempotent-create.js';
import { registrarEvento } from './registrar-evento.js';
import { EMISORA_REPOSITORY, type EmisoraRepository } from './ports/emisora.repository.js';
import { EmisoraUnitOfWork } from './ports/unit-of-work.js';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';

export interface NuevoItemProgramacion {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipo: FranjaTipo;
  programaId: string | null;
  titulo: string;
}

export interface CreateProgramacionInput {
  rejillaAnualId: string;
  fecha: string;
  items: readonly NuevoItemProgramacion[];
}

/**
 * RF-01: programación diaria ligada a la rejilla anual. La verificación no muta la
 * rejilla: las desviaciones se conservan en la programación y en auditoría.
 */
@Injectable()
export class ProgramacionService {
  constructor(
    @Inject(EMISORA_REPOSITORY) private readonly repository: EmisoraRepository,
    @Inject(EmisoraUnitOfWork) private readonly unitOfWork: EmisoraUnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
  ) {}

  async create(
    input: CreateProgramacionInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<ProgramacionView> {
    if (!esFechaValida(input.fecha)) {
      throw EmisoraError.invalidInput('La fecha de la programación no es válida.');
    }
    if (input.items.length === 0) {
      throw EmisoraError.invalidInput('La programación debe tener al menos una franja.');
    }
    for (const item of input.items) {
      if (
        item.fecha !== input.fecha ||
        !esHoraValida(item.horaInicio) ||
        !esHoraValida(item.horaFin) ||
        item.horaInicio >= item.horaFin
      ) {
        throw EmisoraError.invalidInput('Cada franja debe tener horas válidas y ordenadas.');
      }
    }
    // Validación primaria de solapes; la restricción de exclusión de la base
    // sigue siendo la red de seguridad para escrituras concurrentes.
    if (haySolape(input.items)) {
      throw EmisoraError.conflict('SCHEDULE_OVERLAP', 'Las franjas propuestas se solapan.');
    }

    const rejilla = await this.repository.findRejillaById(input.rejillaAnualId);
    if (!rejilla) {
      throw EmisoraError.notFound('Rejilla anual');
    }
    const franjas = await this.repository.listRejillaItems(rejilla.id);
    const resultado = verificarContraRejilla(
      input.items.map((item) => ({
        fecha: item.fecha,
        horaInicio: item.horaInicio,
        horaFin: item.horaFin,
        tipo: item.tipo,
        programaId: item.programaId,
        titulo: item.titulo,
      })),
      franjas,
    );

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:programacion:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const existing = await this.repository.findProgramacionByFecha(input.fecha);
        if (existing) {
          throw EmisoraError.conflict(
            'SCHEDULE_OVERLAP',
            'Ya existe una programación para la fecha indicada.',
          );
        }

        const created = await this.unitOfWork.run(async (tx) => {
          const programacion = await tx.emisora.createProgramacion({
            id: uuidv7(),
            rejillaAnualId: rejilla.id,
            fecha: input.fecha,
            concuerda: resultado.concuerda,
            desviaciones: resultado.desviaciones,
            responsableId: actor.userId,
            items: input.items.map((item) => ({ ...item, id: uuidv7() })),
          });
          await registrarEvento(tx, {
            accion: 'programacion.creada',
            recurso: 'programacion_diaria',
            recursoId: programacion.id,
            actor,
            datosDespues: {
              fecha: programacion.fecha,
              rejillaAnualId: programacion.rejillaAnualId,
              concuerda: programacion.concuerda,
              desviaciones: programacion.desviaciones,
            },
            eventos: [
              {
                tipo: 'programacion.creada',
                payload: {
                  programacionDiariaId: programacion.id,
                  rejillaAnualId: rejilla.id,
                  fecha: programacion.fecha,
                  concuerda: programacion.concuerda,
                },
              },
              {
                tipo: 'rejilla.verificada',
                payload: {
                  programacionDiariaId: programacion.id,
                  rejillaAnualId: rejilla.id,
                  concuerda: resultado.concuerda,
                  desviaciones: resultado.desviaciones,
                },
              },
            ],
          });
          return programacion;
        });

        return this.toView(created.id);
      },
    );
  }

  async transition(
    id: string,
    to: ProgramacionEstado,
    actor: ActorContext,
  ): Promise<ProgramacionView> {
    const programacion = await this.repository.findProgramacionById(id);
    if (!programacion) {
      throw EmisoraError.notFound('Programación diaria');
    }
    if (!canTransicionarProgramacion(programacion.estado, to)) {
      throw EmisoraError.invalidTransition(programacion.estado, to);
    }

    const actualizada = await this.unitOfWork.run(async (tx) => {
      const row = await tx.emisora.updateProgramacionEstado(id, to, actor.userId);
      await registrarEvento(tx, {
        accion: 'programacion.aprobada',
        recurso: 'programacion_diaria',
        recursoId: id,
        actor,
        datosAntes: { estado: programacion.estado },
        datosDespues: { estado: row.estado, responsableId: actor.userId },
        eventos: [
          {
            tipo: 'programacion.aprobada',
            payload: {
              programacionDiariaId: id,
              rejillaAnualId: row.rejillaAnualId,
              fecha: row.fecha,
              concuerda: row.concuerda,
            },
          },
        ],
      });
      return row;
    });
    void actualizada;
    return this.toView(id);
  }

  async getByFecha(fecha: string): Promise<ProgramacionView | null> {
    if (!esFechaValida(fecha)) {
      throw EmisoraError.invalidInput('La fecha de la programación no es válida.');
    }
    const programacion = await this.repository.findProgramacionByFecha(fecha);
    return programacion ? this.toView(programacion.id) : null;
  }

  private async toView(id: string): Promise<ProgramacionView> {
    const row = await this.repository.findProgramacionById(id);
    if (!row) {
      throw EmisoraError.notFound('Programación diaria');
    }
    const items = await this.repository.listProgramacionItems(id);
    return {
      id: row.id,
      rejillaAnualId: row.rejillaAnualId,
      fecha: row.fecha,
      estado: row.estado,
      concuerda: row.concuerda,
      desviaciones: [...row.desviaciones],
      items: [...items],
    };
  }
}
