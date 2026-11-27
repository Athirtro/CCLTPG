import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  FILE_DIRECTORY,
  type FileDirectory,
} from '../../../shared/integration/file-directory.port.js';
import {
  FORMACION_DIRECTORY,
  type FormacionDirectory,
} from '../../../shared/integration/formacion-directory.port.js';
import {
  IDENTITY_DIRECTORY,
  type IdentityDirectory,
} from '../../../shared/integration/identity-directory.port.js';
import {
  EMISORA_OWNERSHIP_POLICY,
  type EmisoraOwnershipPolicy,
} from '../../../shared/integration/ownership.port.js';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import { EmisoraPii } from './emisora-pii.js';
import {
  canTransicionarIncentivo,
  canTransicionarRejilla,
  type IncentivoEstado,
  type RejillaEstado,
} from '../domain/emisora-states.js';
import { esAperturaAnioValida, esFechaValida, esVentanaInforme } from '../domain/emisora-rules.js';
import { EmisoraError } from './emisora-error.js';
import type {
  ActorContext,
  ConvocatoriaView,
  IncentivoView,
  RejillaView,
} from './emisora.types.js';
import { runIdempotentCreate } from './idempotent-create.js';
import { registrarEvento } from './registrar-evento.js';
import { EMISORA_REPOSITORY, type EmisoraRepository } from './ports/emisora.repository.js';
import { EmisoraUnitOfWork } from './ports/unit-of-work.js';

export interface CreateConvocatoriaInput {
  anio: number;
  fechaApertura: string;
  basesArchivoId: string | null;
}

export interface CreateProyectoInput {
  convocatoriaId: string;
  titulo: string;
  archivoId: string;
  fechaRecepcion: string;
  observaciones: string | null;
  programaId: string | null;
  formadorId: string | null;
  realizador: {
    usuarioId: string | null;
    nombres: string;
    apellidos: string;
    tipoDocumento: string;
    numeroDocumento: string;
    contacto: string | null;
    municipio: string | null;
    fechaNacimiento: string | null;
    consentimientoAceptado: boolean;
  };
}

export interface NotifyRealizadorInput {
  contacto: string | null;
  municipio: string | null;
}

export interface CreateComiteInput {
  convocatoriaId: string;
  fecha: string;
  actaArchivoId: string;
  integrantes: readonly string[];
  conclusiones: string | null;
}

export interface CreateInformeInput {
  proyectoId: string;
  fechaInforme: string;
  archivoId: string;
  observaciones: string | null;
}

export interface UpdateIncentivoInput {
  to: IncentivoEstado;
  calificacion: number | null;
  referenciaCdp: string | null;
}

/**
 * RF-03: convocatoria, participación, comité, rejilla, informes e incentivos.
 * Todas las escrituras son transaccionales, auditorizadas e idempotentes cuando
 * crean un agregado con efecto secundario (plan §6.5).
 */
@Injectable()
export class ConvocatoriaService {
  constructor(
    @Inject(EMISORA_REPOSITORY) private readonly repository: EmisoraRepository,
    @Inject(EmisoraUnitOfWork) private readonly unitOfWork: EmisoraUnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    @Inject(IDENTITY_DIRECTORY) private readonly identity: IdentityDirectory,
    @Inject(FORMACION_DIRECTORY) private readonly formacion: FormacionDirectory,
    @Inject(EMISORA_OWNERSHIP_POLICY) private readonly ownership: EmisoraOwnershipPolicy,
    @Inject(FILE_DIRECTORY) private readonly files: FileDirectory,
    private readonly pii: EmisoraPii,
  ) {}

  async listConvocatorias(): Promise<readonly ConvocatoriaView[]> {
    const rows = await this.repository.listConvocatorias();
    return rows.map((row) => ({
      id: row.id,
      anio: row.anio,
      fechaApertura: row.fechaApertura,
      fechaCierre: row.fechaCierre,
      estado: row.estado,
    }));
  }

