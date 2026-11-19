# Plan de trabajo — Iteración 2 (Rol B)

- **Fecha:** 18 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Iteración objetivo:** **C2 — Identidad, RBAC y auditoría** (Release 1.0)
- **Estado:** **Ejecutado con límites de evidencia.** Plan aprobado por el usuario el 18 de noviembre de 2026; la ejecución y sus límites se documentan en `docs/tasks/rol-b/rol-b-it2-registro.md` y `docs/reviews/c2/rol-b.md`.
- **Plan predecesor:** `docs/tasks/rol-b/rol-b-it1-plan.md` (bloques RB1-01…RB1-14).
- **Paquete de revisión previo:** `docs/reviews/c1/rol-b.md`.
- **Requisitos:** `docs/requirements/seguridad.md` (CAR-07, CAR-12).
- **Diseño:** `docs/diseno-arquitectonico.md` (§18.1, §18.3, §19).

## 1. Objetivo de la iteración

Retirar del riesgo de seguridad los fallos que la Iteración 1 dejó intencionales para C1 y que la Compuerta 2 exige evidenciar:

1. **Migraciones del núcleo** (usuario, perfil, permiso, usuario_perfil, refresh_token, evento_auditoria con solo inserción).
2. **Autenticación con MFA y refresh rotativo** (login, MFA, refresh, logout, cambio de contraseña).
3. **Motor de permisos** con decorador y denegación por defecto (RBAC).
4. **Auditoría inmutable** y ciclo de vida de identidades temporales.
5. **Datos semilla** y **interfaz mínima de administración** desde la perspectiva de seguridad.

## 2. Criterios de salida de C2 (de los criterios verificables)

Según `docs/requirements/seguridad.md` y la definición de terminado de la compuerta:

| Condición | Criterios |
| --- | --- |
| **C2 se considera completa** cuando | AC-SEC-01…AC-SEC-22 **y** AC-AUD-01…AC-AUD-13 tienen evidencia; la matriz de autorización pasa con **100 %** de operaciones con caso permitido y denegado; la inmutabilidad de auditoría está probada. |
| **Compuerta 2 (diseño §18.1)** | 1. Intentos manuales de escalada de privilegios. 2. Rutas sin decorador rechazadas por prueba. 3. Auditoría inalterable por el rol de aplicación. |
| **Congelamiento en C2** | Se congelan: flujos de autenticación, modelo de tokens, semántica de RBAC y esquema de auditoría. |

Regla de bloqueo: sin evidencia, la compuerta no se aprueba, aunque el código funcione.

## 3. Alcance propuesto (tareas)

| Tarea propuesta | Contenido | Criterios que impulsa |
| --- | --- | --- |
| RB1-15 | Migraciones del núcleo + solo inserción (`evento_auditoria`) | AC-AUD-06, AC-SEC-31 |
| RB1-16 | Autenticación (login, MFA, refresh, logout, password change) | AC-SEC-01…14, AC-SEC-22; AC-AUD-02…05 |
| RB1-17 | Motor de permisos (decorador, guard, denegación por defecto, `/me`) | AC-SEC-16…22, AC-B-01…14; AC-AUD-03, AC-AUD-11 |
| RB1-18 | Auditoría inmutable, corrección y meta-auditoría | AC-AUD-01…10, AC-AUD-13; AC-SEC-26, AC-SEC-29, AC-SEC-30 |
| RB1-19 | Ciclo de vida de identidades temporales y semillas | AC-SEC-11; AC-B-06…07; AC-AUD-03 |

Tareas de frontend/admin se delegan a Rol C con criterios de seguridad predefinidos (AC-SEC-21, AC-SEC-18); el Rol B valida desde la API.

## 4. Decisiones propuestas para C2 (con recomendación)

| Decisión | Propuesta | Recomendación |
| --- | --- | --- |
| Argon2id | m=19456 KiB, t=2, p=1, PHC v2 | **A — fijado en el catálogo** (AC-SEC-03) |
| Access token JWT | HS256, `kid`, 900 s, sin PII/permisos | **A — fijado** (AC-SEC-08) |
| Refresh token | 7 días, rotación por uso, revocación de familia en reutilización | **A — fijado** (AC-SEC-09, AC-AUD-02) |
| Cookies | `__Host-`, `Secure`, `SameSite=Strict`, `HttpOnly`, `Path=/`, sin `Domain` | **A — fijado** (AC-SEC-12) |
| CSRF | `X-CSRF-Token` obligatorio en mutaciones autenticadas; 403 `AUTH_CSRF_INVALID` | **A — fijado** (AC-SEC-13) |
| Bloqueo | 5 intentos fallidos / 15 min → bloqueo | **A — fijado** (AC-SEC-05) |
| Política de contraseña | 12–128 caracteres, anti-comunes, anti-email-local, sin rotación forzada | **A — fijado** (AC-SEC-04) |
| MFA | Obligatorio según perfil; TOTP + 10 recuperaciones de un solo uso | **A — fijado** (AC-SEC-06, AC-SEC-07) |
| Throttling / 429 | `Retry-After` con códigos estables | **A — fijado** (AC-SEC-14) |
| Cifrado | AES-256-GCM con AAD; documento por `numero_documento_hash` (HMAC-SHA256) | **A — fijado** (AC-SEC-24, AC-SEC-25) |
| Errores | Códigos estables (`AUTH_INVALID_CREDENTIALS`, `AUTH_MFA_...`, `PERMISSION_DENIED`, `RESOURCE_NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED`, `AUTH_PASSWORD_CHANGE_REQUIRED`) | **A — fijado** (AC-SEC-16, AC-SEC-29) |

