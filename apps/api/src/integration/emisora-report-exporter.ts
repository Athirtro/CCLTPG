import { Injectable } from '@nestjs/common';

import { ExportsService } from '../modules/exports/application/exports.service.js';
import {
  type EmisoraReportExporter,
  type GenerarResolucionInput,
  type ResolucionGenerada,
} from '../modules/emisora/application/ports/report-exporter.port.js';

/**
 * Adaptador aditivo: emisora solo conoce el puerto; el contexto Exportaciones
 * conserva sus plantillas, su idempotencia y su auditoría de `reporte.generado`.
 * Se registra como proveedor del token en `EmisoraIntegrationModule`.
 */
@Injectable()
export class EmisoraReportExporterAdapter implements EmisoraReportExporter {
  constructor(private readonly exports: ExportsService) {}

  async generarResolucion(input: GenerarResolucionInput): Promise<ResolucionGenerada> {
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
}
