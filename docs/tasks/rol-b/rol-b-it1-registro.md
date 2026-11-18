# Registro de ejecución — Iteración 1 completa (Rol B)

- **Fecha:** 17 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Alcance:** RB1-01 a RB1-14 (bloques 1 a 4)
- **Paquete de revisión:** `docs/reviews/c1/rol-b.md`
- **Plan:** `docs/tasks/rol-b/rol-b-it1-plan.md`

> Las secciones 1 a 5 conservan el registro de los bloques 1 y 2. Las secciones 6 a 10 documentan el cierre de los bloques 3 y 4 y la evidencia final.

## 1. Entorno verificado

| Herramienta | Versión | Nota |
| --- | --- | --- |
| Node.js | 22.19.0 | Cumple D39 (Node 22 LTS) |
| npm | 10.9.3 | Usado solo para instalar pnpm |
| pnpm | 9.15.4 | Instalado con `npm i -g pnpm@9.15.4`; `corepack enable` falla con `EPERM` sobre `C:\Program Files\nodejs` |
| TypeScript | 5.9.3 | Fijado por el peer de `typescript-eslint` 8.73.0 (`<6.1.0`) |
| ESLint | 9.39.5 | Flat config compartida |
| Prettier | 3.10.1 | Formato común |
| Docker | **no instalado** | Bloquea la ejecución de Compose, migraciones y roles |

## 2. Ejecución por tarea

### RB1-01 — Monorepo y toolchain

**Hecho**

- `package.json` raíz con scripts `dev`, `build`, `lint`, `test`, `typecheck`, `format`, `migrate:*` e `infra:*`.
- `pnpm-workspace.yaml` con `apps/*` y `packages/*`.
- `packages/config` con `tsconfig/base|node|react`, fábrica ESLint 9 y configuración Prettier.
- `.nvmrc` (22), `.editorconfig`, `.prettierignore`, `prettier.config.mjs`.
- `apps/api` y `apps/web` normalizados a `@ccltpg/api` y `@ccltpg/web`.

**Evidencia**

```text
pnpm install                          → lockfile generado
pnpm format:check                     → All matched files use Prettier code style!
pnpm typecheck                        → apps/api Done; apps/web Done
pnpm lint                             → apps/api Done; apps/web Done
pnpm build                            → nest build Done; vite build Done
```

**Decisión técnica:** NestJS 12 y `@nestjs/cli` 12 publican ESM. La API usa `"type": "module"`, `module`/`moduleResolution: NodeNext` y extensiones `.js` en imports relativos. `kysely/migration` solo resuelve con esa configuración.

**Correcciones aplicadas durante la verificación:** extensiones `.js` en todos los imports relativos; `import { Redis } from 'ioredis'` (ioredis 5 no expone una clase por defecto utilizable como tipo); `import.meta.dirname` en lugar de `__dirname`; `migrationTableSchema` también cubre el candado (no existe `migrationLockTableSchema` en Kysely 0.29.9).

### RB1-02 — Entorno contenerizado

**Hecho**

- `infra/compose/docker-compose.yml`: PostgreSQL 16, Redis 7.4, MinIO, job `minio-init`, healthchecks, volúmenes con nombre y red `ccltpg-dev`.
- `infra/compose/.env.example` y `README.md` con arranque, URLs y comandos.
- Redis con AOF, `maxmemory-policy noeviction`; MinIO con bucket privado.

**Evidencia**

```text
python yaml.safe_load(docker-compose.yml)
  services: minio, minio-init, postgres, redis
  volumes: miniodata, pgdata, redisdata
  networks: backend
  healthchecks: postgres, redis, minio; minio-init depende de minio
```

**Limitación:** no se ejecutó `docker compose up` ni `docker compose ps`: Docker no está instalado. La etiqueta de MinIO queda en `latest` hasta fijarla por digest (C5/C8).

### RB1-03 — Migrador y esquemas

**Hecho**

- `src/database/migrator/migrator-setup.ts`: `FileMigrationProvider`, historial y candado por esquema (`public`, `academic`).
- `src/database/migrator/migrate.ts`: CLI `up`, `down`, `status`; objetivo `public`, `academic` o `all`; `down` exige esquema explícito.
- `src/database/migrations/{public,academic}/README.md` explican por qué están vacías.
- `README.md` del migrador con reglas y uso.
- Pruebas: `test/integration/migrator.spec.ts` (up → down → up e historiales separados) y fixtures en `test/fixtures/migrations`.

**Evidencia**

```text
pnpm --filter @ccltpg/api test:integration
  Test Files  2 skipped (2)
  Tests       7 skipped (7)
```

