# Baseline Rol A — regularización It0–It8 (C0–C8)

- **Fecha:** 2026-11-24
- **Rol:** A (Backend, dominio y datos)
- **Tipo:** verificación/regularización (no atribuye implementación retroactiva a Rol A)
- **Base revisada:** `main` = `origin/main` @ `2c35937` (árbol limpio al momento de la verificación)
- **Rango incorporado desde It0 Rol A:** `b74b19a..2c35937` (25 commits, 443 archivos)

## 1. Objetivo

Establecer la línea base real del Rol A frente al plan de iteraciones 0–8 y las compuertas C0–C8, antes de continuar con nueva implementación. Este documento distingue evidencia existente, entregables hechos por otros roles, brechas de trazabilidad Rol A y bloqueantes de gobernanza.

## 2. Fuentes revisadas

- Diseño/visión (solo lectura, congelados): `docs/diseno-arquitectonico.md`, `docs/vision-alcance.md` (sin cambios en `b74b19a..HEAD`).
- Contratos/propuestas: `docs/contratos/reconciliacion-c0.md` (R-001..R-017), `docs/contratos/reconciliacion-c0-rol-b.md` (R-018..R-031), `docs/contratos/gramatica-y-catalogo-permisos-v1.md`, `packages/contracts/openapi.json`, `docs/contratos/matriz-autorizacion-v1.md`, `docs/contratos/modelo-auditoria-v1.md`, `docs/contratos/auth-v1.md`, `packages/contracts/openapi.json`.
- Datos/gobernanza: `docs/diccionario-datos.md`, `docs/open-questions.md`, `docs/assumptions.md`, ADR-0001..0004.
- Evidencia de ejecución: `apps/api/package.json`, `apps/api/src/**`, `apps/api/test/**`, migraciones en `apps/api/src/database/migrations/{public,academic}`, `.github/workflows/ci.yml`, `infra/compose/docker-compose.yml`.
- Revisiones/planes: `docs/reviews/c0`..`c8`, `docs/tasks/rol-b/*`, `docs/tasks/rol-a/*`.

## 3. Verificación técnica ejecutada (2026-11-24)

Entorno: Node `v22.23.4`, pnpm `9.15.4` (toolchain disponible en `/home/athirtro/.local/lib/qwen-code/node/bin` + corepack shims). Docker no disponible en este entorno.

| Verificación | Comando | Resultado | Observación |
| --- | --- | --- | --- |
| Instalación | `pnpm install --frozen-lockfile` | **PASS** | Lockfile al día; 950 paquetes resueltos. |
| Lint workspace | `pnpm -r lint` | **PASS** | `@ccltpg/api` y `@ccltpg/web` lint OK. |
| Typecheck workspace | `pnpm -r typecheck` | **PASS** | `tsc --noEmit` (api) y `tsc -b` (web) OK. |
| Arquitectura backend | `pnpm --filter @ccltpg/api test:architecture` | **PASS** | 1 archivo, 3 pruebas. |
| Pruebas backend (unitarias/API) | `pnpm --filter @ccltpg/api test` | **PASS** | 33 archivos, 420 pruebas (resultado registrado en sesión de baseline). |
| Pruebas web | `pnpm --filter @ccltpg/web test` | **PASS** | 2 archivos, 15 pruebas; warnings de canvas/jsdom esperados en entorno sin canvas nativo. |
| Contratos | `pnpm test:contracts` | **PASS** | 14 pruebas, 0 fallos. |
| Integración backend | `pnpm --filter @ccltpg/api test:integration` | **PASS** | 6 archivos, 49 pruebas. Ejecutado con PostgreSQL 16-alpine y Redis 7.4-alpine en Docker, roles/esquemas inicializados con `infra/compose/postgres/init/00-roles.sql`. |
| Verificación migrador `up/down/up` en BD limpia | `tsx src/database/migrator/migrate.ts up/down/up` por esquema en `ccltpg_verify` | **PASS** | `public`: up (0001..0008), down (0008), up (0008). `academic`: up (0007..0010), down (0010), up (0010). `status` confirma todas aplicadas. |

**Conclusión técnica local:** las verificaciones locales ejecutables pasan, incluyendo integración PostgreSQL/Redis y verificación `up/down/up` por esquema en BD limpia.

## 4. Matriz plan Rol A (It0–It8) vs evidencia

