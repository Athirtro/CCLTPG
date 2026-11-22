import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import { AcademicError } from './academic-error.js';
import type { ProgramaView } from './academic.views.js';
import type { ActorContext, PageInput, PageResult } from './academic.types.js';
import { runIdempotentCreate } from './idempotent-create.js';
import { ProgramRepository } from './ports/program.repository.js';
import { AcademicUnitOfWork } from './ports/unit-of-work.js';
import {
  canTransitionPrograma,
  type ProgramaArea,
  type ProgramaEstado,
} from '../domain/academic-states.js';

export interface CreateProgramaInput {
  nombre: string;
  descripcion: string | null;
  area: ProgramaArea;
  cupoMaximo: number;
}

const OPERACION = 'academic:program:create';

@Injectable()
export class ProgramService {
  constructor(
    @Inject(ProgramRepository) private readonly repository: ProgramRepository,
    @Inject(AcademicUnitOfWork) private readonly unitOfWork: AcademicUnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
  ) {}

  async list(page: PageInput): Promise<PageResult<ProgramaView>> {
    const result = await this.repository.list(page);
    return { ...result, data: result.data.map(toView) };
  }

  async create(
    input: CreateProgramaInput,
    actor: ActorContext,
    idempotencyKey: string | null,
  ): Promise<ProgramaView> {
    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: OPERACION,
        clave: idempotencyKey,
        cuerpo: input,
      },
      async () => {
        const record = await this.unitOfWork.run(async (tx) => {
          const created = await tx.programs.create({
            id: uuidv7(),
            nombre: input.nombre.trim(),
            descripcion: input.descripcion?.trim() || null,
            area: input.area,
            cupoMaximo: input.cupoMaximo,
          });

          await tx.audit.record({
            accion: 'programa.creado',
            recurso: 'programa',
            recursoId: created.id,
            actorId: actor.userId,
            actorPerfil: actor.actorProfile,
            ip: actor.ip,
            dispositivo: actor.userAgent,
            datosDespues: { area: created.area, estado: created.estado },
            requestId: actor.requestId,
          });

          return created;
        });

        return toView(record);
      },
    );
  }

  async transition(id: string, to: ProgramaEstado, actor: ActorContext): Promise<ProgramaView> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw AcademicError.notFound('Programa');
    }

    if (current.estado === to) {
      return toView(current);
    }

    if (!canTransitionPrograma(current.estado, to)) {
      throw AcademicError.invalidTransition(current.estado, to);
    }

    const updated = await this.unitOfWork.run(async (tx) => {
      const record = await tx.programs.updateState(id, to);
      await tx.audit.record({
        accion: to === 'publicado' ? 'programa.publicado' : 'programa.archivado',
        recurso: 'programa',
        recursoId: id,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: actor.ip,
        dispositivo: actor.userAgent,
        datosAntes: { estado: current.estado },
        datosDespues: { estado: to },
        requestId: actor.requestId,
      });
      return record;
    });

    return toView(updated);
  }
}

export function toView(record: {
  id: string;
  nombre: string;
  descripcion: string | null;
  area: ProgramaArea;
  cupoMaximo: number;
  estado: ProgramaEstado;
  creadoEn: Date;
}): ProgramaView {
  return {
    id: record.id,
    nombre: record.nombre,
    descripcion: record.descripcion,
    area: record.area,
    cupoMaximo: record.cupoMaximo,
    estado: record.estado,
    creadoEn: record.creadoEn.toISOString(),
  };
}
