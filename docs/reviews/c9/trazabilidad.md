# Matriz de trazabilidad — C9 (cierre de deuda C0…C8)

- **Fecha:** 26 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación; consolida evidencia reportada por Rol A y Rol C.
- **Estado:** matriz producida para la compuerta 9. **No aprueba ninguna compuerta.** Las filas ⚠️/⏳ conservan su deuda y no cuentan como cumplidas.
- **Fuentes:** `docs/vision-alcance.md` (CAR-01…CAR-12), `docs/tasks/rol-a/rol-a-trazabilidad-c8.md`, `docs/tasks/rol-a/rol-a-reconciliacion-contratos.md`, `docs/reviews/c7/rol-c.md`, `docs/reviews/c8/rol-b.md`, `docs/reviews/c9/rol-b.md`, `docs/contratos/cambios/seguimiento-auth-cliente-c7.md`, `docs/contratos/cambios/seguimiento-csp-cliente-c7.md` y `packages/contracts/openapi.json`.
- **Convención:** ✅ evidencia enlazada y verificada o reportada con acta; ⚠️ evidencia parcial o divergencia declarada; ⏳ sin evidencia.

## 1. Matriz CAR-01…CAR-12

| CAR | Criterio de la visión | Código / esquema | Prueba / verificación | Acta o evidencia enlazada | Estado C9 | Pendiente y dueño |
| --- | --- | --- | --- | --- | --- | --- |
| CAR-01 | Registro y gestión de estudiantes; inscripción con validación de cupos | `academic/0007_create_academic_core.ts`, `0010_academic_b_indexes.ts`; `modules/academic` (`student.service.ts`, `enrollment.service.ts`, `group.service.ts`) | `apps/api/test/integration/academic-flow.spec.ts`; pruebas de dominio academic | `docs/tasks/rol-a/rol-a-trazabilidad-c8.md` §2; integración reportada 6/49 por Rol A | ⚠️ | AC formal de PA-017; diccionario RC-A-01/04 (Rol A); re-verificación de integración con entorno (Rol B) |
| CAR-02 | Estudiante consulta matrícula, horarios, grupo, docente, salón y progreso | Vistas/consultas en `modules/academic/application/academic.views.ts`; rutas `/me/student`, `/me/enrollments`, `/me/schedule`, `/me/evaluations` | `academic-flow.spec.ts`, pruebas de ámbito propio y guard | `docs/reviews/c0/cobertura-requisitos.md` §2; `docs/tasks/rol-a/rol-a-trazabilidad-c8.md` §2 | ⚠️ | Verificar ámbito propio R-011/R-023 y PII mínima; demo con cliente real (Rol C) |
| CAR-03 | Educador gestiona asistencia y evaluación cualitativa de sus grupos | `academic/0009_create_academic_b.ts`, `0010_academic_b_indexes.ts`; `attendance.service.ts`, `evaluation.service.ts`, `session.service.ts` | `apps/api/test/integration/academic-b-flow.spec.ts`; `idempotent-create.ts` | `docs/tasks/rol-a/rol-a-trazabilidad-c8.md` §2–§3 | ⚠️ | AC formal; verificar idempotencia R-010 y ámbito de grupo en el acta Rol A |
| CAR-04 | Reportes automáticos exportables en Excel, PDF y CSV | `modules/exports/**`, `modules/analytics/**`; `public/0008_create_analytics_notification_templates.ts` | `apps/api/test/integration/analytics-c6-flow.spec.ts`; `export-templates.spec.ts`, `default-export-renderer.spec.ts` | `docs/reviews/c0/cobertura-requisitos.md` §2; divergencia R-003 registrada por Rol A | ⚠️ **Divergente** | Decisión formal R-003/C6 (Equipo); apertura manual de PDF/XLSX (Rol C); demo reporte→exportación |
| CAR-05 | Dashboards interactivos con métricas de matrícula, asistencia, evaluación, programas, geografía y deserción | `modules/analytics/**`, `redis-kpi.cache.ts`, `kpi-cache-invalidator.ts` | `analytics-c6-flow.spec.ts`, `redis-kpi.cache.spec.ts`; `pnpm test` 420/420 | `docs/reviews/c6/verificacion-reportes-kpis.md`; `docs/tasks/rol-a/rol-a-trazabilidad-c8.md` §2 | ⚠️ **Divergente** | Misma decisión R-003/C6; verificar coherencia KPI-reportes y demo en cliente real |
| CAR-06 | 200 usuarios concurrentes; p95 < 4 s en operaciones críticas | Índices `0008`/`0010`; pool y caché Redis en configuración de API | Sin informe k6; `pnpm test:integration` reportado por Rol A, `skipped` en la ejecución de Rol B | `docs/reviews/c8/rol-b.md` §3; plan C9 §6 | ⏳ | k6: 200 VUs, p50/p95/p99, 0 5xx y soak; autorización de dependencia (Rol B/Equipo) |
| CAR-07 | Autenticación segura con MFA, RBAC y cifrado SSL/TLS | `modules/identity/**`, guards, `argon2-password-hasher.ts`, `jose-token.service.ts`, `aes-field-encryption.ts`; `public/0001..0003` | `identity-flow.spec.ts`, `authorization-matrix.spec.ts`, `security-headers.spec.ts`, `test:security` 6/6 | `docs/requirements/seguridad.md`; `docs/contratos/cambios/seguimiento-auth-cliente-c7.md`; `docs/reviews/c7/rol-c.md` §6 | ⚠️ | TLS/preproducción y escaneo (Rol B); ratificación D41…D48 (Equipo); `ChangePasswordDto` (Rol A); refresh silencioso (Rol C) |
| CAR-08 | Disponibilidad 99.9 %, DRP, backups automáticos y tolerancia a fallos | `/health/live`, `/health/ready`, Compose con Redis AOF, runbooks | `health.spec.ts`; `docs/runbook/respaldo-restauracion.md` creado, sin simulacro | `docs/reviews/c8/rol-b.md` §4; `docs/runbook/respaldo-restauracion.md` §6 | ⚠️ | Simulacro con RPO ≤ 15 min y RTO ≤ 4 h; medición 99.9 % (Rol B/entorno) |
| CAR-09 | Notificaciones automáticas sobre fechas, horarios y progreso | `public/0005`, `0007`, `0008`; `modules/notifications/**`, outbox y preferencias | `notifications.service.spec.ts`, `notification-dispatcher.spec.ts`, `notification-policy.spec.ts`; integración reportada por Rol A | `docs/reviews/c0/cobertura-requisitos.md` §2; `docs/tasks/rol-a/rol-a-trazabilidad-c8.md` §2 | ⚠️ | AC formal y catálogo de notificaciones; críticas no silenciables verificadas en demo (Rol C) |
| CAR-10 | Tres niveles de usuario con permisos diferenciados | `public/0001`; `identity/domain/perfiles.ts`, `permissions.ts`, `matriz-autorizacion-v1.md` | `authorization-matrix.spec.ts`, `perfiles.spec.ts`, `permissions.spec.ts` | `docs/contratos/matriz-autorizacion-v1.md`; `docs/tasks/rol-a/rol-a-reconciliacion-contratos.md` | ⚠️ | Consolidación formal R-001/R-002/R-018…R-031 y ratificación PA-006 (Equipo) |
| CAR-11 | WCAG 2.1 AA y diseño responsivo en navegadores modernos y móviles | Principalmente Rol C; tema MUI y drawer en `apps/web/src` | `src/accessibility/a11y.test.tsx` (21 páginas axe), `responsive.test.tsx` (360/768/1024/1440), teclado; web 31/31 | `docs/reviews/c7/rol-c.md` §2–§5 y §9; CI run #24 documentado | ⚠️ | Acta NVDA/Jaws/VoiceOver, verificación en Chrome/Firefox/Edge y ratificación D95 (Rol C/Equipo); CSP del SPA en despliegue (Rol C/B) |
| CAR-12 | Trazabilidad de auditoría con usuario, fecha y hora | `public/0002_create_evento_auditoria.ts`; `modules/audit/**`; ADR-0004 | `audit-query.spec.ts`, `identity-flow.spec.ts`, `db-roles.spec.ts`; `contracts:validate` 64 eventos | `docs/adr/ADR-0004-auditoria-inmutable.md`; `docs/contratos/cambios/cambio-integridad-auditoria-c8.md`; `docs/reviews/c8/rol-b.md` §2 | ⚠️ | Aplicar RC-A-02 en el diccionario (Rol A); resumen firmado y verificación operativa (Rol B) |

