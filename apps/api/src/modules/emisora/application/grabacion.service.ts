import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  FILE_DIRECTORY,
  type FileDirectory,
} from '../../../shared/integration/file-directory.port.js';
import {
  FILE_UPLOADER,
  type ArchivoSubido,
  type FileUploader,
} from '../../../shared/integration/file-uploader.port.js';
import {
  IDENTITY_DIRECTORY,
  type IdentityDirectory,
} from '../../../shared/integration/identity-directory.port.js';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import {
  ASISTENCIA_ESTADOS,
  AUDIO_TIPOS,
  canTransicionarGrabacion,
  type AsistenciaEstado,
  type AudioTipo,
  type GrabacionEstado,
} from '../domain/emisora-states.js';
import { esFechaValida } from '../domain/emisora-rules.js';
import { EmisoraError } from './emisora-error.js';
import type { ActorContext, AsistenciaView, AudioView, GrabacionView } from './emisora.types.js';
import { runIdempotentCreate } from './idempotent-create.js';
import { registrarEvento } from './registrar-evento.js';
import { EMISORA_REPOSITORY, type EmisoraRepository } from './ports/emisora.repository.js';
import { EmisoraUnitOfWork } from './ports/unit-of-work.js';

export interface CreateGrabacionInput {
  programacionItemId: string | null;
  fecha: string;
  responsableId: string | null;
}

export interface RegistrarAsistenciaInput {
  entries: readonly { usuarioId: string; estado: AsistenciaEstado }[];
}

export interface SubirAudioInput {
  sesionGrabacionId: string;
  tipo: AudioTipo;
  duracionSegundos: number;
  fecha: string;
  archivo: {
    buffer: Buffer;
    nombreOriginal: string;
    mime: string;
  };
  request: {
    ip: string | null;
    userAgent: string | null;
    requestId: string | null;
  };
}

/** RF-02: grabación, asistencia a cabina y archivo de audio con metadatos. */
@Injectable()
export class GrabacionService {
  constructor(
    @Inject(EMISORA_REPOSITORY) private readonly repository: EmisoraRepository,
    @Inject(EmisoraUnitOfWork) private readonly unitOfWork: EmisoraUnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    @Inject(IDENTITY_DIRECTORY) private readonly identity: IdentityDirectory,
    @Inject(FILE_DIRECTORY) private readonly files: FileDirectory,
    @Inject(FILE_UPLOADER) private readonly uploader: FileUploader,
  ) {}

