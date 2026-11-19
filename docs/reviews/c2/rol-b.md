# Paquete de revisión — Compuerta 2 (Rol B)

- **Rol:** B — Seguridad, identidad y operación
- **Compuerta:** C2 — Identidad, RBAC y auditoría
- **Estado:** **Ejecutada con límites de evidencia.** RB1-15…RB1-19 están implementados y verificados localmente; quedan bloqueos externos (Docker, MinIO, CI en GitHub, acta C0/C1) y ratificaciones formales pendientes.
- **Plan asociado:** `docs/tasks/rol-b/rol-b-it2-plan.md`
- **Registro de ejecución:** `docs/tasks/rol-b/rol-b-it2-registro.md`
- **Regla:** no se marca ningún criterio como cumplido sin evidencia enlazada.

## 1. Alcance entregado frente al planificado

| Tarea | Entregable | Estado | Evidencia |
| --- | --- | --- | --- |
| RB1-15 | Migraciones del núcleo y auditoría de solo inserción | **Cumplido** | Migraciones `0001`–`0003`; `up/down/up` sobre PostgreSQL 16 real; `db-roles.spec.ts` (5 pruebas) |
| RB1-16 | Autenticación: login, MFA, refresh, logout y cambio de contraseña | **Cumplido con límites** | 16 pruebas de integración de identidad; unitarias de Argon2, JWT, TOTP, cookies, CSRF y política de contraseñas; AC-SEC-14 parcial (ver §4.3) |
| RB1-17 | RBAC con denegación por defecto y `/me` | **Cumplido con límites** | Guard global, `@RequirePermissions`, matriz contrato × perfiles (17 operaciones); AC-SEC-19 parcial y AC-SEC-21 delegado a Rol C |
| RB1-18 | Auditoría inmutable, corrección y meta-auditoría | **Cumplido** | Trigger de solo inserción, privilegios de `ccltpg_app`, `auditoria.correccion`, `auditoria.consultada`, rollback con 503 |
| RB1-19 | Ciclo de vida de identidades temporales y semillas | **Cumplido** | `pnpm db:seed` idempotente (UUIDv5); perfiles, permisos, administrador inicial e identidad temporal; revocación por perfil vencido |

**No se modificó** `docs/diseno-arquitectonico.md` ni `docs/vision-alcance.md`. Tampoco se editó el diccionario de Rol A: los cambios de modelo se registran como propuesta de cambio (§2.4).

## 2. Decisiones y supuestos con reversibilidad

### 2.1 Decisiones D41…D48 aplicadas

El usuario aprobó el bloque D41…D48; la firma formal del equipo queda pendiente (ver §9). El repositorio no asigna numeración individual a cada fila, así que las decisiones se describen por contenido.

| Decisión | Elección aplicada | Reversibilidad | Consecuencia |
| --- | --- | --- | --- |
| Hash de contraseñas | Argon2id `m=19456 KiB, t=2, p=1`, PHC v2; rehash si suben los parámetros | Media (requiere rehash progresivo) | AC-SEC-03 cubierto; semilla y verificación usan la misma configuración |
| Access token | JWT `HS256` con `kid`, 900 s, sin email, nombre, perfiles, permisos ni PII | Costosa (contrato congelado en C2) | AC-SEC-08 cubierto; rotación con `JWT_SECRET_CURRENT`/`PREVIOUS` |
| Refresh token | 7 días absolutos, rotación por uso, revocación de familia completa al reutilizar | Costosa | AC-SEC-09 cubierto; `sesion.refresh_reutilizado` auditado |
| Cookies | `__Host-`, `Secure`, `SameSite=Strict`, `Path=/`; refresh `HttpOnly`; sin `Domain` | Costosa | AC-SEC-12 cubierto |
| CSRF | `X-CSRF-Token` obligatorio en mutaciones con sesión; 403 `AUTH_CSRF_INVALID` | Media | AC-SEC-13 cubierto; `refresh` valida CSRF manualmente por ser pública |
| Bloqueo | 5 fallos de contraseña en 15 min bloquean la cuenta; el login sigue con 401; desbloqueo administrativo auditado | Barata | AC-SEC-05 cubierto; umbral en `MAX_PASSWORD_FAILURES` |
| Política de contraseña | 12–128 caracteres Unicode, lista de comunes, sin parte local del email, sin composición ni rotación periódica | Barata | AC-SEC-04 cubierto |
| MFA | Obligatorio por perfil y por identidad temporal; TOTP RFC 6238 + 10 códigos de recuperación de un solo uso | Media | AC-SEC-06/07 cubiertos; TOTP implementado con `node:crypto` |
| Throttling | Límites por IP, email, token MFA, usuario y API general; 429 con `Retry-After` | Barata | AC-SEC-14 parcial: valores provisionales de PA-009 |
| Cifrado | AES-256-GCM con AAD para el secreto MFA; HMAC-SHA256 para email y documento | Media | Protege el segundo factor; AC-SEC-24 completo (PII académica) es C4 |
| Errores | Códigos estables de `AUTH_ERRORS` y Problem Details con `requestId` | Barata antes de congelar | AC-SEC-29 cubierto |

