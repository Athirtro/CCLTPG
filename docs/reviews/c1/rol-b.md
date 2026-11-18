# Paquete de revisión — Compuerta 1 (Rol B)

- **Rol:** B — Seguridad, identidad y operación
- **Compuerta:** C1 — Esqueleto caminante
- **Estado:** **Ejecutado con dos límites de evidencia.** RB1-01…RB1-14 están implementados y verificados localmente; Compose no se ha ejecutado por falta de Docker y el pipeline de GitHub Actions aún no se ha ejecutado en GitHub. La integración con PostgreSQL se verificó contra un PostgreSQL 16 real embebido.
- **Plan asociado:** `docs/tasks/rol-b/rol-b-it1-plan.md`
- **Registro de ejecución:** `docs/tasks/rol-b/rol-b-it1-registro.md`
- **Regla:** no se marca ningún criterio como cumplido sin evidencia enlazada.

## 1. Alcance entregado frente al planificado

| Tarea | Entregable | Estado | Evidencia |
| --- | --- | --- | --- |
| RB1-01 | Monorepo y toolchain | **Cumplido** | `package.json`, `pnpm-workspace.yaml`, `packages/config`; `format:check`, `typecheck`, `lint`, `test` y `build` verdes |
| RB1-02 | Compose con PostgreSQL, Redis y MinIO | **Parcial** | `infra/compose/docker-compose.yml` válido como YAML (4 servicios, 3 volúmenes, healthchecks); **no ejecutado**: no hay Docker |
| RB1-03 | Migrador y esquemas | **Cumplido con límite de entorno** | Migrador Kysely, CLI `up/down/status`, historiales y candado por esquema; `migrator.spec.ts` con `up/down/up` verde contra PostgreSQL 16 real. Las tablas de negocio esperan RC-A-01…04 |
| RB1-04 | Roles y privilegios | **Cumplido con límite de entorno** | `00-roles.sql` y 5 pruebas de privilegios verdes contra PostgreSQL 16 real |
| RB1-05 | Bootstrap backend y salud | **Cumplido** | `GET /api/v1/health/live` → 200; `/health/ready` → 200/503 con Problem Details; requestId UUIDv7 |
| RB1-06 | Bootstrap frontend | **Cumplido** | SPA compila y sirve `/estado`; 3 pruebas web verdes |
| RB1-07 | Pipeline OpenAPI | **Cumplido** | OpenAPI code-first con `@nestjs/swagger`, `@ApiContract`, DTOs de salud y `packages/contracts/openapi.json` generado |
| RB1-08 | Validador de contrato | **Cumplido** | `events.json` (59 eventos), `public-routes.json`, validador R-028/R-031/C-14, Spectral y 7 pruebas |
| RB1-09 | Pipeline CI | **Implementado; ejecución en GitHub pendiente** | `.github/workflows/ci.yml` con jobs `quality`, `contracts`, `integration` y `security`; YAML validado; comandos locales equivalentes verdes |
| RB1-10 | Pruebas de arquitectura | **Cumplido** | `.dependency-cruiser.mjs`, `arch:check` sin violaciones y 3 pruebas con violaciones deliberadas detectadas |
| RB1-11 | Línea base HTTP | **Cumplido** | `bootstrap/configure-app.ts`, Helmet, CORS 403 `CORS_ORIGIN_DENIED`, 413, `/metrics` fuera del prefijo y 7 pruebas de seguridad |
| RB1-12 | Gestión de secretos | **Cumplido** | `.gitleaks.toml`, escáner propio, 5 pruebas, `security:secrets` sin hallazgos y `audit` crítico en CI |
| RB1-13 | Observabilidad mínima | **Cumplido con límite externo** | Métricas Prometheus, `/metrics`, logs con `traceId`/`spanId`, redacción de PII y OTel condicional; las trazas requieren colector externo |
| RB1-14 | Documentación y paquete | **Cumplido** | `docs/runbook/` (5 runbooks + índice), README de API y contratos actualizados, este paquete y el registro |

## 2. Decisiones y supuestos con reversibilidad

