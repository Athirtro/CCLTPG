# apps/api — Backend (CCLTPG)

**Estado:** esqueleto caminante de la Iteración 1 (RB1-01…RB1-14). Sin módulos de negocio ni autenticación: eso corresponde a C2.

## Propósito

Backend NestJS (TypeScript estricto, ESM) del monolito modular CCLTPG. Alojará los contextos identity, audit, files, notifications, exports y analytics (esquema `public`) y academic (esquema `academic`).

## Requisitos

- Node.js 22.19+ (`.nvmrc` en la raíz).
- pnpm 9.15.4.
- PostgreSQL 16 y Redis 7 (vía `infra/compose`).

## Comandos

```bash
pnpm install                       # desde la raíz
pnpm --filter @ccltpg/api dev      # nest start --watch
pnpm --filter @ccltpg/api build    # nest build
pnpm --filter @ccltpg/api typecheck
pnpm --filter @ccltpg/api lint
pnpm --filter @ccltpg/api test             # unitarias + API (Vitest)
pnpm --filter @ccltpg/api test:integration # PostgreSQL real
pnpm --filter @ccltpg/api test:architecture
pnpm --filter @ccltpg/api openapi:generate
```

Migraciones (requieren `DATABASE_MIGRATOR_URL`):

```bash
pnpm --filter @ccltpg/api migrate:status
pnpm --filter @ccltpg/api migrate:up [public|academic|all]
pnpm --filter @ccltpg/api migrate:down public|academic
```

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/v1/health/live` | Liveness: proceso vivo, `uptimeSeconds`, `timestamp`, `requestId` |
| GET | `/api/v1/health/ready` | Readiness: PostgreSQL y Redis; 503 en Problem Details si fallan |
| GET | `/metrics` | Métricas Prometheus; fuera de `/api/v1`, excluido del contrato y restringido por red/mTLS en producción |

Todas las respuestas de error usan Problem Details (`application/problem+json`) con `code`, `instance` y `requestId`.

### Contrato

El contrato es **code-first** (D28 aplicado como A, pendiente de ratificación):

1. Los controladores y DTOs de `@nestjs/swagger` son la fuente.
2. `@ApiContract(...)` añade `x-access`, `x-permission`, `x-scope`, `x-audit-event` y `x-error-codes`.
3. `pnpm contracts:generate` escribe `packages/contracts/openapi.json` y `events.json` ya formateados.
4. `pnpm contracts:validate` comprueba R-028/R-031 y la allowlist `packages/contracts/public-routes.json`.
5. `pnpm contracts:lint` aplica las reglas Spectral.
6. CI regenera y falla si el artefacto comiteado difiere del código.

Toda ruta pública nueva debe revisarse y añadirse explícitamente a `packages/contracts/public-routes.json`; el validador falla si el OpenAPI y la allowlist divergen (C-14).

## Seguridad HTTP

`src/bootstrap/configure-app.ts` concentra la línea base:

- Helmet con CSP restrictiva, `nosniff`, `SAMEORIGIN`, `no-referrer`, COOP/CORP y HSTS en producción.
- `Permissions-Policy` sin cámara, micrófono, geolocalización, pago ni USB.
- CORS por lista exacta; un `Origin` no permitido responde **403** `CORS_ORIGIN_DENIED` en Problem Details.
- Límite de cuerpo configurable (`BODY_LIMIT`, 1 MB por defecto); el exceso responde 413.
- Prefijo global `/api/v1`; `/metrics` queda excluido.
- `X-Powered-By` deshabilitado.
- Validación global con `whitelist` y `forbidNonWhitelisted`.

## Observabilidad

- **Logs:** Pino estructurado con `requestId` (UUIDv7), `traceId`/`spanId` cuando OTel está activo y redacción de tokens y PII (email, documento, teléfono, dirección, nombres).
- **Métricas:** `prom-client` en `/metrics` con `ccltpg_http_requests_total`, `ccltpg_http_request_duration_seconds` y métricas por defecto de Node con prefijo `ccltpg_`.
- **Trazas:** OpenTelemetry opcional. Se activan con `OTEL_ENABLED=true`; instrumentan HTTP, Express, PostgreSQL y Redis y exportan por OTLP/HTTP.
- Las rutas de salud se excluyen del log automático para no generar ruido.

## Estructura

```text
src/
  main.ts                         # arranque, métricas y escucha
  app.module.ts
  bootstrap/configure-app.ts      # Helmet, CORS, límites, prefijo y filtros
  database/                       # Kysely + Redis y migrador por esquema
  health/                         # liveness, readiness y DTOs del contrato
  metrics/                        # endpoint Prometheus (fuera de /api/v1)
  openapi/                        # construcción y generación del contrato
  shared/
    auth/                         # @Public() para la allowlist de C2
    config/env.ts                 # validación de entorno con zod
    errors/                       # Problem Details, DTOs y validación
    http/                         # requestId tipado
    observability/                # pino, métricas, trazas e instrumentación
    openapi/                      # decorador ApiContract (x-* de R-028)
```

## Variables de entorno

Copiar `.env.example` de la raíz a `.env`. Mínimas para arrancar:

- `DATABASE_URL` (rol `ccltpg_app`).
- `DATABASE_MIGRATOR_URL` (rol `ccltpg_migrator`, solo migraciones).
- `DATABASE_READONLY_URL` (rol `ccltpg_readonly`, pruebas y consultas).
- `REDIS_URL`.
- `CORS_ORIGINS`, `BODY_LIMIT`, `HEALTH_TIMEOUT_MS`, `LOG_LEVEL`.

Opcionales de observabilidad:

- `OTEL_ENABLED` (`false` por defecto).
- `OTEL_SERVICE_NAME` (`ccltpg-api` por defecto).
- `OTEL_EXPORTER_OTLP_ENDPOINT` (`http://localhost:4318/v1/traces` por defecto).

La API valida el entorno con zod y falla al arrancar si una variable obligatoria es inválida.

## Pruebas

| Suite | Qué cubre |
| --- | --- |
| `test/api` | Salud, Problem Details, cabeceras, CORS, 413, métricas y redacción de PII |
| `test/integration` | Migrador `up/down/up`, historiales por esquema y privilegios de roles |
| `test/architecture` | Reglas de `dependency-cruiser` + violaciones deliberadas de dominio y contextos |
| `pnpm test:security` | Escáner de secretos y sus casos negativos |
| `pnpm test:contracts` | Validador R-028/R-031/allowlist |

## Limitaciones conocidas

- Sin Docker en la máquina de desarrollo actual: Compose no se ha ejecutado; la integración se verificó con PostgreSQL 16 embebido.
- Las carpetas de migraciones no se copian a `dist` en el build; el empaquetado de producción se resuelve en C5.
- Sin guard de autorización todavía; solo existe la marca `@Public()` y la allowlist de contrato para C2.
- Las trazas requieren un colector externo; C1 no incluye un backend de trazas.
- El bundle web supera 500 kB; se resuelve en C5.

## Referencias

- `docs/diseno-arquitectonico.md` (caps. 4–6, 16–19)
- `docs/contratos/` (propuestas pendientes de ratificación de C0)
- `docs/diccionario-datos.md`
- `docs/runbook/` (arranque, migraciones, operación, secretos e incidentes)
- `docs/reviews/c1/rol-b.md`