## 5. Requisitos que deben cerrarse antes de iniciar C2

1. Acta de C0/C1 o su equivalente (bloquea el inicio formal).
2. Ratificación de D28, D33, D34, D36, D37, D38, D39, D40 y de las decisiones nuevas D41…D48 propuestas.
3. Ratificación de las dependencias nuevas para C2: Argon2id, JWT (jose), TOTP/recuperación, throttling.
4. RC-A-01…04 (diccionario/modelo) y RC-C-01…04 (contratos de auth) ratificados.
5. Docker instalado o aceptación de ejecución en otro entorno (para migraciones reales y CI de integración).

## 6. Plan de fases propuesto

1. **Fase 1 — Fundaciones:** migraciones del núcleo, tabla de auditoría con solo inserción, triggers/roles de inmutabilidad, tests `up/down/up` contra PostgreSQL real.
2. **Fase 2 — Autenticación:** endpoints públicos (`/auth/login`, `/auth/mfa/verify`, `/auth/refresh`, `/auth/logout`, `/auth/password`), tokens, cookies, MFA, throttling, auditoría de eventos.
3. **Fase 3 — Permisos:** decorador `@RequirePermissions`, guard global con denegación por defecto, matriz, `/me`, tests permitido/denegado.
4. **Fase 4 — Auditoría y cierre:** inmutabilidad, corrección (`auditoria.correccion`), meta-auditoría, retención, integración con logs/trazas, verificación anti-deriva.
5. **Fase 5 — Preparación de compuerta:** paquete de revisión C2, runbooks nuevos (reset de MFA, revocación, password change), actualización del registro de ejecución.

## 7. Recomendaciones operativas para el Rol B en C2

- Seguir los patrones ya validados en C1: Problem Details con `code`, `@ApiContract`, `architecture` tests, métricas por evento, redacción de PII, `/metrics`.
- Mantener regla de arquitectura: sin lógica de negocio en controladores; el guard/decorador vive en capa de aplicación.
- Tests de autorización: todo par permitido/denegado de la matriz; rutas sin decorador rechazadas por prueba de contrato.
- Auditoría: escritura en la misma transacción; evento antes de responder; payloads sin PII; email como HMAC; payload ≤ 8 KB con resumen+hash.
- CI: agregar servicios si aplica y reutilizar jobs existentes (`quality`, `contracts`, `integration`, `security`).

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Modelo de datos cambia tras C2 | Congelamiento en C2; si aparece, se evalúa reinicio. |
| Error de RBAC/permiso | Matriz 100 % con pruebas permitido/denegado; auditoría de acceso. |
| Auditoría no inmutable | Trigger + rol app sin UPDATE/DELETE; pruebas T-AUD-01…05. |
| Secretos en tokens/logs | Redacción existente + nuevo para MFA/refresh; tests. |
| Throttling insuficiente | Valores PA-009 y tests con reloj simulado. |

## 9. Preguntas abiertas para decidir en C2

- Valores exactos de PA-009 (throttling), PA-010 (CSP), PA-011 (retención) y PA-016 (sellado).
- Criterios de compensación (`auditoria.correccion`) y política de retención (5 años).
- Mecanismo de reset de MFA y desbloqueo administrativo.
- Estrategia de rotación de secretos para JWT en C2 (ya preparada en `docs/runbook/rotacion-secretos.md`).

## 10. Próximos pasos sugeridos

1. Cerrar C1 (acta + CI en GitHub + Docker) o aceptar plan de cierre condicional.
2. Ratificar D41…D48 propuestas en C2.
3. Confirmar tareas de C2 antes de ejecutar.
4. Iniciar C2 sólo con aprobación explícita de la compuerta 2.

## 11. Fuentes

- `docs/requirements/seguridad.md`
- `docs/contratos/auth-v1.md`, `matriz-autorizacion-v1.md`, `modelo-auditoria-v1.md`, `controles-seguridad-v1.md`
- `docs/adr/ADR-0001…0004`
- `docs/diseno-arquitectonico.md` (§18.1, §18.3, §19.2, §19.4)
- `docs/tasks/rol-b/rol-b-it1-registro.md`