  async createConvocatoria(
    input: CreateConvocatoriaInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<ConvocatoriaView> {
    if (!Number.isInteger(input.anio) || input.anio < 2000 || input.anio > 2100) {
      throw EmisoraError.invalidInput('El año de la convocatoria debe estar entre 2000 y 2100.');
    }
    if (!esAperturaAnioValida(input.fechaApertura, input.anio)) {
      throw EmisoraError.invalidInput('La convocatoria debe abrirse en enero del año indicado.');
    }
    if (input.basesArchivoId) {
      await this.validarArchivo(input.basesArchivoId, 'Bases de la convocatoria');
    }
    // RF-03.1: cierre derivado, nunca recibido del cliente, para garantizar 21 días.
    const fechaCierre = sumar21(input.fechaApertura);

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:convocatoria:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const existing = await this.repository.findConvocatoriaByAnio(input.anio);
        if (existing) {
          throw EmisoraError.conflict(
            'CONVOCATORIA_DUPLICADA',
            `Ya existe la convocatoria de ${input.anio}.`,
          );
        }

        const view = await this.unitOfWork.run(async (tx) => {
          const created = await tx.emisora.createConvocatoria({
            id: uuidv7(),
            anio: input.anio,
            fechaApertura: input.fechaApertura,
            fechaCierre,
            basesArchivoId: input.basesArchivoId,
          });

          await registrarEvento(tx, {
            accion: 'convocatoria.abierta',
            recurso: 'convocatoria',
            recursoId: created.id,
            actor,
            datosDespues: {
              anio: created.anio,
              fechaApertura: created.fechaApertura,
              fechaCierre: created.fechaCierre,
            },
            eventos: [
              {
                tipo: 'convocatoria.abierta',
                payload: {
                  convocatoriaId: created.id,
                  anio: created.anio,
                  fechaCierre: created.fechaCierre,
                },
              },
            ],
          });
          return created;
        });

        return toConvocatoriaView(view);
      },
    );
  }

  async createProyecto(
    input: CreateProyectoInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<{ id: string; titulo: string; estado: string; realizadorId: string }> {
    if (!esFechaValida(input.fechaRecepcion)) {
      throw EmisoraError.invalidInput('La fecha de recepción no es válida.');
    }
    await this.validarArchivo(input.archivoId, 'Formato oficial del proyecto');
    if (!input.realizador.consentimientoAceptado) {
      throw EmisoraError.invalidInput('El consentimiento de datos es obligatorio.');
    }
    if (!input.realizador.nombres.trim() || !input.realizador.apellidos.trim()) {
      throw EmisoraError.invalidInput('Los nombres y apellidos del realizador son obligatorios.');
    }

    if (input.realizador.usuarioId) {
      const usuario = await this.identity.findById(input.realizador.usuarioId);
      if (!usuario || usuario.estado !== 'activo') {
        throw EmisoraError.invalidInput('El usuario del realizador no existe o no está activo.');
      }
    }
    if (input.programaId) {
      const programas = await this.formacion.listProgramas();
      if (!programas.some((programa) => programa.id === input.programaId)) {
        throw EmisoraError.invalidInput('El programa de formación no existe.');
      }
      if (input.formadorId) {
        const formadores = await this.formacion.listFormadores(input.programaId);
        if (!formadores.some((formador) => formador.id === input.formadorId)) {
          throw EmisoraError.invalidInput('El formador no imparte el programa indicado.');
        }
      }
    } else if (input.formadorId) {
      throw EmisoraError.invalidInput('El formador exige un programa de formación.');
    }

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:proyecto:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const created = await this.unitOfWork.run(async (tx) => {
          const convocatoria = await tx.emisora.findConvocatoriaById(input.convocatoriaId);
          if (!convocatoria || convocatoria.estado !== 'abierta') {
            throw EmisoraError.conflict(
              'CONVOCATORIA_CERRADA',
              'Los proyectos solo se reciben en convocatoria abierta.',
            );
          }
          if (
            input.fechaRecepcion < convocatoria.fechaApertura ||
            input.fechaRecepcion > convocatoria.fechaCierre
          ) {
            throw EmisoraError.invalidInput(
              'La recepción queda fuera del plazo de la convocatoria.',
            );
          }

          const realizadorId = uuidv7();
          const pii = this.pii.cifrarRealizador(
            realizadorId,
            input.realizador.tipoDocumento,
            input.realizador.numeroDocumento,
            input.realizador.contacto,
          );
          const realizador = await tx.emisora.createRealizador({
            id: realizadorId,
            usuarioId: input.realizador.usuarioId ?? actor.userId,
            nombres: input.realizador.nombres.trim(),
            apellidos: input.realizador.apellidos.trim(),
            tipoDocumento: input.realizador.tipoDocumento,
            numeroDocumentoCifrado: pii.numeroDocumentoCifrado,
            numeroDocumentoHash: pii.numeroDocumentoHash,
            contactoCifrado: pii.contactoCifrado,
            municipio: input.realizador.municipio,
            fechaNacimiento: input.realizador.fechaNacimiento,
            consentimientoDatos: { aceptado: true, fecha: new Date().toISOString() },
          });

          const proyecto = await tx.emisora.createProyecto({
            id: uuidv7(),
            convocatoriaId: convocatoria.id,
            realizadorId: realizador.id,
            titulo: input.titulo.trim(),
            archivoId: input.archivoId,
            fechaRecepcion: input.fechaRecepcion,
            observaciones: input.observaciones,
            programaId: input.programaId,
            formadorId: input.formadorId,
          });

          await registrarEvento(tx, {
            accion: 'proyecto.recibido',
            recurso: 'proyecto_programa',
            recursoId: proyecto.id,
            actor,
            datosDespues: {
              convocatoriaId: proyecto.convocatoriaId,
              titulo: proyecto.titulo,
              estado: proyecto.estado,
            },
            eventos: [
              {
                tipo: 'proyecto.recibido',
                payload: {
                  proyectoId: proyecto.id,
                  convocatoriaId: proyecto.convocatoriaId,
                  realizadorId: realizador.id,
                },
              },
            ],
          });
          return proyecto;
        });

        return {
          id: created.id,
          titulo: created.titulo,
          estado: created.estado,
          realizadorId: created.realizadorId,
        };
      },
    );
  }

  async notifyRealizador(
    id: string,
    input: NotifyRealizadorInput,
    actor: ActorContext,
  ): Promise<{ id: string; municipio: string | null }> {
    const realizador = await this.repository.findRealizadorById(id);
    if (!realizador) {
      throw EmisoraError.notFound('Realizador');
    }
    if (!(await this.ownership.isOwner(actor.userId, realizador.usuarioId))) {
      throw EmisoraError.notFound('Realizador');
    }

    const actualizado = await this.unitOfWork.run(async (tx) => {
      const row = await tx.emisora.updateRealizadorContacto(
        id,
        this.pii.cifrarContacto(id, input.contacto),
        input.municipio,
      );
      await registrarEvento(tx, {
        accion: 'realizador.notificado',
        recurso: 'realizador',
        recursoId: id,
        actor,
        datosAntes: { municipio: realizador.municipio },
        datosDespues: { municipio: row.municipio },
        eventos: [
          {
            tipo: 'realizador.notificado',
            payload: { realizadorId: id },
            ...(row.usuarioId ? { usuarioIds: [row.usuarioId] } : {}),
          },
        ],
      });
      return row;
    });

    return { id: actualizado.id, municipio: actualizado.municipio };
  }

  async createComite(
    input: CreateComiteInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<{ id: string; convocatoriaId: string; fecha: string; actaArchivoId: string }> {
    if (!esFechaValida(input.fecha)) {
      throw EmisoraError.invalidInput('La fecha del comité no es válida.');
    }
    await this.validarArchivo(input.actaArchivoId, 'Acta del comité');
    if (input.integrantes.length === 0) {
      throw EmisoraError.invalidInput('El comité debe tener al menos un integrante.');
    }

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:comite:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const created = await this.unitOfWork.run(async (tx) => {
          const convocatoria = await tx.emisora.findConvocatoriaById(input.convocatoriaId);
          if (!convocatoria) {
            throw EmisoraError.notFound('Convocatoria');
          }
          const comite = await tx.emisora.createComite({
            id: uuidv7(),
            convocatoriaId: convocatoria.id,
            fecha: input.fecha,
            actaArchivoId: input.actaArchivoId,
            integrantes: input.integrantes,
            conclusiones: input.conclusiones,
          });
          await registrarEvento(tx, {
            accion: 'comite.registrado',
            recurso: 'comite',
            recursoId: comite.id,
            actor,
            datosDespues: {
              convocatoriaId: comite.convocatoriaId,
              fecha: comite.fecha,
              integrantes: comite.integrantes.length,
            },
            eventos: [
              {
                tipo: 'comite.registrado',
                payload: {
                  comiteId: comite.id,
                  convocatoriaId: comite.convocatoriaId,
                  actaArchivoId: comite.actaArchivoId,
                },
              },
            ],
          });
          // RF-03.3: el acta del comité queda vinculada a la rejilla del año de
          // la convocatoria; sin ese vínculo la aprobación no puede verificarla.
          const rejilla = await tx.emisora.findRejillaByAnio(convocatoria.anio);
          if (rejilla) {
            await tx.emisora.vincularComiteRejilla(rejilla.id, comite.id);
          }
          return comite;
        });
        return {
          id: created.id,
          convocatoriaId: created.convocatoriaId,
          fecha: created.fecha,
          actaArchivoId: created.actaArchivoId ?? '',
        };
      },
    );
  }

  async transitionRejilla(
    id: string,
    to: RejillaEstado,
    actor: ActorContext,
  ): Promise<{ id: string; estado: RejillaEstado }> {
    const rejilla = await this.repository.findRejillaById(id);
    if (!rejilla) {
      throw EmisoraError.notFound('Rejilla anual');
    }
    if (!canTransicionarRejilla(rejilla.estado, to)) {
      throw EmisoraError.invalidTransition(rejilla.estado, to);
    }

    const actualizada = await this.unitOfWork.run(async (tx) => {
      const comite = rejilla.comiteId ? await tx.emisora.findComiteById(rejilla.comiteId) : null;
      if (!comite?.actaArchivoId) {
        throw EmisoraError.conflict(
          'REJILLA_SIN_ACTA',
          'La rejilla solo se aprueba con acta de comité adjunta.',
        );
      }
      const row = await tx.emisora.updateRejillaEstado(id, comite.id, new Date());
      await registrarEvento(tx, {
        accion: 'rejilla.aprobada',
        recurso: 'rejilla_anual',
        recursoId: id,
        actor,
        datosAntes: { estado: rejilla.estado },
        datosDespues: { estado: row.estado, comiteId: comite.id },
        eventos: [
          {
            tipo: 'rejilla.aprobada',
            payload: { rejillaAnualId: id, anio: row.anio, comiteId: comite.id },
          },
        ],
      });
      return row;
    });

    return { id: actualizada.id, estado: actualizada.estado };
  }

  async getRejillaAnio(anio: number): Promise<RejillaView | null> {
    const rejilla = await this.repository.findRejillaByAnio(anio);
    if (!rejilla) {
      return null;
    }
    const items = await this.repository.listRejillaItems(rejilla.id);
    return {
      id: rejilla.id,
      anio: rejilla.anio,
      estado: rejilla.estado,
      aprobadaEn: rejilla.aprobadaEn?.toISOString() ?? null,
      items: [...items],
    };
  }

  async createInforme(
    input: CreateInformeInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<{ id: string; proyectoId: string; estado: string }> {
    await this.validarArchivo(input.archivoId, 'Informe del realizador');
    if (!esVentanaInforme(input.fechaInforme)) {
      throw EmisoraError.invalidInput('El informe debe fecharse en octubre o noviembre.');
    }

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:informe:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const created = await this.unitOfWork.run(async (tx) => {
          const proyecto = await tx.emisora.findProyectoById(input.proyectoId);
          if (!proyecto) {
            throw EmisoraError.notFound('Proyecto');
          }
          const informe = await tx.emisora.createInforme({
            id: uuidv7(),
            proyectoId: proyecto.id,
            realizadorId: proyecto.realizadorId,
            fechaInforme: input.fechaInforme,
            archivoId: input.archivoId,
            observaciones: input.observaciones,
          });
          const rejilla = await tx.emisora.findRejillaByAnio(new Date().getUTCFullYear());
          await tx.emisora.createIncentivo({
            id: uuidv7(),
            informeId: informe.id,
            comiteId: rejilla?.comiteId ?? null,
            realizadorId: informe.realizadorId,
          });
          await registrarEvento(tx, {
            accion: 'informe.recibido',
            recurso: 'informe_realizador',
            recursoId: informe.id,
            actor,
            datosDespues: {
              proyectoId: informe.proyectoId,
              fechaInforme: informe.fechaInforme,
              estado: informe.estado,
            },
            eventos: [
              {
                tipo: 'informe.recibido',
                payload: { informeId: informe.id, proyectoId: informe.proyectoId },
                usuarioIds: [informe.realizadorId],
              },
            ],
          });
          return informe;
        });
        return { id: created.id, proyectoId: created.proyectoId, estado: created.estado };
      },
    );
  }

  async listIncentivos(): Promise<readonly IncentivoView[]> {
    const rows = await this.repository.listIncentivos();
    return rows.map((row) => ({
      id: row.id,
      informeId: row.informeId,
      realizadorId: row.realizadorId,
      estado: row.estado,
      calificacion: row.calificacion,
      referenciaCdp: row.referenciaCdp,
    }));
  }

  async updateIncentivo(
    id: string,
    input: UpdateIncentivoInput,
    actor: ActorContext,
  ): Promise<IncentivoView> {
    const incentivo = await this.repository.findIncentivoById(id);
    if (!incentivo) {
      throw EmisoraError.notFound('Incentivo');
    }
    if (!canTransicionarIncentivo(incentivo.estado, input.to)) {
      throw EmisoraError.invalidTransition(incentivo.estado, input.to);
    }
    if (
      (input.to === 'asignado' || input.to === 'resuelto') &&
      (input.calificacion === null || input.calificacion < 0 || input.calificacion > 100)
    ) {
      throw EmisoraError.invalidInput('La calificación debe estar entre 0 y 100.');
    }
    if (input.to === 'resuelto' && !input.referenciaCdp?.trim()) {
      throw EmisoraError.invalidInput('La resolución exige referencia de CDP.');
    }

    const actualizado = await this.unitOfWork.run(async (tx) => {
      const row = await tx.emisora.updateIncentivo(
        id,
        input.to,
        input.calificacion,
        input.referenciaCdp?.trim() || null,
      );
      await registrarEvento(tx, {
        accion: 'incentivo.asignado',
        recurso: 'incentivo',
        recursoId: id,
        actor,
        datosAntes: {
          estado: incentivo.estado,
          calificacion: incentivo.calificacion,
        },
        datosDespues: {
          estado: row.estado,
          calificacion: row.calificacion,
          tieneReferenciaCdp: Boolean(row.referenciaCdp),
        },
        eventos: [
          {
            tipo: 'incentivo.asignado',
            payload: {
              incentivoId: id,
              informeId: row.informeId,
              realizadorId: row.realizadorId,
              estado: row.estado,
            },
            usuarioIds: [row.realizadorId],
          },
        ],
      });
      return row;
    });

    return {
      id: actualizado.id,
      informeId: actualizado.informeId,
      realizadorId: actualizado.realizadorId,
      estado: actualizado.estado,
      calificacion: actualizado.calificacion,
      referenciaCdp: actualizado.referenciaCdp,
    };
  }

  private async validarArchivo(archivoId: string, etiqueta: string): Promise<void> {
    const archivo = await this.files.findById(archivoId);
    if (!archivo || archivo.estadoEscaneo !== 'limpio' || archivo.mime !== 'application/pdf') {
      throw EmisoraError.invalidInput(`${etiqueta} debe ser un PDF limpio y existente.`);
    }
  }
}

/** Suma 21 días calendario sin zona horaria. */
function sumar21(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + 21));
  return resultado.toISOString().slice(0, 10);
}

function toConvocatoriaView(row: {
  id: string;
  anio: number;
  fechaApertura: string;
  fechaCierre: string;
  estado: ConvocatoriaView['estado'];
}): ConvocatoriaView {
  return {
    id: row.id,
    anio: row.anio,
    fechaApertura: row.fechaApertura,
    fechaCierre: row.fechaCierre,
    estado: row.estado,
  };
}
