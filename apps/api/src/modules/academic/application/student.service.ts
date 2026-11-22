import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { AUDIT_PORT, type AuditPort } from '../../../shared/audit/audit.port.js';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../shared/idempotency/idempotency.port.js';
import { AcademicError } from './academic-error.js';
import type {
  ActorContext,
  ConsentimientoDatos,
  EstudianteRecord,
  PageInput,
  PageResult,
} from './academic.types.js';
import type { EstudianteDetailView, EstudianteSummaryView } from './academic.views.js';
import { runIdempotentCreate } from './idempotent-create.js';
import { PiiCipher } from './ports/pii-cipher.js';
import { StudentRepository } from './ports/student.repository.js';
import { AcademicUnitOfWork } from './ports/unit-of-work.js';

export interface CreateEstudianteInput {
  usuarioId: string | null;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string | null;
  municipio: string | null;
  barrio: string | null;
  direccion: string | null;
  telefono: string | null;
  consentimientoDatos: ConsentimientoDatos;
}

export interface UpdateEstudianteInput {
  usuarioId?: string | null;
  tipoDocumento?: string;
  numeroDocumento?: string;
  nombres?: string;
  apellidos?: string;
  fechaNacimiento?: string | null;
  municipio?: string | null;
  barrio?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  consentimientoDatos?: ConsentimientoDatos;
}

const OPERACION = 'academic:student:create';

@Injectable()
export class StudentService {
  constructor(
    @Inject(StudentRepository) private readonly repository: StudentRepository,
    @Inject(AcademicUnitOfWork) private readonly unitOfWork: AcademicUnitOfWork,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    @Inject(PiiCipher) private readonly pii: PiiCipher,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  async list(page: PageInput, actor: ActorContext): Promise<PageResult<EstudianteSummaryView>> {
    const result = await this.repository.list(page);

    // AC-AUD-04: el listado de estudiantes se audita antes de responder.
    await this.audit.record({
      accion: 'estudiante.listado',
      recurso: 'estudiante',
      recursoId: null,
      actorId: actor.userId,
      actorPerfil: actor.actorProfile,
      ip: actor.ip,
      dispositivo: actor.userAgent,
      datosDespues: { page: page.page, pageSize: page.pageSize, resultados: result.total },
      requestId: actor.requestId,
    });

    return { ...result, data: result.data.map(toSummary) };
  }

  async create(
    input: CreateEstudianteInput,
    actor: ActorContext,
    idempotencyKey: string | null,
  ): Promise<EstudianteDetailView> {
    assertConsent(input.consentimientoDatos);

    return runIdempotentCreate(
      {
        store: this.idempotency,
        usuarioId: actor.userId,
        operacion: OPERACION,
        clave: idempotencyKey,
        cuerpo: input,
      },
      async () => {
        const id = uuidv7();
        const hash = this.pii.documentHash(input.tipoDocumento, input.numeroDocumento);
        const existing = await this.repository.findByDocumentHash(hash);
        if (existing) {
          throw AcademicError.studentDuplicate();
        }

        const record = await this.unitOfWork.run(async (tx) => {
          const created = await tx.students.create({
            id,
            usuarioId: input.usuarioId,
            tipoDocumento: input.tipoDocumento.trim(),
            numeroDocumentoCifrado: this.pii.encrypt(id, 'numero_documento', input.numeroDocumento),
            numeroDocumentoHash: hash,
            nombres: input.nombres.trim(),
            apellidos: input.apellidos.trim(),
            fechaNacimiento: parseDateOnly(input.fechaNacimiento),
            municipio: input.municipio?.trim() || null,
            barrio: input.barrio?.trim() || null,
            direccionCifrada: input.direccion
              ? this.pii.encrypt(id, 'direccion', input.direccion)
              : null,
            telefonoCifrado: input.telefono
              ? this.pii.encrypt(id, 'telefono', input.telefono)
              : null,
            acudiente: null,
            consentimientoDatos: input.consentimientoDatos,
          });

          await tx.audit.record({
            accion: 'estudiante.creado',
            recurso: 'estudiante',
            recursoId: created.id,
            actorId: actor.userId,
            actorPerfil: actor.actorProfile,
            ip: actor.ip,
            dispositivo: actor.userAgent,
            // Regla §4: iniciales y banderas, nunca documento ni contacto.
            datosDespues: {
              nombres_iniciales: initials(created.nombres),
              apellidos_iniciales: initials(created.apellidos),
              documento_cargado: true,
              consentimiento: true,
            },
            requestId: actor.requestId,
          });

          return created;
        });

        return this.toDetail(record);
      },
    );
  }

  async update(
    id: string,
    input: UpdateEstudianteInput,
    actor: ActorContext,
  ): Promise<EstudianteDetailView> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw AcademicError.notFound('Estudiante');
    }

    if (input.consentimientoDatos) {
      assertConsent(input.consentimientoDatos);
    }

    const tipoDocumento = input.tipoDocumento?.trim() ?? current.tipoDocumento;
    const numeroDocumentoClaro = input.numeroDocumento;

