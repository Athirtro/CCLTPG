# Enmienda CAR-2026-11-23-02 — Política de retención y supresión (C8)

- **Fecha:** 23 de noviembre de 2026
- **Estado:** ratificada por la orden de inicio de la Iteración 8 (decisión D101, opción A).
- **Documento base:** `docs/contratos/modelo-auditoria-v1.md` §8 y PA-011 de `docs/open-questions.md` (congelados; **no se modifican**).
- **Motivo:** PA-011 mantenía valores por defecto hasta C8. La compuerta exige plazos documentados y un procedimiento de supresión compatible con la inmutabilidad de la auditoría (AC-AUD-15, diseño §13).

## 1. Plazos por tipo de dato

| Tipo de dato | Plazo | Forma de supresión | Responsable |
| --- | --- | --- | --- |
| Auditoría (`public.evento_auditoria`) | ≥ 5 años (valor por defecto) | Sin borrado desde la aplicación; archivado/depuración solo por tarea operativa del DBA con aprobación y registro | Rol B / DBA |
| PII de estudiante (`academic.estudiante`) | Mientras dure la relación y el plazo institucional | Anonimización del registro vivo; nunca borrado ni edición del evento | Rol B / negocio |
| PII de usuario (`public.usuario`) | Mientras dure la relación y el plazo institucional | Anonimización o seudonimización al cese de la relación; `email` conservado solo como identificador de login mientras sea necesario | Rol B |
| Archivos y exportaciones | Igual que la auditoría mientras exista deber de conservación | Sin purga automática; baja operativa autorizada y registrada | Rol B |
| Respaldos | Igual que la auditoría | Claves de descifrado custodiadas por separado; restauración solo por procedimiento de excepción | Rol B / DBA |
| Staging y desarrollo | Sin datos reales | Copia anonimizada o semilla representativa (C-26) | Rol B |

## 2. Reglas de supresión compatible con la auditoría

1. La supresión se implementa como **anonimización del registro vivo**, nunca como borrado o actualización de `public.evento_auditoria`.
2. Los campos sensibles de `academic.estudiante` (`numero_documento`, `nombres`, `apellidos`, `fecha_nacimiento`, `direccion`, `telefono`, `acudiente`) se anonimizan; se conserva la evidencia de consentimiento y el evento `estudiante.anonimizado`, que ya pertenece al catálogo de 64 eventos.
3. Una corrección de auditoría se registra como evento compensatorio con justificación; no existe `UPDATE`, `DELETE` ni `TRUNCATE` sobre la tabla de auditoría (AC-AUD-06/07).
4. No se crean operaciones, permisos ni eventos nuevos. La API no ejecuta DDL; cualquier cambio de esquema se haría con `ccltpg_migrador` y previa enmienda, y **no está previsto** en C8.
5. La verificación efectiva sobre datos reales depende de entorno y autorización; en C8 queda como procedimiento documentado y se registra pendiente en `docs/reviews/c8/rol-b.md`.

## 3. Cierre de PA-011

PA-011 queda **cerrada para C8** con la política anterior. `docs/open-questions.md` y `docs/contratos/modelo-auditoria-v1.md` no se editan: la resolución vive en esta enmienda y en el acta `docs/reviews/c8/rol-b.md`. La aplicación práctica sobre datos reales, la depuración por DBA y la restauración siguen sujetas a acta de simulacro (C-25/C-46).

## Fuentes

- `docs/tasks/rol-b/rol-b-it8-plan.md` (D101).
- `docs/requirements/seguridad.md` (AC-AUD-15).
- `docs/diseno-arquitectonico.md` (§13).
- `docs/contratos/modelo-auditoria-v1.md` (§8).