**Lectura:** ningún CAR se marca ✅ completo para aceptación. Los avances de código y pruebas son reales, pero las actas, decisiones o evidencia de entorno siguen abiertas. CAR-04/CAR-05 además arrastran la divergencia R-003.

## 2. Matriz de compuertas C0…C9

| Compuerta | Entregable / evidencia | Estado C9 | Bloqueo que impide firmar |
| --- | --- | --- | --- |
| C0 | `docs/reviews/c0/estado-cierre.md`, `cobertura-requisitos.md`, baseline y reconciliación de Rol A (`864102f`) | ⚠️ | RC-A-01…04 sin aplicar al diccionario; catálogo CAR formal y acta de ratificación |
| C1 | `docs/reviews/c1/rol-b.md`; CI en el repositorio | ⚠️ | CI externa documentada pero no ratificada; excepción `picomatch` sin cierre formal |
| C2 | `docs/reviews/c2/rol-b.md`; `identity-flow.spec.ts`, `authorization-matrix.spec.ts` | ⚠️ | Acta D41…D48; `ChangePasswordDto` delegado a Rol A |
| C3 | `docs/reviews/c3/rol-b.md`; módulos files/notifications/exports | ⚠️ | MinIO real, stubs de correo/antimalware y acta D49…D58 |
| C4 | `docs/reviews/c4/rol-b.md`; migraciones académicas A | ⚠️ | Acta D59…D68 y divergencia R-003 |
| C5 | `docs/reviews/c5/rol-b.md`; académico B y endurecimiento | ⚠️ | TLS, rotación doble `kid`, respaldo, alertas y k6 sin acta |
| C6 | `docs/reviews/c6/rol-b.md`, `verificacion-reportes-kpis.md`; commit `0ecbe32` | ⚠️ | Demo con cliente real y decisión R-003/C6 |
| C7 | `docs/reviews/c7/rol-b.md` y `docs/reviews/c7/rol-c.md`; `cambio-csp-c7.md` y seguimientos | ⚠️ | Lector de pantalla, tres navegadores, CSP del SPA y demo; D95 sin ratificar |
| C8 | `docs/reviews/c8/rol-b.md`; enmiendas PA-011/PA-016; commit `3df23ce` en `origin/main` | ⚠️ | Calidad ya corregida; siguen actas, simulacros y ejecución operativa de retención/integridad |
| C9 | `docs/reviews/c9/rol-b.md`, este documento y `docs/tasks/rol-b/rol-b-it9-registro.md` | ⚠️ | Entregables de Rol B producidos; D110…D119 no ratificadas y deuda de entorno/equipo abierta |

