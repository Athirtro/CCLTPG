# Registro de ejecución — Iteración 2 (Rol B)

- **Fecha:** 19 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Alcance:** RB1-15 a RB1-19 (fases 1 a 5 del plan de C2)
- **Plan:** `docs/tasks/rol-b/rol-b-it2-plan.md`
- **Paquete de revisión:** `docs/reviews/c2/rol-b.md`

> Este registro documenta la ejecución real, los comandos y los límites de la evidencia. Las cifras corresponden a la verificación final del 19 de noviembre de 2026.

## 1. Entorno verificado

| Herramienta | Versión | Nota |
| --- | --- | --- |
| Node.js | 22.19.0 | D39 |
| pnpm | 9.15.4 | Instalación global vía npm |
| TypeScript | 5.9.3 | Peer de `typescript-eslint` 8.73.0 |
| Vitest | 5.1.0 | Unitarias, contrato y arquitectura |
| NestJS | 12.5.1 | ESM (`"type": "module"`, `NodeNext`) |
| PostgreSQL | 16.15.0 (embebido) | Puerto 55432; sustituye a Compose |
| Docker Desktop | instalado | Host Windows → contenedor falla con `28P01` |
| MinIO | no descargable | `quay.io/minio/minio:latest` responde 401 |

## 2. Ejecución por tarea

### RB1-15 — Migraciones del núcleo y auditoría de solo inserción

**Hecho**

- `0001_create_identity_core.ts`: `usuario`, `perfil`, `permiso`, `perfil_permiso`, `usuario_perfil` y `refresh_token` con claves foráneas e índices.
- `0002_create_evento_auditoria.ts`: `evento_auditoria` con `actor_id`, `actor_perfil`, `ip`, `dispositivo`, `recurso`, `recurso_id`, `accion`, `datos_antes`, `datos_despues`, `ocurrido_en` y `request_id`.
- Inmutabilidad en la base: `REVOKE UPDATE, DELETE, TRUNCATE` a `ccltpg_app`, `GRANT SELECT, INSERT`, función `auditoria_solo_insercion()` y triggers `trg_auditoria_no_update_delete` y `trg_auditoria_no_truncate`.
- Índices por ocurrencia, actor, recurso y `request_id`.
- `0003_complete_identity_model.ts`: `usuario.debe_cambiar_password`, `codigo_recuperacion_mfa` e índices de sesión.

**Evidencia**

```text
PostgreSQL 16 embebido (55432):
  migrator.spec.ts   3/3  (up → down → up genérico, historiales y núcleo)
  db-roles.spec.ts   5/5  (DDL, DML, solo lectura y privilegios)
```

**Límite:** no se ejecutó `docker compose up`; la evidencia es contra PostgreSQL real embebido, no contra el contenedor de Compose.

### RB1-16 — Autenticación, MFA, refresh, logout y contraseña

**Hecho**

- Dominio: `identity.types.ts`, `login-state.ts` (máquina de estados), `password-policy.ts` y `perfiles.ts`.
- Aplicación: `SessionService`, `AuthStateService`, `LoginService`, `MfaService`, `PasswordService`, `MeService` e `IdentityAdminService`.
- Puertos: repositorios, unidad de trabajo, hasher, tokens, TOTP, cifrado, caché de sesión, limitador y reloj.
- Infraestructura: repositorios Kysely, `KyselyUnitOfWork`, Argon2, JWT `jose`, TOTP RFC 6238, AES-256-GCM, Redis (`SessionCache`, `RateLimiter`) y reloj del sistema.
- API: `AuthController`, `MeController` e `IdentityController`; DTOs; cookies `__Host-`; CSRF; guard global.
- Contrato: `x-access`, `x-permission`, `x-scope`, `x-audit-event`, `x-partial-scope`, `x-audit-exempt` y `x-allow-anonymous`.

**Evidencia**

```text
Unitarias:
  argon2-password-hasher.spec.ts   3/3
  jose-token.service.spec.ts       4/4
  totp.spec.ts                     vectores RFC 6238
  password-policy.spec.ts          bordes 12/128 y lista de comunes
  auth-cookies.spec.ts             3/3
  csrf.service.spec.ts             3/3

Integración (identity-flow.spec.ts, 16 pruebas):
  semilla idempotente · credenciales inválidas · contraseña → MFA → sesión
  rotación de refresh y reutilización · códigos de recuperación · logout
  bloqueo tras cinco fallos · auditoría correlacionada · máquina de estados
  10 códigos de un solo uso · revocación por estado/perfil · eventos
```

**Límite:** AC-SEC-14 (límites con reloj simulado) solo se prueba a nivel de filtro y guard; no hay suite HTTP completa.

### RB1-17 — Motor de permisos y `/me`

**Hecho**