Leyenda: **Hecho** = evidencia suficiente; **Parcial** = existe pero con brechas Rol A/gobernanza; **Falta evidencia Rol A** = implementado o presente, pero sin registro/paquete Rol A; **Pendiente** = no hallado o incompleto.

| Iteración | Entregable esperado Rol A (resumen) | Evidencia observada | Estado | Brecha / acción Rol A |
| --- | --- | --- | --- | --- |
| It0 | Reorganización, diccionario v1, revisión modelo/contratos, preguntas abiertas, esqueleto, reconciliación C0 | `docs/tasks/rol-a/rol-a-it0-reorganizacion.md`, `rol-a-it0-revision-modelo.md`, `docs/diccionario-datos.md`, `docs/contratos/reconciliacion-c0.md`, `docs/open-questions.md`, commit `b74b19a` | **Hecho (base)** | Falta ratificación formal C0; diccionario desalineado con RC-A-01..04/R-018..R-031. |
| It1 | Estructura `apps/api`, migrador `up/down` por esquema, pruebas de arquitectura, migraciones iniciales vacías/verificables, health/logs, README API | `apps/api/src/database/migrator/migrate.ts`, migraciones `public/0001..0008`, `academic/0007..0010`, `apps/api/test/architecture/architecture.spec.ts`, `apps/api/src/health/*`, `app.module.ts`, `bootstrap/configure-app.ts`, CI, compose | **Falta evidencia Rol A / Hecho por equipo** | No hay registro Rol A It1. Falta evidencia local de integración/migrador en Docker. Confirmar propiedad/decisiones Rol A sobre migraciones y límites de esquema. |
| It2 | Modelo `public` completo (identidad/RBAC/auditoría/sesiones), migraciones `up/down`, servicio usuarios/perfiles/asignación, outbox/eventos mínimos | Migraciones `0001..0003`, módulos identity/audit, guards, políticas, semillas, pruebas integración de identidad/auditoría | **Falta evidencia Rol A** | Falta paquete Rol A. Verificar alineación con R-014/R-021/R-025..R-027/R-030 y diccionario. |
| It3 | Archivos, notificaciones, exportaciones (base), colas, idempotencia, migraciones `public` | Migraciones `0004..0006` (+0007,0008), módulos files/notifications/exports, idempotency store, outbox, contratos/colas | **Falta evidencia Rol A** | Falta paquete Rol A. Verificar R-003/R-009/R-010/R-020/R-029 y alcance de exports en v1.0. |
| It4 | Esquema `academic` (programas, grupos, horarios, estudiantes, matrícula), validaciones, importación/exportación, auditoría | Migraciones `academic/0007..0010`, módulo academic, validaciones dominio, pruebas API/integración | **Falta evidencia Rol A** | Falta paquete Rol A. Revisar R-004/R-006/R-008/R-018/R-019/R-024/R-025/R-026 y anti-deriva (sin contabilidad/espacios). |
| It5 | Asistencia, evaluación cualitativa, cierre de periodo, cifrado PII, protección borrado en uso, carga/restauración | Módulo academic B (asistencia/evaluaciones), migraciones/índices, cifrado/PII según adendas, pruebas k6/runbooks por otros roles | **Falta evidencia Rol A / Parcial** | Falta evidencia Rol A de carga/restauración y verificación PII específica. Confirmar cifrado + índice ciego (R-025) aplicado en modelo y código. |
| It6 | KPIs, vistas materializadas, caché/invalidación, exportaciones/reportes base, coherencia KPI-reportes | Módulo analytics/exports, vistas materializadas, eventos, pruebas de coherencia | **Falta evidencia Rol A** | Falta paquete Rol A. Validar R-003 (sin endpoints funcionales en v1.0 hasta C6 según propuesta original) vs estado actual de contratos/implementación. |
| It7 | Optimización rendimiento, índices, particionamiento/estrategia, respaldos/restauración | Migraciones/índices, observabilidad, docs resiliencia/operación, k6/CI | **Parcial / evidencia compartida** | No hay paquete Rol A específico; verificar que cambios de esquema/performance están documentados y reversibles. |
| It8 | Endurecimiento, revisión consultas, trazabilidad requisito→código→prueba, paquete final | `docs/reviews/c8`, runbooks, seguridad, pruebas; no hay matriz final Rol A | **Pendiente (trazabilidad Rol A)** | Falta matriz de trazabilidad Rol A y paquete de regularización/cierre. |

## 5. Hallazgos clave

