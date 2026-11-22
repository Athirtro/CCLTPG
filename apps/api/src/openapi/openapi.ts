import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { env } from '../shared/config/env.js';

/**
 * Construye el documento OpenAPI desde los controladores y DTOs.
 * La fuente canónica es el código (D28-A); `packages/contracts/openapi.json`
 * es un artefacto generado y verificado en CI.
 */
export function buildOpenApiDocument(
  app: INestApplication,
): ReturnType<typeof SwaggerModule.createDocument> {
  const config = new DocumentBuilder()
    .setTitle('CCLTPG API v1')
    .setDescription(
      [
        'Contrato generado desde el código de la API (NestJS + @nestjs/swagger).',
        'Errores en Problem Details (RFC 9457) con `code`, `requestId` e `instance`.',
        'Toda operación declara `x-access`, `x-permission`, `x-scope` y `x-audit-event` (R-028).',
      ].join('\n\n'),
    )
    .setVersion('1.0.0-c1')
    .addServer(env.API_PREFIX, 'Prefijo de versión v1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearerAuth')
    .addCookieAuth('__Host-ccltpg_rt', { type: 'apiKey', in: 'cookie' }, 'cookieAuth')
    .addTag('salud', 'Liveness y readiness operativas')
    .addTag('autenticación', 'Login, MFA, refresh, logout y cambio de contraseña')
    .addTag('identidad', 'Perfil efectivo, permisos y administración de identidades')
    .addTag('auditoría', 'Consulta de eventos y meta-auditoría')
    .addTag('archivos', 'Carga, cuarentena y descarga autorizada de archivos')
    .addTag('notificaciones', 'Bandeja, preferencias y entrega de notificaciones')
    .addTag('exportaciones', 'Generación de reportes PDF, XLSX y CSV')
    .build();

  return SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => {
      const controller = controllerKey.replace(/Controller$/, '').toLowerCase();
      return `${controller}${methodKey.charAt(0).toUpperCase()}${methodKey.slice(1)}`;
    },
  });
}