Se aplicaron además las decisiones ya ratificadas del C1 (D28, D33, D34, D36, D37, D38, D39 y D40): contrato code-first, `zod`, `openapi-fetch`, generación JSON, `dependency-cruiser`, pnpm global y filtro propio de Problem Details.

### 2.2 Dependencias nuevas

| Dependencia | Versión exacta | Uso | Estado |
| --- | --- | --- | --- |
| `argon2` | `0.45.2` | Hash Argon2id | Instalada y fijada; **pendiente de ratificación formal** |
| `jose` | `6.2.18` | Firma y verificación JWT HS256 con `kid` | Instalada y fijada; **pendiente de ratificación formal** |

TOTP se implementó con `node:crypto` (RFC 6238) en lugar de añadir `otplib`: menos superficie de dependencias y la prueba RFC 6238 valida los vectores conocidos.

### 2.3 Cambios de contrato y de catálogo

1. **`x-allow-anonymous`:** se añadió al contrato para documentar que `logout` es idempotente sin sesión. La operación sigue declarando `x-access: authenticated`; el guard la permite sin token y responde 204.
2. **`usuario.listado`:** se añadió al catálogo documental de auditoría (`docs/contratos/modelo-auditoria-v1.md` §3.2) para que la consulta de PII de `GET /identity/users` tenga evento propio. Requiere ratificación.
3. **Plantillas de evento:** el validador admite `usuario.<estado>` en `transitionUser` si todas sus expansiones existen en el catálogo (`usuario.activado`, `usuario.desactivado`, `usuario.bloqueado`, `usuario.desbloqueado`, `usuario.perfil_revocado`).
4. **Operaciones `partial`/`partial_or_session`:** el validador las exime de exigir el esquema `security` porque se autentican con token parcial en el cuerpo o con sesión, no con `Bearer`.

### 2.4 Propuesta de cambio para Rol A (equivalente a R-030)

La migración `0003_complete_identity_model.ts` añade dos piezas que el diccionario §2.1–2.6 no recogía:

1. `usuario.debe_cambiar_password` — necesaria para AC-SEC-15.
2. `codigo_recuperacion_mfa` — necesaria para los 10 códigos de un solo uso de AC-SEC-07.

También añade índices de búsqueda de sesión (`usuario_perfil.usuario_id`, `refresh_token.token_hash` único, `familia_id`, `usuario_id + familia_id`). **No se editó el diccionario**: el cambio queda registrado aquí y en el registro de ejecución para que Rol A lo ratifique como extensión de R-030.

### 2.5 Desviaciones que requieren decisión del equipo