### 5.1 Positivos
- El repositorio contiene implementación y pruebas sustanciales hasta C8; las verificaciones locales disponibles pasan.
- Los artefactos congelados `docs/diseno-arquitectonico.md` y `docs/vision-alcance.md` no fueron modificados en el rango revisado.
- Existe CI con jobs de calidad, contratos, integración PostgreSQL/Redis y seguridad.
- La arquitectura de módulos y migraciones por esquema está presente (señal de cumplimiento estructural de It1+).

### 5.2 Brechas Rol A
- **Trazabilidad:** no hay planes/registros/paquetes Rol A para It1–It8. La autoría de implementación debe tratarse como trabajo de equipo/repositorio, no asumirse como Rol A.
- **Diccionario vs modelo vigente:** `docs/diccionario-datos.md` sigue en borrador It0 y no refleja RC-A-01..RC-A-04 ni decisiones posteriores (R-025..R-027,R-030, etc.).
- **Canonicidad contractual:** coexisten propuesta OpenAPI YAML (`packages/contracts/openapi.json`) y contrato generado (`packages/contracts/openapi.json`). Se requiere decisión explícita R-013/PA-007.
- **Reconciliación pendiente:** R-018..R-031 y PA-009..PA-017 fueron introducidos por Rol B; requieren revisión/ratificación cruzada, no adopción silenciosa.
- **Verificación de integración local:** no ejecutada por ausencia de Docker; no se declara PASS.

## 6. Bloqueantes y decisiones requeridas

| ID | Tema | Impacto | Estado | Responsable / compuerta |
| --- | --- | --- | --- | --- |
| PA-004 / R-007 | Acceso de acudiente a datos de estudiante | Alto (privacidad/RBAC). Bloquea alcance de identidad temporal/acudiente. | Abierta | Equipo negocio/seguridad, antes de C2 para ese alcance |
| PA-006 / R-001,R-002 | Formalización gramática/catálogo permisos y posible enmienda cap. 8 | Alto (contratos congelados/seguridad) | Propuesta documentada | Equipo, C0 |
| PA-007 / R-013 | Fuente canónica OpenAPI + detalle de esquemas + generación `packages/contracts` | Alto (contratos, frontend, CI) | Abierta/parcial | A/C/B, C0–C1 |
| R-018..R-031 | Ratificación adenda Rol B (auth, permisos, modelo, auditoría, `x-*`) | Alto (modelo, contrato, seguridad) | Propuesta | Equipo, C0 |
| RC-A-01..RC-A-04 | Actualizar diccionario/modelo por documento cifrado+hash, auditoría `recurso_id`, columnas MFA/password, `estudiante.usuario_id` | Alto (congelamiento modelo v1) | Pendiente en diccionario | Rol A, C0 |
| Integración local | `test:integration` y `up/down/up` en BD limpia | Medio (evidencia de entorno) | Bloqueado por Docker local | Rol A/B/CI |

## 7. Recomendación de siguiente paso Rol A

1. **No abrir nueva funcionalidad** hasta cerrar regularización documental y decisiones pendientes.
2. Ejecutar integración en entorno con Docker/CI y adjuntar evidencia.
3. Preparar propuesta de actualización de `docs/diccionario-datos.md` alineada a RC-A-01..04 y a decisiones ratificadas (sin tocar congelados).
4. Producir matriz de trazabilidad Rol A (CAR/requisito → migración/módulo/endpoint → prueba) como paquete C8.
5. Solicitar ratificación de equipo sobre R-018..R-031, PA-006/PA-007 y canonicidad OpenAPI.

## 8. Definición de hecho para esta regularización

- [x] Repo sincronizado y estado identificado.
- [x] Verificaciones locales disponibles ejecutadas y registradas.
- [x] Integración PostgreSQL/Redis ejecutada en entorno con Docker (6 archivos, 49 pruebas PASS).
- [x] Brechas de trazabilidad Rol A identificadas.
- [x] Reconciliación contractual/modelo inicial documentada.
- [x] Matriz de trazabilidad C8 creada (`docs/tasks/rol-a/rol-a-trazabilidad-c8.md`).
- [x] Propuesta de actualización de diccionario creada (`docs/tasks/rol-a/rol-a-propuesta-diccionario-v1.1.md`).
- [x] Verificación migrador `up/down/up` por esquema en BD limpia (public y academic, PASS).
- [ ] Decisiones C0 pendientes ratificadas por el equipo.