## 3. Verificación transversal de Rol B (26-11)

| Verificación | Resultado | Evidencia en C9 |
| --- | --- | --- |
| Formato, tipos, lint y build | ✅ | `docs/reviews/c9/rol-b.md` §3 |
| API 420/420 y web 31/31 | ✅ | `docs/reviews/c9/rol-b.md` §3 |
| Contratos 14/14, 54/4/64, sin deriva, 0 errores/36 advertencias | ✅ | `docs/reviews/c9/rol-b.md` §3 |
| Seguridad y secretos | ✅ 6/6 y sin hallazgos | `docs/reviews/c9/rol-b.md` §3 |
| Arquitectura | ✅ 0 violaciones, 3/3 pruebas | `docs/reviews/c9/rol-b.md` §3 |
| Integración con DB | ⚠️ Rol A reporta 6/49 con Docker; Rol B la ejecuta sin entorno y queda `skipped` | `docs/tasks/rol-a/rol-a-trazabilidad-c8.md` §1; plan C9 §6 |
| Firma / etiqueta `release-3.0` | ⏳ | Sin autorización ni acta |

## 4. Cierre de la matriz

- [x] CAR-01…CAR-12 mapeados a código, prueba y acta o evidencia enlazada.
- [x] Compuertas C0…C9 mapeadas con su bloqueo.
- [x] Deuda de otros roles incorporada sin reclamarla como propia.
- [ ] Ratificación de D27…D119 y firmas de C0…C9.
- [ ] Evidencia de entorno y demo final.
- [ ] Firma o etiqueta `release-3.0` (requiere autorización expresa).