1. **Semántica de AC-SEC-01:** la matriz acepta token parcial en `mfa/verify`, `mfa/enroll`, `mfa/enroll/confirm` y `password`; son operaciones `partial`/`partial_or_session` y no sesiones completas. `logout` acepta llamada anónima idempotente. Se propone ratificar esta lectura; el texto literal del criterio solo nombra tres rutas públicas.
2. **Semántica de AC-SEC-22:** `/me` devuelve permisos expandidos y sin `*`, pero incluye permisos del catálogo cuya acción es `manage` (`identity:user:manage`, `academic:program:manage`, etc.). Se propone ratificar que «sin `manage`» significa «sin comodines ni concesiones implícitas», no «sin permisos cuyo nombre termina en `manage`».
3. **Reglas de arquitectura dinámicas:** `dependency-cruiser` no comparte grupos de captura entre `from` y `to`, así que el aislamiento entre contextos se materializa como un par de reglas por contexto, generadas desde `apps/api/src/modules`. `contextos-aislados` se retiró porque no soporta backreferences.
4. **Secretos de CI:** se renombraron de `ccltpg_ci_*` a `ccltpg_test_*` para que el escáner los trate como credenciales efímeras de prueba y no como secretos reales.

## 3. Preguntas abiertas

- **Acta de C0/C1:** sigue sin existir. Sin acta no se puede declarar C2 cerrada formalmente.
- **Docker:** el host Windows no autentica contra el contenedor Compose (`28P01`); la evidencia se produjo con PostgreSQL 16 embebido en el puerto 55432.
- **MinIO:** `quay.io/minio/minio:latest` devuelve 401; Compose completo no arranca.
- **CI en GitHub:** el workflow existe y se validó localmente, pero no se ha ejecutado en GitHub.
- **Ratificación de dependencias:** `argon2@0.45.2` y `jose@6.2.18`.
- **Ratificación de R-030/0003**, del evento `usuario.listado`, de `x-allow-anonymous` y de la semántica de AC-SEC-01/AC-SEC-22.
- **PA-009/PA-011:** los valores de throttling son provisionales (`RATE_LIMITS`) y la retención de 5 años no está implementada; se ajustan en C5.
- **Reset de MFA:** existe en `PATCH /identity/users/{id}` con `resetMfa: true` (auditado como `usuario.mfa_reset`), pero no revoca sesiones por sí solo. El runbook exige combinarlo con el reset de contraseña o con una transición de estado; se evalúa si C4 lo hace atómico.
- **AC-SEC-18/21/30:** pertenecen a recursos propios, frontend e idempotencia de creación; no hay recursos de negocio en C2. Se difieren a C4 con la API ya denegando por defecto.

## 4. Informe de pruebas y matriz

### 4.1 Comandos ejecutados (19 de noviembre de 2026)

| Prueba | Comando | Resultado |
| --- | --- | --- |
| Formato | `pnpm format:check` | Todos los archivos aplicables cumplen Prettier |
| Tipos | `pnpm typecheck` | `@ccltpg/api` y `@ccltpg/web` sin errores |
| Lint | `pnpm lint` | Ambos paquetes sin errores ni advertencias |
| Unitarias API | `pnpm test` | **17 archivos / 129 pruebas** verdes |
| Unitarias web | `pnpm test` | **1 archivo / 3 pruebas** verdes |
| Build API | `pnpm --filter @ccltpg/api build` | `nest build` correcto |
| Arquitectura | `pnpm arch:check` | Sin violaciones (131 módulos, 405 dependencias) |
| Arquitectura (prueba) | `pnpm test:architecture` | **3 pruebas** verdes, con violaciones deliberadas detectadas |
| Integración | `pnpm test:integration` + PostgreSQL 16 real | **3 archivos / 24 pruebas** verdes |
| Contrato | `pnpm contracts:validate` | 17 operaciones, 4 públicas, 60 eventos |
| Spectral | `pnpm contracts:lint` | Sin errores |
| Validador | `pnpm test:contracts` | **11 pruebas** verdes |
| Secretos | `pnpm security:secrets` | Sin hallazgos |
| Escáner (pruebas) | `pnpm test:security` | **6 pruebas** verdes |
| SCA | `pnpm audit --prod --audit-level critical` | Sin vulnerabilidades conocidas |
| SCA completo | `pnpm audit --audit-level high` | Sin vulnerabilidades conocidas; `picomatch@4.0.7` sigue instalado como dependencia dev |
| CI | validación YAML | 4 jobs; **no ejecutado en GitHub** |
| Compose | `docker compose ps` | **No ejecutado**: Docker/MinIO con bloqueos de entorno |

