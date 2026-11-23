# Enmienda CAR-2026-11-22-01 — Eventos de notificación académica (C6)

- **Fecha:** 22 de noviembre de 2026
- **Estado:** ratificada por la orden de inicio de la Iteración 6 (decisión D85, opción A).
- **Documento base:** `docs/contratos/modelo-auditoria-v1.md` (congelado; **no se modifica**).
- **Motivo:** CAR-09 exige notificaciones académicas de evaluación publicada y recordatorio de fechas. El catálogo v1.0 tiene 62 eventos y no contiene estos dos tipos.

## 3. Adiciones al catálogo de eventos

| Evento | Cuándo | `recurso` / `recurso_id` | `datos_antes` | `datos_despues` |
| --- | --- | --- | --- | --- |
| `evaluacion.publicada` | Evaluación cualitativa registrada y notificada al estudiante | `notificacion` / id | — | `{matriculaId, indicadorId, periodo, valor}` |
| `recordatorio.fechas` | Recordatorio de próxima sesión publicado por el outbox | `notificacion` / id | — | `{sesionId, grupoId, fecha}` |

## 4. Reglas de la enmienda

1. Los dos eventos se añaden al conjunto del catálogo base; ningún evento existente se elimina ni se renombra.
2. `packages/contracts/events.json` pasa de 62 a **64 eventos** y conserva `version: "1.0"`.
3. `evaluacion.publicada` es crítico por el prefijo `evaluacion.` ya declarado en `docs/contratos/modelo-auditoria-v1.md`: no se puede silenciar desde preferencias.
4. `recordatorio.fechas` no es crítico: respeta las preferencias `app`/`email` del destinatario.
5. La verificación del contrato fusiona este archivo con el catálogo base. El documento congelado permanece intacto.
6. La entrega real de correo sigue siendo un stub; la evidencia de SMTP queda fuera de C6.

## Fuentes

- `docs/tasks/rol-b/rol-b-it6-plan.md` (D85).
- `docs/vision-alcance.md` (CAR-09).
