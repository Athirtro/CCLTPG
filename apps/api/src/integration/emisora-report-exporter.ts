import { Injectable } from '@nestjs/common';

import { ExportsService } from '../modules/exports/application/exports.service.js';
import {
  type DocumentoGenerado,
  type EmisoraReportExporter,
  type GenerarOficioInput,
  type GenerarPlanillaInput,
  type GenerarReporteObrasInput,
  type GenerarResolucionInput,
} from '../modules/emisora/application/ports/report-exporter.port.js';

/**
 * Adaptador aditivo: emisora solo conoce el puerto; el contexto Exportaciones
 * conserva sus plantillas, su idempotencia y su auditoría de `reporte.generado`.
 * Se registra como proveedor del token en `EmisoraIntegrationModule`.
 */
@Injectable()
export class EmisoraReportExporterAdapter implements EmisoraReportExporter {
  constructor(private readonly exports: ExportsService) {}

  async generarResolucion(input: GenerarResolucionInput): Promise<DocumentoGenerado> {
    const exportacion = await this.exports.create({
      plantilla: 'emisora-resolucion-incentivos',
      formato: 'pdf',
      parametros: {
        periodo: input.periodo,
        filas: input.filas.map((fila) => ({
          realizador: fila.realizador,
          concepto: fila.concepto,
          estado: fila.estado,
        })),
      },
      // Espacio de claves propio: la misma clave del cliente nunca colisiona
      // con una exportación iniciada directamente por el usuario.
      idempotencyKey: `emisora-resolucion:${input.idempotencyKey}`,
      actor: {
        userId: input.actor.userId,
        actorProfile: input.actor.actorProfile,
      },
      context: {
        ip: input.actor.ip,
        userAgent: input.actor.userAgent,
        requestId: input.actor.requestId,
      },
    });

    return {
      archivoId: exportacion.archivoId,
      nombre: exportacion.nombre,
      descargaUrl: exportacion.descargaUrl,
    };
  }

  async generarReporteObras(input: GenerarReporteObrasInput): Promise<DocumentoGenerado> {
    const exportacion = await this.exports.create({
      plantilla: 'emisora-reporte-obras',
      formato: 'pdf',
      parametros: {
        periodo: input.periodo,
        filas: input.filas.map((fila) => ({
          titulo: fila.titulo,
          compositor: fila.compositor,
          duracion: fila.duracion,
        })),
      },
      idempotencyKey: `emisora-reporte-obras:${input.idempotencyKey}`,
      actor: {
        userId: input.actor.userId,
        actorProfile: input.actor.actorProfile,
      },
      context: {
        ip: input.actor.ip,
        userAgent: input.actor.userAgent,
        requestId: input.actor.requestId,
      },
    });
    return this.aDocumento(exportacion);
  }

  async generarOficioSalida(input: GenerarOficioInput): Promise<DocumentoGenerado> {
    const exportacion = await this.exports.create({
      plantilla: 'emisora-oficio-salida',
      formato: 'pdf',
      parametros: {
        periodo: input.referencia,
        filas: [
          {
            destino: input.destino,
            asunto: input.asunto,
            referencia: input.referencia,
          },
        ],
      },
      idempotencyKey: `emisora-oficio-salida:${input.idempotencyKey}`,
      actor: {
        userId: input.actor.userId,
        actorProfile: input.actor.actorProfile,
      },
      context: {
        ip: input.actor.ip,
        userAgent: input.actor.userAgent,
        requestId: input.actor.requestId,
      },
    });
    return this.aDocumento(exportacion);
  }

  async generarPlanilla(input: GenerarPlanillaInput): Promise<DocumentoGenerado> {
    const exportacion = await this.exports.create({
      plantilla: 'emisora-planilla-emision',
      formato: 'pdf',
      parametros: {
        periodo: input.fecha,
        filas: [
          {
            fecha: input.fecha,
            programa: input.programa,
            archivo_id: input.archivoId,
          },
        ],
      },
      idempotencyKey: `emisora-planilla-emision:${input.idempotencyKey}`,
      actor: {
        userId: input.actor.userId,
        actorProfile: input.actor.actorProfile,
      },
      context: {
        ip: input.actor.ip,
        userAgent: input.actor.userAgent,
        requestId: input.actor.requestId,
      },
    });
    return this.aDocumento(exportacion);
  }

  private aDocumento(exportacion: {
    archivoId: string;
    nombre: string;
    descargaUrl: string;
  }): DocumentoGenerado {
    return {
      archivoId: exportacion.archivoId,
      nombre: exportacion.nombre,
      descargaUrl: exportacion.descargaUrl,
    };
  }
}