### 4.2 Matriz de autorización

La prueba `apps/api/test/api/authorization-matrix.spec.ts` lee el OpenAPI generado y somete cada operación al guard real con los tres perfiles de la semilla:

- **17 operaciones** cubiertas exactamente; una operación nueva sin caso permitido/denegado hace fallar la prueba.
- **6 operaciones con permiso** (`listAuditEvents`, `listUsers`, `createUser`, `updateUser`, `transitionUser`, `assignProfile`): cada una tiene al menos un caso permitido y uno denegado con 403 `PERMISSION_DENIED`.
- Rutas públicas: acceso sin credenciales permitido.
- Rutas `partial`: token del ámbito correcto permitido; sin token o con ámbito distinto, 401.
- `authenticated`: sesión completa permitida; sin sesión, 401.
- Denegación por defecto: una ruta sin metadatos falla en la prueba del guard.

### 4.3 Criterios AC-SEC

| Criterio | Estado | Evidencia / límite |
| --- | --- | --- |
| AC-SEC-01 | **Cumple con matiz** | Matriz contrato-driven y guard; rutas parciales y `logout` anónimo requieren ratificar la semántica (§2.5) |
| AC-SEC-02 | **Cumple** | Integración: email inexistente y contraseña incorrecta devuelven `AUTH_INVALID_CREDENTIALS` |
| AC-SEC-03 | **Cumple** | `argon2-password-hasher.spec.ts`: PHC versionado, parámetros y rehash |
| AC-SEC-04 | **Cumple** | `password-policy.spec.ts`: bordes 12/128, comunes y parte local del email |
| AC-SEC-05 | **Cumple** | Integración: cinco fallos bloquean la cuenta y emiten `usuario.bloqueado` |
| AC-SEC-06 | **Cumple** | Integración: administrador, educador, estudiante e identidad temporal |
| AC-SEC-07 | **Cumple** | Integración: 10 códigos, consumo único, reutilización 401 y regeneración invalidante |
| AC-SEC-08 | **Cumple** | `jose-token.service.spec.ts`: HS256, `kid`, 900 s y payload sin PII |
| AC-SEC-09 | **Cumple** | Integración: rotación y revocación de familia al reutilizar |
| AC-SEC-10 | **Cumple** | Integración: logout idempotente con y sin token |
| AC-SEC-11 | **Cumple** | Integración: desactivación y perfiles vencidos revocan familias y cortan el acceso |
| AC-SEC-12 | **Cumple** | `auth-cookies.spec.ts`: atributos completos y borrado con los mismos atributos |
| AC-SEC-13 | **Cumple con límite** | `csrf.service.spec.ts` y guard; no hay prueba HTTP extremo a extremo de una mutación con cookie real |
| AC-SEC-14 | **Parcial** | `Retry-After` y códigos probados en el filtro; los límites con reloj simulado no se ejercitan de extremo a extremo |
| AC-SEC-15 | **Cumple** | Guard: con `debe_cambiar_password` solo pasan `GET /me`, `password`, `logout` y `refresh` |
| AC-SEC-16 | **Cumple** | Validador de contrato y matriz: toda operación declara `x-access`, `x-permission`, `x-scope` y `x-audit-event` |
| AC-SEC-17 | **Cumple** | Matriz: cada operación con permiso tiene caso permitido y denegado con `PERMISSION_DENIED` |
| AC-SEC-18 | **No aplica en C2** | No hay recursos propios ni de grupo; se difiere a C4 |
| AC-SEC-19 | **Parcial** | `resolvePrincipal` valida perfil vigente y `X-Perfil-Activo`; falta prueba multiperfil de extremo a extremo |
| AC-SEC-20 | **Cumple** | `permissions.spec.ts`: expansión determinista, sin comodines ni acciones inventadas |
| AC-SEC-21 | **Parcial** | El backend deniega sin permiso (matriz); la navegación desde `/me` es de Rol C |
| AC-SEC-22 | **Cumple con matiz** | `me.service.spec.ts`: permisos expandidos, sin `*`, solo perfiles vigentes y banderas; matiz de `manage` en §2.5 |