**Limitación:** las pruebas requieren `DATABASE_MIGRATOR_URL`, `DATABASE_URL` y `DATABASE_READONLY_URL` apuntando a PostgreSQL real. No hay tablas de negocio: dependen de RC-A-01…04.

### RB1-04 — Roles y privilegios

**Hecho**

- `infra/compose/postgres/init/00-roles.sql` crea `ccltpg_migrator`, `ccltpg_app` y `ccltpg_readonly` con `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`.
- `ccltpg_app`: DML sin DDL; `ccltpg_readonly`: solo lectura con `default_transaction_read_only = on`.
- Esquemas `public` y `academic`, revocación de privilegios de `PUBLIC` y privilegios por defecto para objetos futuros del migrador.
- Pruebas: `test/integration/db-roles.spec.ts` (la app no hace DDL, `readonly` no escribe, `readonly` no hace DDL, transacción de solo lectura).

**Limitación:** no ejecutado sin PostgreSQL. La inmutabilidad de auditoría (revocar `UPDATE/DELETE` y disparador) es C2 y está anotada en el SQL.

### RB1-05 — Bootstrap del backend y salud

**Hecho**

- `env.ts` con zod y `dotenv`; URL separada del migrador.
- Problem Details: tipos, códigos estables, filtro global, fábrica de validación y `requestId` UUIDv7.
- Pino con `requestId`, serializadores mínimos y redacción de `Authorization`, cookies, contraseñas, códigos MFA y tokens.
- `DatabaseModule` global con Kysely y Redis perezoso; cierre ordenado.
- `HealthService` y `HealthController` con `/health/live` y `/health/ready`; timeout configurable y sin filtrar errores internos.
- `main.ts` con prefijo `/api/v1`, Helmet, CORS por lista, límite de cuerpo, ValidationPipe, filtro global y shutdown hooks.

**Evidencia**

```text
GET /api/v1/health/live   → 200
{"status":"ok","uptimeSeconds":6,"timestamp":"...","requestId":"3f1b2c4d-..."}
X-Request-Id              → eco del UUID enviado

GET /api/v1/health/ready  → 503 (sin PostgreSQL/Redis)
{"type":"about:blank","title":"Service Unavailable","status":503,
 "detail":"Dependencias no disponibles: database, redis.",
 "instance":"/api/v1/health/ready","code":"SERVICE_UNAVAILABLE",
 "requestId":"01a1ec52-..."}

pnpm --filter @ccltpg/api test
  Test Files  4 passed (4)
  Tests       20 passed (20)
```

### RB1-06 — Bootstrap del frontend

**Hecho**

- Se conservó el esqueleto de Rol C (React 19, MUI 9, `openapi-fetch`, páginas auth/matrícula).
- `apps/web` normalizado: `@ccltpg/web`, versiones exactas, ESLint 9, Vitest, tsconfigs, `vite.config.ts` con proxy `/api` y preview.
- Página `/estado` con tabla de dependencias, latencia, resumen, `requestId` y refresco automático cada 15 s.
- Prueba `src/api/health.test.ts`.

**Evidencia**

```text
pnpm --filter @ccltpg/web test  → 3 passed
pnpm --filter @ccltpg/web build → built in 6.67s (aviso: chunk 548,79 kB)
GET http://localhost:4176/estado → 200 (HTML con #root y título)
```

**Deuda conocida:** el bundle supera los 500 kB; el token de Rol C sigue en `localStorage` (C2); `Home.tsx` tiene un `sx` de rejilla inválido.

## 3. Archivos principales añadidos

| Área | Archivos |
| --- | --- |
| Raíz | `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.editorconfig`, `.prettierignore`, `prettier.config.mjs`, `.env.example`, `.gitignore` |
| Config compartida | `packages/config/{package.json,README.md,eslint,prettier,tsconfig}` |
| API | `src/main.ts`, `src/app.module.ts`, `src/database/*`, `src/health/*`, `src/shared/*`, `test/api/*`, `test/integration/*`, `test/fixtures/*`, `vitest.config.ts`, `eslint.config.mjs`, `tsconfig.build.json` |
| Web | `src/api/{client,health,health.test}.ts`, `src/pages/Health.tsx`, `eslint.config.mjs`, `vite.config.ts`, `tsconfig.*` |
| Infra | `infra/compose/docker-compose.yml`, `.env.example`, `README.md`, `postgres/init/00-roles.sql`, `postgres/init/README.md` |

## 4. Pendiente y bloqueado al cierre de los bloques 1 y 2 (histórico)