    let numeroDocumentoCifrado = current.numeroDocumentoCifrado;
    let numeroDocumentoHash = current.numeroDocumentoHash;

    if (numeroDocumentoClaro !== undefined) {
      numeroDocumentoHash = this.pii.documentHash(tipoDocumento, numeroDocumentoClaro);
      const duplicate = await this.repository.findByDocumentHash(numeroDocumentoHash);
      if (duplicate && duplicate.id !== id) {
        throw AcademicError.studentDuplicate();
      }
      numeroDocumentoCifrado = this.pii.encrypt(id, 'numero_documento', numeroDocumentoClaro);
    }

    const direccionCifrada =
      input.direccion === undefined
        ? current.direccionCifrada
        : input.direccion
          ? this.pii.encrypt(id, 'direccion', input.direccion)
          : null;

    const telefonoCifrado =
      input.telefono === undefined
        ? current.telefonoCifrado
        : input.telefono
          ? this.pii.encrypt(id, 'telefono', input.telefono)
          : null;

    const updated = await this.unitOfWork.run(async (tx) => {
      const record = await tx.students.update(id, {
        usuarioId: input.usuarioId === undefined ? current.usuarioId : input.usuarioId,
        tipoDocumento,
        numeroDocumentoCifrado,
        numeroDocumentoHash,
        nombres: input.nombres?.trim() ?? current.nombres,
        apellidos: input.apellidos?.trim() ?? current.apellidos,
        fechaNacimiento:
          input.fechaNacimiento === undefined
            ? current.fechaNacimiento
            : parseDateOnly(input.fechaNacimiento),
        municipio: input.municipio === undefined ? current.municipio : input.municipio,
        barrio: input.barrio === undefined ? current.barrio : input.barrio,
        direccionCifrada,
        telefonoCifrado,
        acudiente: current.acudiente,
        consentimientoDatos: input.consentimientoDatos ?? current.consentimientoDatos,
      });

      await tx.audit.record({
        accion: 'estudiante.actualizado',
        recurso: 'estudiante',
        recursoId: id,
        actorId: actor.userId,
        actorPerfil: actor.actorProfile,
        ip: actor.ip,
        dispositivo: actor.userAgent,
        datosDespues: {
          documento_cambiado: numeroDocumentoClaro !== undefined,
          nombres_cambiado: input.nombres !== undefined,
          apellidos_cambiado: input.apellidos !== undefined,
          contacto_cambiado: input.direccion !== undefined || input.telefono !== undefined,
          consentimiento_cambiado: input.consentimientoDatos !== undefined,
          vinculo_cambiado: input.usuarioId !== undefined,
        },
        requestId: actor.requestId,
      });

      return record;
    });

    return this.toDetail(updated);
  }

  async getMine(actor: ActorContext): Promise<EstudianteDetailView> {
    const record = await this.repository.findByUsuarioId(actor.userId);
    if (!record) {
      // A-01: estudiante sin vínculo responde 404.
      throw AcademicError.notFound('Estudiante');
    }
    return this.toDetail(record);
  }

  private toDetail(record: EstudianteRecord): EstudianteDetailView {
    return {
      ...toSummary(record),
      numeroDocumento: this.pii.decrypt(
        record.id,
        'numero_documento',
        record.numeroDocumentoCifrado,
      ),
      fechaNacimiento: formatDateOnly(record.fechaNacimiento),
      direccion: record.direccionCifrada
        ? this.pii.decrypt(record.id, 'direccion', record.direccionCifrada)
        : null,
      telefono: record.telefonoCifrado
        ? this.pii.decrypt(record.id, 'telefono', record.telefonoCifrado)
        : null,
      consentimientoDatos: record.consentimientoDatos,
      actualizadoEn: record.actualizadoEn.toISOString(),
    };
  }
}

function toSummary(record: EstudianteRecord): EstudianteSummaryView {
  return {
    id: record.id,
    usuarioId: record.usuarioId,
    tipoDocumento: record.tipoDocumento,
    nombres: record.nombres,
    apellidos: record.apellidos,
    municipio: record.municipio,
    barrio: record.barrio,
    consentimientoAceptado: isConsentAccepted(record.consentimientoDatos),
    creadoEn: record.creadoEn.toISOString(),
  };
}

function assertConsent(consent: ConsentimientoDatos): void {
  if (!consent || consent.aceptado !== true || !consent.versionAviso?.trim()) {
    throw AcademicError.consentRequired();
  }
}

function isConsentAccepted(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { aceptado?: unknown }).aceptado === true
  );
}

function initials(value: string): string {
  const first = value.trim().charAt(0);
  return first ? `${first.toUpperCase()}.` : '';
}

const DATE_ONLY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;

function parseDateOnly(value: string | null): Date | null {
  if (value === null) {
    return null;
  }
  if (!DATE_ONLY.test(value)) {
    throw AcademicError.invalidInput('La fecha debe tener el formato YYYY-MM-DD.');
  }
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw AcademicError.invalidInput('La fecha indicada no es válida.');
  }
  return date;
}

function formatDateOnly(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