### 4.4 Criterios AC-AUD

| Criterio | Estado | Evidencia / límite |
| --- | --- | --- |
| AC-AUD-01 | **Cumple** | Validador bidireccional y matriz; el cambio de contraseña registra un único `usuario.password_cambiada` |
| AC-AUD-02 | **Cumple** | Integración con aserciones de `sesion.credenciales_verificadas`, `sesion.mfa_verificada`, `sesion.refresh_reutilizado`, `sesion.cerrada` y bloqueo, con actor, IP y `requestId` |
| AC-AUD-03 | **Parcial** | Identidad cubierta (alta, modificación, transición, perfil); el resto de módulos es C4 |
| AC-AUD-04 | **Parcial** | `usuario.listado` audita la consulta de PII; descargas y listados académicos son C3/C4 |
| AC-AUD-05 | **Cumple** | Integración: campos obligatorios, `ocurrido_en` en UTC y `request_id` |
| AC-AUD-06 | **Cumple** | Integración: `UPDATE`, `DELETE` y `TRUNCATE` fallan; privilegios de `ccltpg_app` inspeccionados |
| AC-AUD-07 | **Cumple** | Integración: `auditoria.correccion` referencia el evento original y no lo edita |
| AC-AUD-08 | **Cumple** | `audit-redactor.spec.ts` e integración: sin contraseñas, tokens, códigos, secretos MFA ni PII |
| AC-AUD-09 | **Cumple** | Redactor: `{"cambiado": true}`, email como HMAC y truncamiento con hash > 8 KB |
| AC-AUD-10 | **Cumple** | Integración: trigger de fallo forzado, rollback del cambio y 503 `SERVICE_UNAVAILABLE` |
| AC-AUD-11 | **Cumple** | Matriz (solo `audit:event:read`) y `audit-query.spec.ts` (400 fuera de rango) |
| AC-AUD-12 | **Cumple** | Integración: `auditoria.consultada` con filtros y total, sin copiar filas |
| AC-AUD-13 | **Cumple** | Validador CI: `x-audit-event` debe existir y todo evento obligatorio debe estar referenciado |

### 4.5 Compuerta 2 (diseño §18.1)

| Condición | Resultado |
| --- | --- |
| Intentos manuales de escalada de privilegios | La matriz ejecuta el guard real con los tres perfiles; un perfil sin permiso recibe 403. No se hizo prueba manual adicional. |
| Rutas sin decorador rechazadas por prueba | El guard deniega por defecto y la matriz falla si una operación no declara metadatos. |
| Auditoría inalterable por el rol de aplicación | Trigger + revocación de `UPDATE`/`DELETE`/`TRUNCATE`; probado contra PostgreSQL real. |

## 5. Guion de demostración reproducible