| Decisión | Elección aplicada | Reversibilidad | Consecuencia |
| --- | --- | --- | --- |
| D27 | **B — cierre condicional** (autorizado por el usuario) | Costosa | C1 avanzó sin acta formal de C0; el cierre pleno sigue pendiente |
| D28 | **A — code-first** | Costosa | El código es la fuente; `openapi.json` es artefacto generado y verificado en CI. Requiere ratificación formal |
| D29 | **A — prefijo `/api/v1`** | Barata antes de congelar rutas | Coincide con el diseño §6.2 |
| D30 | **A — Kysely migrator** | Costosa | Un historial y un candado por esquema (`public`, `academic`) |
| D31 | **A — script de inicialización de Compose** | Barata | Roles y esquemas son infraestructura, no migraciones |
| D32 | **A — `.env` local + secretos de CI** | Barata | En C1 solo existe `.env.example`; sin Vault/SOPS |
| D35 | **A — 80 % líneas / 70 % ramas** | Barata | Umbrales en `apps/api/vitest.config.ts` |
| D37 | **Desviación: se conserva `openapi-fetch`** | Media | Se preserva el esqueleto de Rol C; requiere ratificación o migración |
| D39 | **Desviación: pnpm global con `npm`** | Barata | `corepack enable` falla con `EPERM` en Windows; CI usa `pnpm/action-setup` |
| D40 | **A — filtro propio de Problem Details** | Costosa | Contrato con `code`, `requestId`, `instance` y `errors[]` |

**Desviaciones que requieren decisión del equipo:**

1. **D28:** el contrato se genera desde el código, no desde un YAML canónico. Se eligió por la imposibilidad de editar el artefacto congelado y por la trazabilidad directa con los controladores. Ratificar o volver a un flujo document-first.
2. **D33/D34/D36/D38:** sin ratificar. Se aplicó `zod`, `openapi-fetch`, generación JSON (sin tipos de frontend) y `dependency-cruiser` como solución operativa.
3. **D37:** `openapi-fetch` sigue siendo el cliente del esqueleto de Rol C. No se migró a `openapi-typescript`.
4. **D39:** pnpm quedó global vía npm; CI sí usa Corepack/action-setup.
5. **TypeScript 5.9.3:** `typescript-eslint` 8.73.0 exige peer `<6.1.0`.
6. **NestJS 12 es ESM:** la API usa `"type": "module"`, `NodeNext` y extensiones `.js` en imports relativos.

## 3. Preguntas abiertas

- **Acta de C0/C1:** sin acta formal no se puede declarar C1 cerrada, aunque el código esté listo.
- **Docker:** ¿se instala Docker Desktop en la máquina de desarrollo o se acepta que Compose se ejecute en otro entorno?
- **D28/D33/D34/D36/D37/D38:** ¿se ratifican las elecciones aplicadas o se cambia alguna antes de C2?
- **Dependencias añadidas:** `@nestjs/swagger`, `prom-client`, OTel, `dependency-cruiser`, Spectral, `zod` y `uuid` no estaban todas en el catálogo inicial del diseño; confirmar su inclusión.
- **Modelo de datos:** las tablas de negocio no existen hasta que Rol A aplique RC-A-01…04.
- **Contrato de negocio:** las rutas de C2 no existen hasta que Rol C ratifique RC-C-01…04.
- **PA-001…PA-017:** siguen sin ratificación de C0; no se inventaron vínculos.

## 4. Informe de pruebas y matriz

| Prueba | Comando | Resultado |
| --- | --- | --- |
| Formato | `pnpm format:check` | Todos los archivos aplicables cumplen Prettier |
| Tipos | `pnpm typecheck` | `@ccltpg/api` y `@ccltpg/web` sin errores |
| Lint | `pnpm lint` | Ambos paquetes sin errores ni advertencias |
| Unitarias/API | `pnpm test` | API: 5 archivos / **27 pruebas**; web: 1 archivo / **3 pruebas** |
| Build | `pnpm build` | API y web correctos; aviso de chunk web de 548,78 kB |
| Arquitectura | `pnpm arch:check` | Sin violaciones (47 módulos, 89 dependencias) |
| Arquitectura (prueba) | `pnpm test:architecture` | **3 pruebas verdes**, incluidas dos violaciones deliberadas |
| Seguridad HTTP | `pnpm --filter @ccltpg/api test` | 7 pruebas de cabeceras, CORS, preflight, 413, métricas y PII |
| Integración | `pnpm test:integration` + PostgreSQL 16 real | **7 pruebas verdes** (2 archivos) |
| Contrato | `pnpm contracts:validate` | 2 operaciones, 2 públicas, 59 eventos; sin errores |
| Spectral | `pnpm contracts:lint` | Sin errores |
| Validador | `pnpm test:contracts` | **7 pruebas verdes** |
| Secretos | `pnpm security:secrets` | Sin hallazgos |
| Escáner (pruebas) | `pnpm test:security` | **5 pruebas verdes** |
| SCA | `pnpm audit --prod --audit-level critical` | Sin críticas; 1 **high** sin parche (`picomatch` 4.0.7, transitiva de tooling) |
| CI | validación YAML | 4 jobs, 12 pasos en `quality`, 7 en `integration`; **no ejecutado en GitHub** |
| Compose | `docker compose ps` | **No ejecutado**: Docker ausente |

