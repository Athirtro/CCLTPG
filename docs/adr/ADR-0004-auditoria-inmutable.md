# ADR-0004 — Auditoría de solo inserción, escritura transaccional y minimización

- **Estado:** Aceptada por Rol B (2026-11-16); requiere ratificación del equipo en Compuerta 0 y actualización del diccionario por Rol A.
- **Fecha:** 2026-11-16
- **Decisores:** Rol B (autor); Rol A (modelo y diccionario); Rol C (OpenAPI y CI); aprobación humana en C0.
- **Trazabilidad:** CAR-12, CAR-07; diseño caps. 4.2, 7.2, 11, 12, 13; R-023, R-030, R-031; PA-011; inventario G-17; `docs/contratos/modelo-auditoria-v1.md`.

## Contexto

El capítulo 11 exige una tabla de auditoría de **solo inserción**, con actor, perfil activo, IP, dispositivo, recurso, acción, datos anteriores y posteriores redactados, fecha y `requestId`. El diseño también exige corrección por **eventos compensatorios**, consulta exclusiva para administradores y minimización para que una supresión de datos personales no obligue a alterar el histórico.

El modelo vigente (`public.evento_auditoria`) ya contiene los campos, pero: (a) `recurso` es un texto ambiguo que no permite consultar el historial de un registro concreto; (b) no hay decisión sobre cómo se escribe el evento (¿misma transacción o asíncrono?); (c) no se ha definido el catálogo de eventos ni el mecanismo verificable de inmutabilidad. Sin cerrar esto en C0, las migraciones de C2 no pueden congelarse.

## Decisión

1. **Solo inserción con dos barreras independientes.**
   - **Privilegios:** el rol `ccltpg_app` recibe únicamente `INSERT` y `SELECT` sobre `public.evento_auditoria`; se revocan `UPDATE`, `DELETE` y `TRUNCATE`.
   - **Disparador:** una función rechaza `UPDATE`, `DELETE` y `TRUNCATE` incluso para SQL directo o para un rol con privilegios.
2. **Escritura en la misma transacción que la operación.** El evento se inserta antes del `COMMIT`; si la inserción falla, la operación de negocio se revierte (**fallo cerrado**). No se usa outbox ni cola para auditoría en v1.0: el evento no puede perderse ni adelantarse al cambio que describe.
3. **Lecturas auditadas antes de responder.** Las operaciones que exponen PII o descargan archivos insertan el evento antes de devolver el cuerpo; si falla la auditoría, no se entrega el dato (503 `SERVICE_UNAVAILABLE`).
4. **Corrección por compensación.** Nunca se modifica el pasado: se inserta `auditoria.correccion` con `recurso = evento_auditoria`, `recurso_id = <id del evento original>` y `datos_despues.justificacion` obligatoria.
5. **Minimización desde la creación.** Cada evento declara en el catálogo qué campos puede contener `datos_antes`/`datos_despues`. Se prohíben secretos, tokens, códigos, contraseñas y valores completos de documento, teléfono y dirección; el email se guarda como HMAC con clave separada. Los campos sensibles modificados se representan como `{"cambiado": true}`.
6. **Identificación del recurso.** `recurso` pasa a significar **tipo** de recurso (`usuario`, `estudiante`, `matricula`, `sesion`, `archivo`, …) y se añade `recurso_id` (uuid, nulo en eventos de colección). Índices en R-030.
7. **Catálogo de eventos como contrato.** El catálogo de `modelo-auditoria-v1.md` §3 es la lista canónica; `x-audit-event` del OpenAPI debe referenciarlo y CI valida ambos sentidos (R-031).
8. **Sin cadena de hashes en v1.0.** No se añaden columnas de encadenamiento. La evidencia de integridad se apoya en privilegios, disparador, acceso restringido a la base, archivado de WAL y un resumen firmado periódico como control operativo. Se registra PA-016 para reevaluar el sellado criptográfico en C8.

## Alternativas consideradas

| Alternativa | Motivo de rechazo |
| --- | --- |
| Disparadores automáticos en todas las tablas | No capturan actor, perfil ni intención; generan ruido y no distinguen acciones de negocio |
| `pgAudit` o logging de PostgreSQL | Es auditoría de infraestructura, no de negocio: sin `recurso_id`, sin perfil y fuera del modelo consultable |
| Outbox/cola asíncrona | Riesgo de pérdida o de eventos posteriores al cambio; añade complejidad sin requisito de escala |
| Cadena de hashes por fila | Serializa las escrituras y exige gestión de claves; el riesgo de un DBA malicioso se cubre con acceso restringido y WAL; se reevalúa en C8 |
| `UPDATE` del evento para corregir | Viola la inmutabilidad y la confianza en la traza |
| Borrado lógico (`deleted_at`) en auditoría | Un evento “borrado” deja de ser evidencia |

## Consecuencias

- **Positivas:** trazabilidad verificable, imposible de alterar por la aplicación, historial por recurso consultable, minimización alineada con la Ley 1581 de 2012.
- **Negativas:** la auditoría acopla la disponibilidad de la escritura a la operación (si la tabla falla, falla la operación); el volumen crece de forma monótona; la restauración de un respaldo antiguo “retrocede” la traza y exige procedimiento de excepción.
- **Operativas:** rotación y custodia de la clave HMAC de email; revisión periódica de privilegios; alertas por errores de inserción de auditoría.
- **Compatibilidad:** requiere migración en C2 (`recurso_id`, índices, disparador, privilegios) y actualización del diccionario por Rol A (R-030).

## Cumplimiento

- **C0:** ratificar R-030/R-031 y este ADR; aprobar el catálogo de eventos.
- **C2:** migración con `recurso_id`, índices, disparador y privilegios; pruebas de inmutabilidad y de escritura transaccional.
- **C3/C5:** auditoría de descargas, notificaciones y evaluaciones; verificación de redacción con fixtures.
- **C8:** retención (PA-011), anonimización y evaluación de sellado criptográfico (PA-016).