- `@RequirePermissions`, `@AuthenticatedOnly`, `@PartialScopes`, `@AllowAnonymous` y `@Public`.
- Guard global con denegación por defecto: una ruta sin metadatos se rechaza.
- Expansión determinista de `manage`, `read`, `update` y `*` limitada al catálogo cerrado.
- `GET /me` con perfiles vigentes, permisos expandidos, `mfaEnabled`, `mustChangePassword` y `activeProfile`.
- `X-Perfil-Activo` no concede permisos: solo desempata el perfil que otorga el permiso.

**Evidencia**

```text
authorization.guard.spec.ts      7/7
permissions.spec.ts              expansión y OR
me.service.spec.ts               2/2
authorization-matrix.spec.ts     contrato × 3 perfiles, 17 operaciones
```

**Límite:** AC-SEC-19 no tiene prueba multiperfil de extremo a extremo; AC-SEC-18 y AC-SEC-21 se difieren por falta de recursos propios y de frontend de C2.

### RB1-18 — Auditoría inmutable, corrección y meta-auditoría

**Hecho**

- `AuditModule` global con `AuditService`, `AuditRepository`, `AuditWriterFactory` y `AUDIT_PORT`.
- `KyselyAuditWriter` escribe sobre el ejecutor transaccional; un fallo de inserción lanza `AuditWriteError` (503 `SERVICE_UNAVAILABLE`) y revierte el cambio.
- `AuditRedactor`: secretos conocidos, email como HMAC, texto libre como metadatos, truncamiento > 8 KB con hash y límite de profundidad.
- `GET /audit/events` con filtros validados, paginación y meta-auditoría `auditoria.consultada` con `request_id`, IP y user-agent.
- `auditService.correct()` registra `auditoria.correccion` con justificación y referencia al evento original.

**Evidencia**

```text
audit-redactor.spec.ts           4/4
audit-query.spec.ts              4/4 (filtros, rango invertido, contexto)
problem-details.filter.spec.ts   503 y Retry-After
Integración: AC-AUD-05/06/07/10/12 contra PostgreSQL real
```

**Límite:** AC-AUD-03/04 cubren identidad y `usuario.listado`; el resto de módulos llega en C4.

### RB1-19 — Identidades temporales y semillas

**Hecho**

- `pnpm --filter @ccltpg/api db:seed` (`src/database/seeds/run.ts`): exige `DATABASE_MIGRATOR_URL`, se niega en producción y acepta `SEED_PASSWORD`, `SEED_ADMIN_EMAIL` y `SEED_TEMPORAL`.
- `seedIdentity()` idempotente con UUIDv5: catálogo de permisos, tres perfiles, administrador con `debe_cambiar_password` e identidad temporal de educador a 30 días.
- `requiresMfa()` exige MFA si el perfil lo pide o si `valid_until` no es nulo.
- Transiciones de estado y revocación de familias al desactivar o vencer perfiles.

**Evidencia**

```text
Integración: semilla idempotente, identidad temporal, AC-SEC-06 y AC-SEC-11
```

## 3. Archivos principales añadidos

| Área | Archivos |
| --- | --- |
| Base de datos | `migrations/public/0001…0003`, `schema.ts`, `seeds/identity.seed.ts`, `seeds/run.ts`, `audit/kysely-audit.writer.ts` |
| Dominio identidad | `identity.types.ts`, `login-state.ts`, `password-policy.ts`, `permissions.ts`, `perfiles.ts` |
| Aplicación identidad | `auth-state`, `login`, `mfa`, `password`, `session`, `me`, `identity-admin`, `auth-error`, `rate-limits` |
| Puertos | `clock`, `field-encryption`, `identity.repository`, `password-hasher`, `rate-limiter`, `session-cache`, `session.repository`, `token.service`, `totp.service`, `unit-of-work` |
| Infraestructura | Repositorios Kysely, Argon2, JWT `jose`, TOTP RFC, AES-GCM, Redis y reloj |
| API identidad | `auth.controller`, `me.controller`, `identity.controller`, DTOs, cookies, CSRF y guard |
| Auditoría | `audit.module`, `audit.controller`, `audit.service`, repositorio, fábrica y DTO |
| Compartido | `auth/*`, `audit/*`, `security/{base32,totp,hmac,encryption}`, `http/request-context`, errores |
| Pruebas | `test/api/{authorization-matrix,audit-query}.spec.ts`, `test/integration/identity-flow.spec.ts` y unitarias de módulos |
| Contrato | `events.json`, `public-routes.json`, `openapi.json`, validador y pruebas |

## 4. Verificación final ejecutada

