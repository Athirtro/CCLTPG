# Registro de ejecución — Iteración 8 (Rol B)

- **Fecha:** 23 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Iteración:** C8 — Endurecimiento y aceptación final (Release 3.0)
- **Plan:** `docs/tasks/rol-b/rol-b-it8-plan.md`
- **Paquete de revisión:** `docs/reviews/c8/rol-b.md`
- **Estado:** ejecución de Rol B realizada; **sin commit, push, firma, etiqueta ni publicación**.

## 1. Decisiones ratificadas

D100–D109 se ratifican el 23 de noviembre de 2026 con la opción A recomendada. En síntesis: alcance restringido a Rol B; PA-011 cerrada con política documentada sin DDL; PA-016 cerrada sin cadena de hashes; inventario PII documentado; supresión sin operación nueva; runbooks revisados y no modificados sin prueba; respaldos/staging documentados con simulacro pendiente; sin dependencias nuevas; carga/TLS/alertas pendientes de entorno; C8 no se firma ni etiqueta.

## 2. Trabajo ejecutado

### RB1-70 — Baseline y plan

Plan `docs/tasks/rol-b/rol-b-it8-plan.md` producido y ratificado; `docs/iteraciones.md` actualizado con el estado de C8. Deuda D89 y C7 registrada sin reutilizarse como evidencia.

### RB1-71 — Cierre de PA-011

Enmienda `docs/contratos/cambios/cambio-retencion-c8.md`. Plazos por tipo de dato, supresión por anonimización del registro vivo, conservación del evento `estudiante.anonimizado` (ya en el catálogo de 64) y prohibición de borrado de auditoría. `modelo-auditoria-v1.md` y `open-questions.md` intactos. Sin DDL.

### RB1-72 — Cierre de PA-016

Enmienda `docs/contratos/cambios/cambio-integridad-auditoria-c8.md`: se mantiene ADR-0004 (sin cadena de hashes), con privilegios, disparador, WAL y resumen firmado como control operativo. Condiciones de reevaluación ante evidencia externa, sin migración ejecutada. ADR-0004 intacto.

### RB1-73 — Inventario de datos personales

`docs/reviews/c8/inventario-datos-personales.md`: inventario sin datos reales con finalidad, clasificación, control y retención de cada dato (`email`, documento, dirección, teléfono, acudiente, consentimiento, observaciones, notificaciones, archivos y auditoría). PA-004 queda registrada como pendiente de negocio.

### RB1-74 — Supresión y anonimización

Política documentada en la enmienda de retención: anonimización del registro vivo, nunca borrado o edición del evento; corrección solo por evento compensatorio; sin operación, permiso ni evento nuevo. No se ejecutó sobre datos reales: falta entorno y autorización.

### RB1-75 — Runbooks y C-46

Revisión documental de los runbooks existentes (operación, migraciones, incidente, break-glass, rotación). Se identificó el hueco de un runbook dedicado de respaldo/restauración. No se modificó ningún runbook porque el plan exige prueba asociada y el simulacro depende de entorno. Detalle en `docs/reviews/c8/rol-b.md` §4.

### RB1-76 — Respaldos y staging

C-25 (cifrado, RPO ≤ 15 min, RTO ≤ 4 h) y C-26 (staging anonimizado) documentados en la política de retención y el inventario. Sin simulacro ni tiempos medidos: marcados **pendientes**, no verificados.

### RB1-77 — Saneamiento, secretos y cadena de suministro

`pnpm test:security` 6/6 y `pnpm security:secrets` sin hallazgos. `arch:check` sin violaciones y `contracts:validate` correcto. SCA de dependencias, escaneo de imágenes, CI de GitHub y rotación con doble `kid` siguen pendientes de entorno; no se instalaron dependencias nuevas.

### RB1-78 — Carga, TLS y observabilidad

k6/soak, escaneo TLS en preproducción y simulacro de alertas registrados como pendientes. `RATE_LIMITS` sin ajuste al no existir informe de carga. `axe` continúa supeditado a autorización (D95).

### RB1-79 — Trazabilidad, regresión y paquete C8

Matriz en `docs/reviews/c8/rol-b.md` y este registro. Regresión local ejecutada: verde salvo `lint` y `format:check` globales, que fallan por código de Rol C heredado de los commits `e80e4a3` y `948f07a`. Rol B no modifica esos archivos y no afirma regresión global en verde.

## 3. Cambios en archivos

- Nuevos: `docs/tasks/rol-b/rol-b-it8-plan.md`, `docs/tasks/rol-b/rol-b-it8-registro.md`, `docs/contratos/cambios/cambio-retencion-c8.md`, `docs/contratos/cambios/cambio-integridad-auditoria-c8.md`, `docs/reviews/c8/rol-b.md`, `docs/reviews/c8/inventario-datos-personales.md`.
- Modificado: `docs/iteraciones.md` (estado de C8 en las tablas y fuentes).
- Sin cambios: contratos generados (sin deriva), documentos congelados, ADR, código de API/web, runbooks, dependencias.

## 4. Evidencia de regresión

| Comando | Resultado |
| --- | --- |
| `pnpm typecheck` | ✅ verde |
| `pnpm lint` | ❌ 15 errores en `apps/web` (Rol C, archivos listados en el acta) |
| `pnpm build` | ✅ verde |
| `pnpm format:check` | ❌ 6 archivos `apps/web/src/pages/*.tsx` (Rol C) |
| Prettier sobre archivos de Rol B | ✅ verde |
| `pnpm test` | ✅ API 33/420; web 2/15 |
| `pnpm test:integration` (PostgreSQL 16 real) | ✅ 6/49 |
| `pnpm arch:check` | ✅ 0 violaciones |
| `pnpm test:architecture` | ✅ 3 pruebas |
| `pnpm test:contracts` | ✅ 14 pruebas |
| `pnpm contracts:validate` | ✅ 54/4/64 |
| `pnpm contracts:generate` | ✅ sin deriva |
| `pnpm contracts:lint` | ✅ 0 errores, 36 advertencias preexistentes |
| `pnpm test:security` | ✅ 6 pruebas |
| `pnpm security:secrets` | ✅ sin hallazgos |

## 5. Cierre

Compuerta 8 abierta: PA-011 y PA-016 cerradas documentalmente, trazabilidad producida, pero con deuda de calidad de Rol C y evidencia externa pendiente. No se firma, no se etiqueta `release-3.0`, no se publica y no se inicia ninguna iteración posterior.