**Matriz de autorización:** en C1 solo existen rutas de salud, marcadas con `@Public()` y declaradas en `packages/contracts/public-routes.json`. No hay rutas de negocio ni guard de permisos; la matriz R-018…R-031 se implementa y prueba en C2 (control C-14).

## 5. Guion de demostración reproducible

1. `pnpm install --frozen-lockfile` con Node 22.19+ y pnpm 9.15.4.
2. Copiar `infra/compose/.env.example` a `infra/compose/.env` y cambiar contraseñas.
3. `pnpm infra:up` y confirmar `docker compose ps` con PostgreSQL, Redis y MinIO sanos. **(Requiere Docker; pendiente en esta máquina.)**
4. Copiar `.env.example` a `.env` y alinear las URLs con las contraseñas del paso 2.
5. `pnpm migrate:status` y `pnpm migrate:up`.
6. `pnpm dev`; abrir `http://localhost:5173/estado`.
7. Verificar `/api/v1/health/live` y `/api/v1/health/ready`.
8. Abrir `/metrics` y comprobar `ccltpg_http_requests_total`; confirmar que `/api/v1/metrics` da 404.
9. Ejecutar `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
10. Ejecutar `pnpm arch:check`, `pnpm test:architecture`, `pnpm contracts:validate`, `pnpm contracts:lint`, `pnpm test:contracts`, `pnpm test:security`.
11. Con PostgreSQL real: `pnpm test:integration` (7 pruebas).
12. Revisar la redacción de PII en `apps/api/test/api/security-headers.spec.ts`.

## 6. Diferencias (tablas, rutas, permisos, migraciones, dependencias)

- **Tablas:** ninguna de negocio. Solo historiales de Kysely y las tablas fixture de las pruebas; en C1 las carpetas `public` y `academic` están vacías a propósito.
- **Rutas:** `GET /api/v1/health/live`, `GET /api/v1/health/ready` y `GET /metrics` (operativa, fuera del contrato). No se añadieron rutas de negocio.
- **Permisos:** allowlist pública de salud; sin RBAC todavía.
- **Migraciones:** mecanismo, fixtures y pruebas `up/down/up`; sin tablas reales.
- **Contrato:** `packages/contracts/openapi.json`, `events.json`, `public-routes.json`, `spectral.yaml` y scripts de generación/validación.
- **Observabilidad:** `prom-client`, OTel condicional, `/metrics` y redacción ampliada de logs.
- **Dependencias añadidas:** `@nestjs/swagger`, `prom-client`, `@opentelemetry/api`, `@opentelemetry/sdk-node`, exportador OTLP HTTP, instrumentaciones http/express/pg/ioredis, `dependency-cruiser`, `@stoplight/spectral-cli`, además de `zod`, `uuid`, `pg`, `kysely`, `ioredis`, `pino`, `helmet`, `class-validator` y `class-transformer`.
- **Frontend:** se conservó el esqueleto de Rol C (React 19, MUI 9, `openapi-fetch`) y se añadió `/estado`; se unificó ESLint/Prettier.

## 7. Defectos y deuda técnica

| Deuda | Impacto | Destino |
| --- | --- | --- |
| Docker no instalado: Compose sin ejecutar | Alto para la evidencia de C1 | Instalar Docker o ejecutar el guion en otra máquina |
| Pipeline no ejecutado en GitHub | Medio: valida la configuración, no la plataforma | Publicar la rama y ejecutar CI |
| `quay.io/minio/minio:latest` sin digest | Reproducibilidad | C5/C8, al fijar imágenes |
| Bundle web de 548,78 kB (> 500 kB) | Rendimiento inicial | C5, con división de código |
| Token de acceso de Rol C en `localStorage` | Contradice el diseño §15 (memoria) | C2, al implementar sesión real |
| `Home.tsx` usa `sx={{ xs: 12, ... }}`, que no es una rejilla válida | Defecto visual | C2/C7 |
| Las carpetas de migraciones no se copian a `dist` en el build | Empaquetado de producción | C5, junto con la imagen del migrador |
| El filtro registra los 503 como error | Ruido operativo menor | Ajuste en C2/C13 |
| pnpm global en vez de Corepack | Reproducibilidad local | CI usa acción; documentado |
| Trazas sin colector verificado | Evidencia visual incompleta | C5/C8, con backend de trazas |
| `/metrics` sin restricción implementada | Seguridad operativa | Restricción por red/mTLS en despliegue |
| CVE-2026-112366 (`picomatch` <= 4.0.7, ReDoS, **high**, sin parche publicado) | Transitiva de `typescript-eslint`; es herramienta de build, no código de runtime de la API | Excepción firmada mientras no exista versión corregida; CI falla solo en críticas |
| Tipos del contrato no generados para el frontend | Deuda de integración | C2, al ratificar D36/D37 |
| OpenAPI y diccionario sin ratificación de C0 | Trazabilidad incompleta | Acta de C1/C2 |

## 8. Autoevaluación anti-deriva (diseño §19.2)

1. **¿Código accedió a partes internas o esquemas de otro contexto?** No. No hay contextos de dominio todavía; `DatabaseModule` es infraestructura compartida y `dependency-cruiser` verifica los límites con un fixture deliberado.
2. **¿Toda ruta nueva está protegida por permiso y probada permitida/denegada?** Solo hay rutas de salud, públicas por diseño, con `@Public()` y allowlist exacta. La protección de negocio es C2; no se simula.
3. **¿Toda operación que cambia estado emite auditoría?** No hay operaciones de estado en C1. El validador exige `x-audit-event` o justificación `x-audit-exempt` en mutaciones futuras.
4. **¿Todo campo de estado nuevo tiene máquina de estados y transiciones probadas?** No hay campos de estado nuevos.
5. **¿Las migraciones se mantienen en un solo esquema y pasan `up/down/up`?** Sí: historiales separados y prueba `up/down/up` verde contra PostgreSQL real.
6. **¿Se modificó algún artefacto congelado?** No. No se editó `docs/diseno-arquitectonico.md` ni `docs/vision-alcance.md`; `docs/` está excluido de Prettier.
7. **¿Se agregó alguna dependencia fuera de las decisiones registradas?** Sí: las listadas en §6. Quedan registradas para ratificación.
8. **¿Existe lógica de pagos o contabilidad?** No.
9. **¿Hay reglas sin trazabilidad a requisito o supuesto?** Las rutas de salud se trazan al diseño §6.2 y §10.1; la seguridad y la redacción a C-14/C-27/C-36/C-37/C-40/C-41; D28/D37/D39 quedan marcadas como desviaciones.
10. **¿Las garantías de solo inserción están en la base y no solo en el código?** Todavía no. La auditoría es C2; el script de roles deja la nota para revocar `UPDATE/DELETE` y añadir el disparador sobre `public.evento_auditoria`.
11. **¿Alguna prueba se omitió o simuló ocultando comportamiento real?** Las pruebas de integración se omiten explícitamente si faltan variables, pero se ejecutaron contra PostgreSQL 16 real. Las unitarias usan dobles solo para I/O (base, Redis, HTTP), no para reglas de negocio inexistentes.
12. **¿Documentación, OpenAPI y diccionario coinciden con el código?** OpenAPI se genera desde el código y se valida. El diccionario y las rutas de negocio siguen pendientes de RC-A/RC-C y del acta de C1.

## 9. Solicitud de firma

| Firmante | Qué aprueba | Estado |
| --- | --- | --- |
| Rol B | Línea base de monorepo, Compose, roles, migrador, API, SPA, contrato, CI, seguridad y observabilidad de C1 | Pendiente |
| Equipo | Ratificación de D28, D33, D34, D36, D37 y D38, y de las dependencias añadidas | Pendiente |
| Equipo | Excepción firmada para CVE-2026-112366 (`picomatch`, high, sin parche; solo tooling) | Pendiente |
| Equipo | Compuerta 1 y autorización de C2, con evidencia de Docker y CI en GitHub pendiente | Pendiente |