1. `pnpm install --frozen-lockfile` con Node 22.19+ y pnpm 9.15.4.
2. Copiar `infra/compose/.env.example` a `infra/compose/.env` y cambiar contraseñas.
3. `pnpm infra:up` y confirmar PostgreSQL y Redis sanos. **(Requiere Docker; MinIO sigue bloqueado en esta máquina.)**
4. Copiar `.env.example` a `.env` y alinear URLs, `JWT_SECRET_CURRENT`, `MFA_ENCRYPTION_KEY` y `EMAIL_HMAC_KEY`.
5. `pnpm migrate:status` y `pnpm migrate:up`.
6. `SEED_PASSWORD='<clave fuerte>' pnpm --filter @ccltpg/api db:seed`.
7. `pnpm dev`; abrir `http://localhost:5173/estado`.
8. `POST /api/v1/auth/login` con el administrador sembrado: debe responder `password_change_required`.
9. `POST /api/v1/auth/password` con el token parcial: debe pasar a `mfa_enrollment_required`.
10. `POST /api/v1/auth/mfa/enroll` y `POST /api/v1/auth/mfa/enroll/confirm`: entrega 10 códigos una sola vez y sesión completa.
11. `GET /api/v1/me`: permisos expandidos y banderas.
12. `GET /api/v1/audit/events?accion=usuario.creado` con el administrador: 200 y evento `auditoria.consultada`; repetir sin permiso: 403.
13. Ejecutar `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
14. Ejecutar `pnpm arch:check`, `pnpm test:architecture`, `pnpm contracts:validate`, `pnpm contracts:lint`, `pnpm test:contracts`, `pnpm test:security` y `pnpm security:secrets`.
15. Con PostgreSQL real: `pnpm test:integration` (24 pruebas).

## 6. Diferencias (tablas, rutas, permisos, migraciones, dependencias)

- **Tablas:** `usuario`, `perfil`, `permiso`, `perfil_permiso`, `usuario_perfil`, `refresh_token`, `codigo_recuperacion_mfa` y `evento_auditoria`. Los historiales de Kysely siguen por esquema.
- **Rutas (17 operaciones):** `POST /auth/login`, `/auth/mfa/verify`, `/auth/mfa/enroll`, `/auth/mfa/enroll/confirm`, `/auth/mfa/recovery-codes`, `/auth/refresh`, `/auth/logout`, `/auth/password`; `GET /me`; `GET|POST /identity/users`; `PATCH /identity/users/{id}`; `POST /identity/users/{id}/transitions`; `POST /identity/users/{id}/profiles`; `GET /audit/events`; `GET /health/live` y `/health/ready`.
- **Permisos:** catálogo cerrado de 35 permisos; tres perfiles (`administrador`, `educador`, `estudiante`); `manage` y `*` se expanden antes de guardar y de devolver en `/me`.
- **Migraciones:** `0001_create_identity_core`, `0002_create_evento_auditoria`, `0003_complete_identity_model`; todas con `down` probado en `up/down/up`.
- **Contrato:** `openapi.json` regenerado con 17 operaciones, `x-allow-anonymous`, 4 tags globales y descripciones nuevas; `events.json` con 60 eventos; `public-routes.json` con 4 rutas públicas.
- **Dependencias añadidas:** `argon2@0.45.2` y `jose@6.2.18` (exactas). TOTP no añade dependencia.
- **Semilla:** `pnpm db:seed` con UUIDv5, idempotente y bloqueada en producción.
- **Frontend:** sin cambios funcionales de C2; la sesión real y la navegación desde `/me` quedan para Rol C.

## 7. Defectos y deuda técnica

| Deuda | Impacto | Destino |
| --- | --- | --- |
| Docker host → contenedor falla con `28P01`; MinIO no descargable | Alto para evidencia de Compose | Resolver red/credenciales o aceptar entorno alternativo |
| Pipeline no ejecutado en GitHub | Medio: valida configuración, no plataforma | Publicar rama y ejecutar CI |
| AC-SEC-14 sin prueba de límites extremo a extremo | Medio: el throttling está implementado pero no demostrado con reloj simulado | C2/C5, con prueba de carga |
| AC-SEC-19 sin prueba multiperfil extremo a extremo | Bajo: la lógica existe en `resolvePrincipal` | C4, al añadir recursos con ámbito |
| AC-SEC-18/21/30 diferidos | Medio: recursos propios, frontend e idempotencia | C4, con la API ya cerrada por defecto |
| `resetMfa` no revoca sesiones por sí solo | Medio: una sesión robada sigue activa hasta 15 min o hasta el siguiente refresh | El runbook combina reset de contraseña o transición; C4 puede hacerlo atómico |
| Retención de 5 años no implementada | Medio: PA-011 sin política ejecutable | C5/C8 |
| `picomatch@4.0.7` dev-only | Bajo: el registro ya no reporta el aviso | Confirmar en CI; cerrar excepción si coincide |
| Semilla con contraseña de demostración por defecto | Medio si se usa sin `SEED_PASSWORD` | Operación: exigir variable en entornos compartidos |
| Sin pruebas HTTP de cookies/CSRF de extremo a extremo | Bajo: unitarias y guard cubren la lógica | C4, con suite e2e |

## 8. Autoevaluación anti-deriva (diseño §19.2)

1. **¿Código accedió a partes internas o esquemas de otro contexto?** No. `shared` no importa módulos; identidad y auditoría se comunican por `AuditPort`; las reglas de `dependency-cruiser` se generan por contexto y pasan sin violaciones.
2. **¿Toda ruta nueva está protegida por permiso y probada permitida/denegada?** Sí. El guard deniega por defecto y la matriz cubre las 17 operaciones; las rutas parciales y públicas están declaradas y justificadas.
3. **¿Toda operación que cambia estado emite auditoría?** Sí, en la misma transacción. Las lecturas propias y `refresh` están exentas con justificación en el contrato.
4. **¿Todo campo de estado nuevo tiene máquina de estados y transiciones probadas?** `usuario.estado` tiene transiciones auditadas (`usuario.<estado>`) y `debe_cambiar_password` se prueba en el flujo de login.
5. **¿Las migraciones se mantienen en un solo esquema y pasan `up/down/up`?** Sí, contra PostgreSQL 16 real; `0003` es una propuesta de cambio registrada, no una edición del diccionario.
6. **¿Se modificó algún artefacto congelado?** No se editó el diseño ni la visión. Se editó `docs/contratos/modelo-auditoria-v1.md` para añadir `usuario.listado`, registrado para ratificación.
7. **¿Se agregó alguna dependencia fuera de las decisiones registradas?** Sí: `argon2` y `jose`, fijadas y registradas en §2.2.
8. **¿Existe lógica de pagos o contabilidad?** No.
9. **¿Hay reglas sin trazabilidad a requisito o supuesto?** Cada criterio se enlaza a AC-SEC/AC-AUD; las desviaciones y los valores provisionales están en §2.5 y §3.
10. **¿Las garantías de solo inserción están en la base y no solo en el código?** Sí: trigger `BEFORE UPDATE OR DELETE` y `BEFORE TRUNCATE`, más revocación de privilegios al rol de aplicación.
11. **¿Alguna prueba se omitió o simuló ocultando comportamiento real?** Las de integración se omiten si faltan variables, pero se ejecutaron 24 contra PostgreSQL 16 real. Los dobles se usan para I/O y reloj, no para reglas de negocio.
12. **¿Documentación, OpenAPI y diccionario coinciden con el código?** OpenAPI se regenera desde el código y se valida. El diccionario no incluye aún `debe_cambiar_password` ni `codigo_recuperacion_mfa`: está registrado como propuesta para Rol A.

## 9. Solicitud de firma

| Firmante | Qué aprueba | Estado |
| --- | --- | --- |
| Rol B | Identidad, RBAC, auditoría, migraciones, semillas y runbooks de C2 | Pendiente |
| Equipo | D41…D48 (aprobadas por el usuario), `argon2@0.45.2` y `jose@6.2.18` | Aprobadas; firma formal pendiente |
| Rol A | Extensión R-030: `debe_cambiar_password` y `codigo_recuperacion_mfa` | Pendiente |
| Equipo | `usuario.listado` en el catálogo y `x-allow-anonymous` en el contrato | Pendiente |
| Equipo | Semántica de AC-SEC-01 (rutas parciales y logout anónimo) y AC-SEC-22 (`manage` expandido) | Pendiente |
| Equipo | Compuerta 2, con Docker, MinIO y CI en GitHub pendientes | Pendiente |