| Comando | Resultado |
| --- | --- |
| `pnpm format:check` | Todos los archivos aplicables cumplen Prettier |
| `pnpm typecheck` | API y web sin errores |
| `pnpm lint` | Sin errores ni advertencias |
| `pnpm test` | API: **17 archivos / 129 pruebas**; web: **1 archivo / 3 pruebas** |
| `pnpm --filter @ccltpg/api build` | `nest build` correcto |
| `pnpm arch:check` | Sin violaciones (131 módulos, 405 dependencias) |
| `pnpm test:architecture` | **3 pruebas** verdes |
| `pnpm test:integration` + PostgreSQL 16 real | **3 archivos / 24 pruebas** verdes |
| `pnpm contracts:validate` | 17 operaciones, 4 públicas, 60 eventos |
| `pnpm contracts:lint` | Sin errores Spectral |
| `pnpm test:contracts` | **11 pruebas** verdes |
| `pnpm security:secrets` | Sin hallazgos |
| `pnpm test:security` | **6 pruebas** verdes |
| `pnpm audit --prod --audit-level critical` | Sin vulnerabilidades conocidas |
| `pnpm audit --audit-level high` | Sin vulnerabilidades conocidas |
| Validación YAML del pipeline | 4 jobs; **no ejecutado en GitHub** |

## 5. Correcciones aplicadas durante la ejecución

1. **Kysely 0.29.9:** `addIndex` dentro de `createTable` solo funciona en MySQL; los índices se crean con `db.schema.createIndex(...)`.
2. **`tsx` no emite `emitDecoratorMetadata`:** controladores y guard usan `@Inject(Token)` explícito y DTOs sin dependencia circular.
3. **`dependency-cruiser` 18.8.0:** no comparte grupos de captura entre `from` y `to`; el aislamiento se genera como reglas `contexto-<from>-no-importa-<to>` desde el sistema de archivos. `contextos-aislados` se retiró.
4. **Escáner de secretos:** se excluyen variables de psql (`:'app_password'`) y credenciales efímeras `ccltpg_test_*`; se añadió una prueba de regresión.
5. **Auditoría transaccional:** se creó `AuditWriteError` para mapear el fallo de inserción a 503 y se propagó el `RequestContext` a `AuditService.query` para que la meta-auditoría tenga `request_id`, IP y user-agent.
6. **Contrato:** se añadieron descripciones a las operaciones de autenticación e identidad, los 4 tags globales y `x-allow-anonymous`; se regeneró `openapi.json`.
7. **Pruebas:** se corrigieron aserciones innecesarias y tipos en `auth-cookies.spec.ts`, `csrf.service.spec.ts`, `jose-token.service.spec.ts`, `audit-query.spec.ts` e `identity-flow.spec.ts` para que `typecheck` y `lint` queden limpios.
8. **Auditoría duplicada en cambio de contraseña parcial:** el flujo registraba `usuario.password_cambiada` dos veces. Se unificó en una sola escritura transaccional con `via: 'pwd_change' | 'session'` y se añadió una aserción de conteo exacto, además de aserciones explícitas para `sesion.mfa_verificada`, `sesion.refresh_reutilizado` y `sesion.cerrada`.

## 6. Decisiones pendientes y desviaciones

| Decisión | Estado | Qué falta |
| --- | --- | --- |
| D41…D48 | Aplicadas | Ratificación formal del equipo |
| `argon2@0.45.2` y `jose@6.2.18` | Aplicadas y fijadas | Ratificación de dependencias |
| R-030 / migración `0003` | Aplicada como propuesta | Ratificación de Rol A |
| `usuario.listado` en el catálogo | Aplicado | Ratificación del catálogo |
| `x-allow-anonymous` | Aplicado | Ratificación del contrato |
| AC-SEC-01 (rutas parciales y logout anónimo) | Aplicado | Ratificar la semántica |
| AC-SEC-22 (`manage` expandido) | Aplicado | Ratificar la semántica |
| Reglas de arquitectura dinámicas | Aplicado | Ratificación como cambio de herramienta |
| Secretos `ccltpg_ci_*` → `ccltpg_test_*` | Aplicado | Ratificación como cambio de CI |
| Reset administrativo de MFA | Implementado en `PATCH /identity/users/{id}` con `resetMfa` | Decidir en C4 si revoca sesiones de forma atómica |
| Retención de 5 años | No implementada | C5/C8 |
| Docker / MinIO / CI en GitHub / acta C0/C1 | Bloqueados | Acciones externas al código |

## 7. Deuda y siguiente paso

- Publicar la rama y ejecutar el pipeline en GitHub Actions.
- Ejecutar Compose en un entorno con Docker y adjuntar `docker compose ps`; resolver el 401 de MinIO.
- Ratificar D41…D48, las dependencias, R-030/0003, el catálogo y la semántica de AC-SEC-01/22.
- Añadir prueba de límites con reloj simulado (AC-SEC-14) y prueba multiperfil (AC-SEC-19) cuando existan recursos de ámbito.
- Implementar idempotencia de creación (AC-SEC-30) y recursos propios (AC-SEC-18) en C4.
- Confirmar en CI que `pnpm audit` sigue sin reportar `picomatch` y cerrar la excepción de C1 si coincide.
- Abrir C3 solo con la compuerta 2 firmada y las condiciones P0 de C0 resueltas o aceptadas formalmente.