| Pendiente | Motivo | Siguiente paso |
| --- | --- | --- |
| Ejecutar Compose | Docker ausente | Instalar Docker o ejecutar en otra máquina |
| Migraciones reales y pruebas de integración | Sin PostgreSQL | Levantar Compose y correr `pnpm test:integration` |
| Verificar roles en base real | Sin PostgreSQL | Ejecutar `db-roles.spec.ts` contra Compose |
| RB1-07/08 (OpenAPI y validador) | RC-C y D28 sin ratificar | Esperar contratos de Rol C |
| RB1-09/10 (CI y arquitectura) | Fuera de estos bloques | Planificar bloque 3 |
| RB1-11/12/13 (HTTP, secretos, observabilidad) | Parciales | Completar en bloque 4 |
| RB1-14 (runbook y cierre) | Depende de lo anterior | Cerrar al final de C1 |

## 5. Decisiones que el usuario debe confirmar

1. **Docker:** instalar Docker Desktop o aceptar que la evidencia de Compose/migraciones se produzca en otro entorno.
2. **D37:** ratificar `openapi-fetch` (ya integrado por Rol C) o migrar a `openapi-typescript` + wrapper propio en RB1-07.
3. **Dependencias añadidas:** `zod` y `uuid` no estaban en el catálogo del diseño; se usan para validar entorno y generar `requestId`. Confirmar su inclusión.
4. **D39:** aceptar pnpm global por `npm` (sin Corepack) o resolver permisos para `corepack enable`.

## 6. Evidencia real de base de datos sin Docker

Docker no está instalado en la máquina. Para no dejar RB1-03/RB1-04 en "escrito pero no ejecutado", se usó PostgreSQL 16 embebido (`embedded-postgres@16.15.0-beta.19`) en el puerto 55432 mediante un arnés externo en `C:\Users\davin\AppData\Local\Temp\opencode\pgtest`.

El arnés:

1. Inicializa un clúster temporal.
2. Ejecuta `infra/compose/postgres/init/00-roles.sql`, sustituyendo los meta-comandos `\getenv` y las variables `:'var'`/`:"var"` porque el binario embebido no incluye `psql.exe`.
3. Exporta `DATABASE_MIGRATOR_URL`, `DATABASE_URL` y `DATABASE_READONLY_URL`.
4. Ejecuta `pnpm test:integration`.

**Resultado:** 2 archivos, **7 pruebas verdes** (5 de roles + 2 del migrador).

Correcciones necesarias para que la evidencia fuera real:

- `expectWriteDenied` acepta `42501` (privilegio insuficiente) y `25006` (transacción de solo lectura).
- `show transaction_read_only` se lee con el nombre de columna `transaction_read_only`, no `readonly`.
- El migrador usa `pathToFileURL` para cargar migraciones en Windows/ESM.
- El arnés resuelve los meta-comandos de `psql` sin alterar el archivo versionado.

**Límite:** esto valida el SQL y el migrador contra PostgreSQL real, pero no sustituye la ejecución de Compose ni la evidencia de `docker compose ps`.

## 7. Ejecución de los bloques 3 y 4

### RB1-07 — OpenAPI code-first

- `apps/api/src/openapi/openapi.ts`: documento OpenAPI con `DocumentBuilder`, servidor `/api/v1`, seguridad bearer/cookie y `ignoreGlobalPrefix`.
- `apps/api/src/openapi/generate.ts`: genera `packages/contracts/openapi.json` desde el código y lo formatea con Prettier para que `format:check` y la verificación de deriva en CI sean estables.
- `apps/api/src/shared/openapi/contract-metadata.ts`: decorador `@ApiContract` que emite `x-access`, `x-permission`, `x-scope`, `x-audit-event`, `x-error-codes`, `x-partial-scope` y `x-audit-exempt`.
- DTOs de salud (`health/dto/*`) y `ProblemDetailsDto` con `type` explícito para evitar la detección de dependencia circular de `@nestjs/swagger` cuando `tsx`/esbuild no emite metadatos de decoradores.
- Script `contracts:generate` en la raíz y `openapi:generate` en la API.

**Decisión aplicada:** D28 como **A (code-first)**. El código es la fuente canónica y `openapi.json` es un artefacto generado y verificado. Requiere ratificación formal del equipo.

### RB1-08 — Validador de contrato y eventos

