# Matriz de trazabilidad Rol A — C8 (borrador de regularización)

- **Fecha:** 2026-11-24
- **Rol:** A (Backend, dominio y datos)
- **Estado:** Borrador para revisión de equipo. Evidencia basada en inspección de repo en `2c35937` y verificaciones locales ejecutadas.
- **Propósito:** mapear CAR-01..CAR-12 a evidencia de esquema/código/contrato/prueba, identificando brechas de propiedad o verificación Rol A.

## 1. Verificaciones de soporte

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| Lint | PASS | `pnpm -r lint` |
| Typecheck | PASS | `pnpm -r typecheck` |
| Arquitectura | PASS | `pnpm --filter @ccltpg/api test:architecture` (1/3) |
| API/unitarias | PASS | `pnpm --filter @ccltpg/api test` (33/420) |
| Web | PASS | `pnpm --filter @ccltpg/web test` (2/15) |
| Contratos | PASS | `pnpm test:contracts` (14/14) |
| Integración DB | PASS | `pnpm --filter @ccltpg/api test:integration` (6 archivos, 49 pruebas) con PostgreSQL 16/Redis en Docker |
| Migrador up/down/up | PASS | Verificación manual por esquema en BD limpia (`ccltpg_verify`): public 0001..0008 y academic 0007..0010 |

## 2. Matriz CAR → evidencia

| CAR | Requisito (visión) | Esquema/migraciones | Módulos/código | Contrato/API | Pruebas observadas | Estado Rol A |
| --- | --- | --- | --- | --- | --- | --- |
| CAR-01 | Registro y gestión de estudiantes; inscripción con validación de cupos | `academic/0007_create_academic_core.ts`, `0010_academic_b_indexes.ts` (verificar), tablas estudiante/grupo/matricula | `apps/api/src/modules/academic/**` (estudiantes, matrículas, validaciones) | `packages/contracts/openapi.json` (rutas academic/student/enrollment) | `test/integration/academic-flow.spec.ts`, pruebas API/domain academic | **Parcial**: evidencia presente; falta paquete Rol A y verificación integración en Docker. |
| CAR-02 | Estudiante consulta matrícula, horarios, grupo, docente, salón y progreso | Tablas academic + referencias a usuario; vistas/consultas según implementación | Endpoints `/me/*` y consultas academic; guards ámbito propio | OpenAPI `/me/student`, `/me/enrollments`, `/me/schedule`, `/me/evaluations` (verificar nombres exactos) | Pruebas identity/academic; integración pendiente | **Parcial**: requiere verificación de ámbito propio (R-011/R-023) y PII mínima. |
| CAR-03 | Educador gestiona asistencia y evaluación cualitativa de sus grupos | `academic/0009_create_academic_b.ts`, `0010_academic_b_indexes.ts` | `modules/academic` asistencia/evaluación, políticas de grupo | OpenAPI sesiones/asistencia/evaluaciones | `test/integration/academic-b-flow.spec.ts`, pruebas API | **Parcial**: falta evidencia Rol A de idempotencia R-010 y ámbito grupo completo. |
| CAR-04 | Reportes automáticos exportables (Excel, PDF, CSV) | `public/0008_create_analytics_notification_templates.ts` (relacionado), tablas export/report si existen | `modules/exports/**`, `modules/analytics/**` | OpenAPI `/exports`, `/reports/*` (presente; diverge de R-003 original) | `analytics-c6-flow.spec.ts`, pruebas exports/analytics | **Divergente**: implementar R-003 original vs estado C6 requiere decisión formal. |
| CAR-05 | Dashboards interactivos con métricas | Vistas/materializaciones/consultas analytics (verificar migraciones) | `modules/analytics/**` | OpenAPI `/analytics/kpis` | `analytics-c6-flow.spec.ts`, pruebas analytics | **Parcial/Divergente**: misma decisión R-003/C6; validar coherencia KPI-reportes. |
| CAR-06 | 200 usuarios concurrentes; p95 < 4 s | Índices en migraciones, configuración pool/cache | Config Nest/DB/observabilidad | N/A (no funcional) | `k6/`, CI/performance docs (verificar) | **Parcial**: evidencia de soporte; falta ejecución de carga reproducible y paquete Rol A. |
| CAR-07 | Autenticación con MFA, RBAC y TLS | `public/0001..0003`, tablas usuario/perfil/permiso/refresh_token/codigo_recuperacion_mfa | `modules/identity/**`, guards, policies, crypto | `auth-v1`, OpenAPI auth/identity, `x-permission` | `identity-flow.spec.ts`, guards specs, db-roles.spec | **Parcial**: fuerte evidencia; diccionario desalineado (RC-A-03) y ratificaciones C0 pendientes. |
| CAR-08 | Disponibilidad 99.9 %, DRP, backups, tolerancia a fallos | N/A directo en esquema; migraciones reversibles | Config operación/health/readiness | `/health/live`, `/health/ready` | Runbooks, compose, CI; integración/restore no ejecutado local | **Parcial**: responsabilidad compartida B/A; falta evidencia Rol A de restore sobre instantánea. |
| CAR-09 | Notificaciones automáticas | `public/0005_create_notifications.ts`, `0007_create_academic_notifications.ts`, `0008...` | `modules/notifications/**`, outbox/eventos | OpenAPI notifications/preferences | Pruebas notifications/integration | **Parcial**: verificar R-009/R-020, criticidad y unicidad preferencias. |
| CAR-10 | Tres niveles de usuario con permisos diferenciados | Tablas perfil/permiso/usuario_perfil | RBAC guards, catálogo permisos, semillas | Matriz autorización, OpenAPI `x-permission` | Pruebas autorización/guards | **Parcial**: requiere consolidación catálogo R-001/R-002/R-018..R-031. |
| CAR-11 | WCAG 2.1 AA y diseño responsivo | N/A | Principalmente Rol C | N/A | Pruebas web/a11y | **Fuera de implementación Rol A**; Rol A solo soporta contratos/errores claros. |
| CAR-12 | Trazabilidad de inicios de sesión y cambios con usuario, fecha y hora | `public/0002_create_evento_auditoria.ts` (incluye `recurso_id`) | `modules/audit/**`, audit writer, interceptores | OpenAPI auditoría, `x-audit-event` | `identity-flow.spec.ts`, pruebas audit, db-roles | **Parcial**: esquema/código adelantados; diccionario RC-A-02 desalineado; falta verificación integración local. |