  async create(
    input: CreateGrabacionInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<GrabacionView> {
    if (!esFechaValida(input.fecha)) {
      throw EmisoraError.invalidInput('La fecha de la grabación no es válida.');
    }
    if (input.responsableId) {
      const usuario = await this.identity.findById(input.responsableId);
      if (!usuario || usuario.estado !== 'activo') {
        throw EmisoraError.invalidInput('El responsable no existe o no está activo.');
      }
    }
    if (input.programacionItemId) {
      const item = await this.repository.findProgramacionItemById(input.programacionItemId);
      if (!item) {
        throw EmisoraError.notFound('Franja de programación');
      }
      if (item.fecha !== input.fecha) {
        throw EmisoraError.invalidInput('La fecha debe coincidir con la franja programada.');
      }
    }

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:grabacion:create',
        clave,
        cuerpo: input,
      },
      async () => {
        const created = await this.unitOfWork.run(async (tx) => {
          const grabacion = await tx.emisora.createGrabacion({
            id: uuidv7(),
            programacionItemId: input.programacionItemId,
            fecha: input.fecha,
            responsableId: input.responsableId ?? actor.userId,
          });
          await registrarEvento(tx, {
            accion: 'grabacion.programada',
            recurso: 'sesion_grabacion',
            recursoId: grabacion.id,
            actor,
            datosDespues: {
              fecha: grabacion.fecha,
              programacionItemId: grabacion.programacionItemId,
              responsableId: grabacion.responsableId,
            },
            eventos: [
              {
                tipo: 'grabacion.programada',
                payload: {
                  grabacionId: grabacion.id,
                  fecha: grabacion.fecha,
                  programacionItemId: grabacion.programacionItemId,
                },
              },
            ],
          });
          return grabacion;
        });
        return this.toView(created.id);
      },
    );
  }

  async transition(id: string, to: GrabacionEstado, actor: ActorContext): Promise<GrabacionView> {
    const grabacion = await this.repository.findGrabacionById(id);
    if (!grabacion) {
      throw EmisoraError.notFound('Sesión de grabación');
    }
    if (!canTransicionarGrabacion(grabacion.estado, to)) {
      throw EmisoraError.invalidTransition(grabacion.estado, to);
    }

    await this.unitOfWork.run(async (tx) => {
      const row = await tx.emisora.updateGrabacionEstado(id, to, actor.userId);
      await registrarEvento(tx, {
        accion: 'grabacion.aprobada',
        recurso: 'sesion_grabacion',
        recursoId: id,
        actor,
        datosAntes: { estado: grabacion.estado },
        datosDespues: { estado: row.estado, aprobadaPor: row.aprobadaPor },
        eventos:
          to === 'aprobada'
            ? [
                {
                  tipo: 'grabacion.aprobada',
                  payload: { grabacionId: id, fecha: row.fecha },
                },
              ]
            : [],
      });
    });
    return this.toView(id);
  }

  async registrarAsistencia(
    id: string,
    input: RegistrarAsistenciaInput,
    actor: ActorContext,
  ): Promise<readonly AsistenciaView[]> {
    const grabacion = await this.repository.findGrabacionById(id);
    if (!grabacion) {
      throw EmisoraError.notFound('Sesión de grabación');
    }
    if (input.entries.length === 0 || input.entries.length > 50) {
      throw EmisoraError.invalidInput('La asistencia debe tener entre 1 y 50 participantes.');
    }
    if (!input.entries.every((entry) => ASISTENCIA_ESTADOS.includes(entry.estado))) {
      throw EmisoraError.invalidInput('Estado de asistencia no reconocido.');
    }
    for (const entry of input.entries) {
      const usuario = await this.identity.findById(entry.usuarioId);
      if (!usuario || usuario.estado !== 'activo') {
        throw EmisoraError.invalidInput(`Participante ${entry.usuarioId} no encontrado.`);
      }
    }

    const registradas = await this.unitOfWork.run(async (tx) => {
      const rows = await tx.emisora.replaceAsistencia(
        id,
        input.entries.map((entry) => ({
          usuarioId: entry.usuarioId,
          estado: entry.estado,
        })),
      );
      await registrarEvento(tx, {
        accion: 'asistencia.registrada',
        recurso: 'asistencia_cabina',
        recursoId: id,
        actor,
        datosDespues: {
          participantes: rows.length,
          presentes: rows.filter((row) => row.estado === 'presente').length,
        },
        eventos: [
          {
            tipo: 'asistencia.registrada',
            payload: { grabacionId: id, participantes: rows.length },
            usuarioIds: rows.map((row) => row.usuarioId),
          },
        ],
      });
      return rows;
    });

    return registradas.map((row) => ({
      sesionId: row.sesionId,
      usuarioId: row.usuarioId,
      estado: row.estado,
      registradoEn: row.registradoEn.toISOString(),
    }));
  }

  async subirAudio(
    input: SubirAudioInput,
    actor: ActorContext,
    clave: string | null,
  ): Promise<AudioView> {
    const grabacion = await this.repository.findGrabacionById(input.sesionGrabacionId);
    if (!grabacion) {
      throw EmisoraError.notFound('Sesión de grabación');
    }
    if (!esFechaValida(input.fecha) || input.fecha !== grabacion.fecha) {
      throw EmisoraError.invalidInput('La fecha del audio debe coincidir con la grabación.');
    }
    if (!AUDIO_TIPOS.includes(input.tipo)) {
      throw EmisoraError.invalidInput('Tipo de audio no reconocido.');
    }
    if (!Number.isInteger(input.duracionSegundos) || input.duracionSegundos <= 0) {
      throw EmisoraError.invalidInput('La duración debe ser un número entero de segundos.');
    }

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: 'emisora:audio:create',
        clave,
        cuerpo: {
          sesionGrabacionId: input.sesionGrabacionId,
          tipo: input.tipo,
          duracionSegundos: input.duracionSegundos,
          fecha: input.fecha,
          nombreOriginal: input.archivo.nombreOriginal,
          mime: input.archivo.mime,
          tamano: input.archivo.buffer.length,
        },
      },
      async () => {
        // La política es opt-in: el flujo histórico de `/files` no cambia.
        const archivo: ArchivoSubido = await this.uploader.upload({
          archivo: input.archivo,
          politica: 'emisora-audio',
          idempotencyKey: clave,
          actor: {
            userId: actor.userId,
            actorProfile: actor.actorProfile,
            permissions: [...actor.permissions],
          },
          context: input.request,
        });

        const created = await this.unitOfWork.run(async (tx) => {
          const audio = await tx.emisora.createAudio({
            id: uuidv7(),
            sesionGrabacionId: grabacion.id,
            tipo: input.tipo,
            duracionSegundos: input.duracionSegundos,
            fecha: input.fecha,
            responsableId: actor.userId,
            archivoId: archivo.id,
            hashSha256: archivo.hashSha256,
          });
          await registrarEvento(tx, {
            accion: 'audio.archivado',
            recurso: 'audio',
            recursoId: audio.id,
            actor,
            datosDespues: {
              sesionGrabacionId: audio.sesionGrabacionId,
              tipo: audio.tipo,
              archivoId: audio.archivoId,
              duracionSegundos: audio.duracionSegundos,
              hashSha256: audio.hashSha256,
            },
            eventos: [
              {
                tipo: 'audio.archivado',
                payload: {
                  audioId: audio.id,
                  grabacionId: audio.sesionGrabacionId,
                  archivoId: audio.archivoId,
                  hashSha256: audio.hashSha256,
                },
              },
            ],
          });
          return audio;
        });
        return this.toViewAudio(created.id);
      },
    );
  }

  async listGrabaciones(): Promise<readonly GrabacionView[]> {
    const rows = await this.repository.listGrabaciones();
    return Promise.all(rows.map((row) => this.toView(row.id)));
  }

  async listAudio(sesionId: string | null): Promise<readonly AudioView[]> {
    const rows = await this.repository.listAudio(sesionId);
    return Promise.all(rows.map((row) => this.toViewAudio(row.id)));
  }

  private async toView(id: string): Promise<GrabacionView> {
    const row = await this.repository.findGrabacionById(id);
    if (!row) {
      throw EmisoraError.notFound('Sesión de grabación');
    }
    return {
      id: row.id,
      programacionItemId: row.programacionItemId,
      fecha: row.fecha,
      estado: row.estado,
      responsableId: row.responsableId,
    };
  }

  private async toViewAudio(id: string): Promise<AudioView> {
    const row = await this.repository.findAudioById(id);
    if (!row) {
      throw EmisoraError.notFound('Audio');
    }
    const archivo = await this.files.findById(row.archivoId);
    if (!archivo || archivo.estadoEscaneo !== 'limpio') {
      throw EmisoraError.notFound('Archivo de audio');
    }
    return {
      id: row.id,
      sesionGrabacionId: row.sesionGrabacionId,
      tipo: row.tipo,
      duracionSegundos: row.duracionSegundos,
      fecha: row.fecha,
      archivoId: row.archivoId,
      hashSha256: row.hashSha256,
      archivo: {
        nombreOriginal: archivo.nombreOriginal,
        mime: archivo.mime,
        tamano: archivo.tamano,
        estadoEscaneo: archivo.estadoEscaneo,
      },
    };
  }
}