- `packages/contracts/events.json`: 59 eventos extraídos de `docs/contratos/modelo-auditoria-v1.md` §3.
- `packages/contracts/public-routes.json`: allowlist exacta de rutas públicas (`GET /api/v1/health/live`, `GET /api/v1/health/ready`).
- `packages/contracts/scripts/lib/contract-validation.mjs`: valida R-028, R-031/C-27 y C-14 en ambos sentidos.
- `packages/contracts/scripts/validate-contract.mjs`: CLI que falla con código 1 y lista los errores.
- `packages/contracts/spectral.yaml`: reglas de `summary`, `x-*`, tags, servidores y contacto.
- `packages/contracts/scripts/contract.test.mjs`: 7 pruebas con documentos deliberadamente inválidos.

**Resultado:** `contracts:validate` reporta "2 operaciones, 2 públicas, 59 eventos"; `contracts:lint` sin errores; 7 pruebas verdes. Ninguna operación de C1 referencia todavía un evento de auditoría: salud usa `x-audit-event: "-"`.

### RB1-09 — Pipeline de CI

- `.github/workflows/ci.yml` con cuatro jobs:
  1. `quality`: instalación congelada, formato, tipos, lint, pruebas, build, `arch:check`, `test:architecture` y `test:security`.
  2. `contracts`: regenerar, `git diff --exit-code -- packages/contracts`, validar, Spectral y `test:contracts`.
  3. `integration`: servicios `postgres:16-alpine` y `redis:7.4-alpine`, instalación de `postgresql-client`, ejecución del mismo `00-roles.sql` de Compose y `pnpm test:integration`.
  4. `security`: escáner propio, Gitleaks sobre el historial y `pnpm audit --prod --audit-level critical`.
- Scripts raíz añadidos: `test:contracts`, `security:secrets`.
- El YAML se validó con PyYAML: 4 jobs, 12 pasos en `quality` y 7 en `integration`.

**Límite:** el pipeline no se ha ejecutado en GitHub Actions porque el trabajo no está comiteado/publicado. La ejecución local equivalente sí está verde.

### RB1-10 — Pruebas de arquitectura

- `.dependency-cruiser.mjs` con reglas: dominio sin frameworks, dominio sin capas externas, aplicación sin infraestructura, contextos aislados, `shared` sin contextos, acceso a datos solo en infraestructura y prohibición de ciclos.
- `apps/api/test/architecture/architecture.spec.ts` ejecuta las reglas reales y las mismas reglas contra un fixture con dos violaciones deliberadas.
- Se corrigieron dos problemas reales de la herramienta: el `exclude` inicial ocultaba `node_modules` y las rutas resueltas de pnpm incluyen `.pnpm/<paquete>/node_modules/...`; las reglas usan arreglos de patrones para cubrir ambos casos.

**Resultado:** `arch:check` sin violaciones (47 módulos, 89 dependencias) y **3 pruebas verdes**, incluidas `dominio-sin-frameworks` y `contextos-aislados`.

### RB1-11 — Línea base de seguridad HTTP

- `apps/api/src/bootstrap/configure-app.ts` extrae la configuración común de `main.ts` y las pruebas.
- Helmet con CSP, `nosniff`, `SAMEORIGIN`, `no-referrer`, COOP/CORP, HSTS en producción y `Permissions-Policy`.
- CORS por lista exacta: un `Origin` no permitido se rechaza con **403** `CORS_ORIGIN_DENIED` en Problem Details, incluso en preflight.
- Límite de cuerpo (`BODY_LIMIT`) con respuesta 413.
- Prefijo global `/api/v1` y `/metrics` excluido.
- `apps/api/test/api/security-headers.spec.ts`: **7 pruebas** de cabeceras, CORS permitido/denegado, preflight, 413, métricas y redacción de PII.

### RB1-12 — Gestión de secretos

- `.env.example` sin valores reales; `.env` ignorado por Git.
- `.gitleaks.toml` con allowlist de ejemplos y artefactos.
- `scripts/secret-scan.mjs`: reglas para claves privadas, AWS, GitHub, Slack, JWT, URL de base con contraseña y asignaciones de secretos; descarta placeholders.
- `scripts/secret-scan.test.mjs`: **5 pruebas** (detección y falsos positivos).
- `pnpm security:secrets`: sin hallazgos en el repositorio.
- CI ejecuta el escáner propio, Gitleaks y `pnpm audit --prod --audit-level critical`.

### RB1-13 — Observabilidad mínima

- `apps/api/src/shared/observability/metrics.ts`: registro Prometheus con prefijo `ccltpg_`, contador y histograma HTTP, etiqueta de ruta acotada (`unmatched` para 404).
- `apps/api/src/metrics/*`: endpoint `/metrics` fuera de `/api/v1`, excluido de OpenAPI.
- `apps/api/src/shared/observability/tracing.ts` e `instrumentation.ts`: OTel condicional con `OTEL_ENABLED`, instrumentaciones http/express/pg/ioredis y exportador OTLP/HTTP.
- `logger.config.ts`: `traceId`/`spanId` en logs cuando hay span activo y redacción ampliada de PII (email, documento, teléfono, dirección, nombres).
- Las rutas de salud se excluyen del log automático.