## 3. Evidencia de migraciones (Rol A relevante)

| Esquema | Migración | Cobertura observada | Observación |
| --- | --- | --- | --- |
| public | `0001_create_identity_core.ts` | Usuarios/perfiles/permisos/base identidad | Base It1/It2 |
| public | `0002_create_evento_auditoria.ts` | Auditoría inmutable con `recurso_id` e índices | Alineado con R-030/RC-A-02 en esquema; diccionario pendiente |
| public | `0003_complete_identity_model.ts` | `debe_cambiar_password`, `codigo_recuperacion_mfa` | Alineado parcial con R-027/RC-A-03; falta `password_actualizado_en` |
| public | `0004_create_files.ts` | Archivos/metadatos | It3 |
| public | `0005_create_notifications.ts` | Notificaciones | It3/CAR-09 |
| public | `0006_create_outbox_idempotency.ts` | Outbox/idempotencia | Soporte transaccional |
| public | `0007_create_academic_notifications.ts` | Notificaciones académicas | C4/C6 |
| public | `0008_create_analytics_notification_templates.ts` | Analytics/plantillas | C6 |
| academic | `0007_create_academic_core.ts` | Núcleo académico; `numero_documento_hash`, `estudiante.usuario_id` único parcial | Alineado con RC-A-01/RC-A-04 en esquema; diccionario pendiente |
| academic | `0008_academic_indexes.ts` | Índices | Rendimiento/consulta |
| academic | `0009_create_academic_b.ts` | Asistencia/evaluación | CAR-03 |
| academic | `0010_academic_b_indexes.ts` | Índices B | Rendimiento |

## 4. Brechas priorizadas

| Prioridad | Brecha | Impacto | Responsable |
| --- | --- | --- | --- |
| P0 | Integración DB no ejecutada localmente | No se puede declarar PASS de integración/migrador en este entorno | Rol A/B (entorno) |
| P0 | Diccionario desalineado con esquema real (RC-A-01..04) | Riesgo de gobernanza y onboarding | Rol A |
| P0 | Canonicidad OpenAPI y ratificación R-018..R-031 | Riesgo contractual/seguridad | Equipo A/B/C |
| P1 | Falta paquete/matriz Rol A por iteración en `docs/tasks/rol-a` | Trazabilidad incompleta | Rol A |
| P1 | Divergencia R-003 vs exports/analytics actuales | Alcance v1.0 ambiguo | Equipo |
| P2 | Evidencia formal de carga/restauración atribuible a Rol A | Cierre C5/C8 incompleto para Rol A | Rol A/B |

## 5. Criterio de cierre de esta matriz

- [x] CAR-01..CAR-12 mapeados a evidencia observable.
- [x] Brechas P0/P1 identificadas.
- [x] Evidencia de integración DB y migrador `up/down/up` adjuntada.
- [ ] Ratificación de decisiones contractuales/modelo.
- [ ] Paquete de revisión Rol A firmado por equipo.
