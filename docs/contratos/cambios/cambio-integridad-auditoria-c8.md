# Enmienda CAR-2026-11-23-03 — Integridad de la auditoría (C8)

- **Fecha:** 23 de noviembre de 2026
- **Estado:** ratificada por la orden de inicio de la Iteración 8 (decisión D102, opción A).
- **Documento base:** ADR-0004 §8 y PA-016 de `docs/open-questions.md` (congelados; **no se modifican**).
- **Motivo:** PA-016 pedía reevaluar en C8 el sellado criptográfico de `public.evento_auditoria`. La compuerta debe cerrar la decisión sin reabrir CAR-12 ni alterar el esquema congelado.

## 1. Decisión ratificada

| Aspecto | Decisión |
| --- | --- |
| Cadena de hashes por fila | **No se incorpora en v1.0** (ADR-0004 §8). |
| Inmutabilidad | Privilegios de base de datos: `ccltpg_app` sin `UPDATE`, `DELETE` ni `TRUNCATE` sobre la tabla de auditoría; disparador que rechaza DML directo; acceso restringido y archivado de WAL. |
| Evidencia operativa | Resumen firmado periódico como control operativo, custodiado fuera de la base; correlación por `requestId` con logs y trazas. |
| Correcciones | Solo evento compensatorio con justificación; nunca edición del pasado. |
| Esquema | Sin columnas nuevas de hash, estado o sello; `events.json` permanece en 64 eventos. |

## 2. Condiciones de reevaluación

1. Si se exige evidencia de integridad ante terceros o una auditoría externa, se evaluará una cadena de hashes o un sellado por lotes. Esa evaluación requiere enmienda controlada, migración ejecutada con `ccltpg_migrador`, gestión de claves y análisis de serialización de escrituras.
2. No se ejecuta esa migración en C8 sin autorización expresa: el coste es alto y reversible solo desde el primer evento sellado.
3. Mientras tanto, la falta de cadena se declara **riesgo aceptado** con los controles compensatorios de la tabla anterior, y se registran en `docs/reviews/c8/rol-b.md` junto a PA-014.

## 3. Cierre de PA-016

PA-016 queda **cerrada para C8** con la decisión «sin cadena de hashes, reevaluar solo ante evidencia externa». `docs/open-questions.md` y `docs/adr/ADR-0004-auditoria-inmutable.md` no se editan. La ejecución de resúmenes firmados y su custodia dependen de entorno y quedan como control operativo pendiente de acta, no como verificación local.

## Fuentes

- `docs/tasks/rol-b/rol-b-it8-plan.md` (D102).
- `docs/adr/ADR-0004-auditoria-inmutable.md` (§8).
- `docs/contratos/controles-seguridad-v1.md` (C-28, C-31).