**Resultado:** las métricas se exponen y `/api/v1/metrics` responde 404; la redacción de PII tiene prueba verde. Las trazas requieren un colector externo y quedan configuradas, no verificadas visualmente.

### RB1-14 — Documentación y paquete C1

- Runbooks nuevos en `docs/runbook/`: índice, arranque local, migraciones y reversión, operación y diagnóstico, rotación de secretos e incidente de seguridad.
- `apps/api/README.md` y `packages/contracts/README.md` actualizados con contrato, seguridad, observabilidad y comandos.
- Este registro y `docs/reviews/c1/rol-b.md` actualizados con la evidencia final.

## 8. Verificación final ejecutada

| Comando | Resultado |
| --- | --- |
| `pnpm format:check` | Todos los archivos aplicables cumplen Prettier |
| `pnpm typecheck` | `@ccltpg/api` y `@ccltpg/web` sin errores |
| `pnpm lint` | Ambos paquetes sin errores ni advertencias |
| `pnpm test` | API: 5 archivos / **27 pruebas**; web: 1 archivo / **3 pruebas** |
| `pnpm build` | API y web compilan; aviso de chunk web de 548,78 kB |
| `pnpm arch:check` | Sin violaciones (47 módulos, 89 dependencias) |
| `pnpm test:architecture` | **3 pruebas verdes**, con violaciones deliberadas detectadas |
| `pnpm test:security` | **5 pruebas verdes** |
| `pnpm security:secrets` | Sin hallazgos |
| `pnpm contracts:generate` | OpenAPI + 59 eventos generados y formateados |
| `pnpm contracts:validate` | Contrato válido: 2 operaciones, 2 públicas, 59 eventos |
| `pnpm contracts:lint` | Sin errores Spectral |
| `pnpm test:contracts` | **7 pruebas verdes** |
| `pnpm test:integration` (PostgreSQL 16 real) | **7 pruebas verdes** (2 archivos) |
| `pnpm audit --prod --audit-level critical` | Sin críticas; 1 high sin parche (`picomatch`, tooling) |
| Validación YAML del pipeline | 4 jobs, 12 pasos en `quality`, 7 en `integration` |

## 9. Decisiones pendientes y desviaciones

| Decisión | Estado | Qué falta |
| --- | --- | --- |
| D28 — fuente canónica del OpenAPI | Aplicada como A (code-first) | Ratificación formal del equipo |
| D33 — estrategia de validación de esquemas | Sin ratificar | Confirmar `zod` en el borde y DTOs de Swagger |
| D34 — cliente HTTP del frontend | Sin ratificar | Se conservó `openapi-fetch` de Rol C |
| D36 — generación de tipos del contrato | Sin ratificar | Definir si se generan tipos desde `openapi.json` en C2 |
| D37 — `openapi-fetch` vs `openapi-typescript` | Desviación registrada | Ratificar o migrar |
| D38 — herramienta de arquitectura | Sin ratificar | Se usó `dependency-cruiser` 18.8.0 |
| D39 — pnpm global vs Corepack | Desviación registrada | Aceptar o resolver permisos |
| Docker | Bloqueado | Instalar Docker o aceptar evidencia en otro entorno |
| RC-A-01…04 / RC-C-01…04 | Sin ratificación formal | Las tablas de negocio y las rutas de C2 esperan |

Dependencias añadidas para RB1-07…13 y pendientes de ratificación: `@nestjs/swagger@12.1.2`, `prom-client@15.1.3`, `@opentelemetry/api@1.10.0`, `@opentelemetry/sdk-node@0.301.2`, exportador OTLP HTTP e instrumentaciones http/express/pg/ioredis, `dependency-cruiser@18.8.0` y `@stoplight/spectral-cli@6.17.1`.

## 10. Deuda y siguiente paso

- Ejecutar el pipeline en GitHub Actions al publicar la rama.
- Ejecutar Compose en un entorno con Docker y adjuntar `docker compose ps`.
- Ratificar la excepción de CVE-2026-112366 (`picomatch`, high, sin parche, solo tooling de build).
- Ratificar D28, D33, D34, D36, D37 y D38, y las dependencias añadidas.
- Completar los tipos del contrato en el frontend cuando se ratifique D36/D37.
- Abrir C2 solo con el acta de C1 y las condiciones P0 de C0 resueltas o aceptadas formalmente.
