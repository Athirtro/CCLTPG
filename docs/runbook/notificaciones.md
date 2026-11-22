# Runbook — notificaciones y outbox

- **Objetivo:** operar la bandeja, las preferencias y la entrega de notificaciones sin perder eventos ni duplicar mensajes.
- **Alcance:** `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{id}`, `GET|PUT /api/v1/notifications/preferences` y el trabajador de outbox.
- **Decisiones:** D53 (outbox transaccional), D54 (correo stub), D55 (plantillas y críticas).
- **Paquete de revisión:** `docs/reviews/c3/rol-b.md`.

## 1. Modelo operativo

1. El cambio de negocio y el evento se escriben en la **misma transacción** (`evento_outbox`). Si la transacción falla, no hay evento.
2. Un trabajador en proceso reclama lotes con `FOR UPDATE SKIP LOCKED`: dos instancias no procesan la misma fila.
3. La entrega es idempotente por `(evento_id, usuario_id, canal)`: repetir un ciclo no duplica la notificación.
4. Los canales son `app` y `email`; en C3 el correo se entrega a un stub, no a un servidor SMTP.
5. Las notificaciones críticas (`matricula.*`, `seguridad.*`, `usuario.password_*`) no se pueden silenciar.

## 2. Configuración

```dotenv
OUTBOX_WORKER_ENABLED=true
OUTBOX_BATCH_SIZE=20
OUTBOX_POLL_INTERVAL_MS=5000
OUTBOX_MAX_ATTEMPTS=5
EMAIL_DRIVER=stub            # sólo "stub" en C3
```

La outbox **no arranca** con `NODE_ENV=test`; las pruebas llaman a `tick()` de forma determinista. En producción, si `OUTBOX_WORKER_ENABLED=false`, los eventos se acumulan en `pendiente` hasta que se habilite un trabajador.

## 3. Estados

| Tabla | Estado | Significado | Acción |
| --- | --- | --- | --- |
| `evento_outbox` | `pendiente` | Esperando turno | El trabajador lo tomará cuando `disponible_en <= now()` |
| `evento_outbox` | `procesando` | Reclamado por una instancia | Si supera el umbral de atasco, vuelve a `pendiente` |
| `evento_outbox` | `procesada` | Entregado y auditado | No se reprocesa |
| `evento_outbox` | `fallida` | Agotó `OUTBOX_MAX_ATTEMPTS` | Revisar `ultimo_error` y decidir reproceso |
| `notificacion` | `pendiente` | Creada, aún sin marcar entrega | Normal dentro del ciclo |
| `notificacion` | `enviada` | Entrega confirmada por el canal | — |
| `notificacion` | `leida` | El usuario la marcó como leída | — |
| `notificacion` | `fallida` | El canal falló (por ejemplo, sin contacto) | Revisar `notificacion.fallida` en auditoría |

Los reintentos usan backoff exponencial (`2^intentos` segundos) con un máximo de 5 minutos por espera.

## 4. Operación normal

### 4.1 Consultar la bandeja

```bash
curl "http://localhost:3000/api/v1/notifications?limit=20&offset=0" \
  -H "Authorization: Bearer <access-token>"
```

Sólo devuelve las notificaciones del usuario autenticado. `soloNoLeidas=true` filtra la bandeja.

### 4.2 Marcar como leída

```bash
curl -X PATCH "http://localhost:3000/api/v1/notifications/<id>" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"leida":true}'
```

Marcar una notificación ajena responde 404 `NOTIFICATION_NOT_FOUND`. La lectura no genera auditoría: se audita la entrega, no la consulta.

### 4.3 Preferencias

```bash
curl -X PUT "http://localhost:3000/api/v1/notifications/preferences" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"preferencias":[{"evento":"reporte.generado","canal":"email","habilitado":false}]}'
```

Reglas:

- El evento debe tener formato `dominio.accion`.
- El canal debe ser `app` o `email`.
- No se admiten duplicados en la misma solicitud.
- Deshabilitar un evento crítico responde 422 `NOTIFICATION_CRITICAL_NOT_SILENCEABLE`.
- Cada cambio real se audita como `preferencia.actualizada` con el antes y el después.

## 5. Diagnóstico

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| La bandeja no muestra un evento reciente | Outbox deshabilitada o evento aún pendiente | Revisar `evento_outbox` y `OUTBOX_WORKER_ENABLED` |
| Eventos en `pendiente` con `disponible_en` futuro | Backoff tras un fallo | Esperar o revisar `intentos` y `ultimo_error` |
| Eventos en `fallida` | Se agotaron los reintentos | Revisar la causa y reprocesar con autorización |
| `notificacion.fallida` con `CONTACT_NOT_FOUND` | El usuario no tiene correo | Corregir el contacto o deshabilitar el canal |
| `422 NOTIFICATION_CRITICAL_NOT_SILENCEABLE` | Se intentó silenciar una crítica | No es un fallo: la política lo impide |
| `404 NOTIFICATION_NOT_FOUND` | Notificación ajena o inexistente | Verificar el usuario y el `id` |
| `semilla` sin plantilla | Migración `0005` no aplicada | `pnpm migrate:status` y `pnpm migrate:up` |

## 6. Inspección y reproceso

### 6.1 Ver el atraso

```sql
-- Ejecutar como ccltpg_readonly o ccltpg_migrator.
select estado, count(*) as total, min(creado_en) as mas_antiguo
from public.evento_outbox
group by estado
order by estado;

select id, tipo, agregado, intentos, disponible_en, ultimo_error
from public.evento_outbox
where estado in ('pendiente', 'fallida')
order by creado_en
limit 50;
```

### 6.2 Ver la entrega de un evento

```sql
select usuario_id, canal, estado, enviada_en, leida_en
from public.notificacion
where evento_id = '<evento-id>'
order by canal;

select accion, request_id, ocurrido_en, datos_despues
from public.evento_auditoria
where request_id = '<evento-id>'
order by ocurrido_en;
```

### 6.3 Reprocesar un evento fallido

Requiere autorización y ticket. El reproceso manual reencola el evento; no se edita la notificación ya entregada.

```sql
-- Ejecutar como ccltpg_migrator, con ticket aprobado.
update public.evento_outbox
set estado = 'pendiente',
    intentos = 0,
    disponible_en = now(),
    procesado_en = null,
    ultimo_error = null
where id = '<evento-id>' and estado = 'fallida';
```

**Matiz importante:** el reproceso sirve cuando el evento falló antes de crear notificaciones (por ejemplo, un error de transacción o de auditoría). Si el evento ya creó una notificación y la entrega por canal falló, la fila existe con estado `fallida`; la clave única `(evento_id, usuario_id, canal)` impide recrearla y el reproceso no reenvía el mensaje. En C3 no hay reintento automático de entregas fallidas: se registra `notificacion.fallida`, se corrige la causa (por ejemplo, el contacto) y el reenvío se planifica en C5. No se borran ni se editan filas de `notificacion` a mano sin aprobación.

## 7. Plantillas y críticas

Las plantillas viven en `public.plantilla_notificacion`, únicas por `(codigo, canal)`. La migración siembra seis:

| Código | Canales |
| --- | --- |
| `notificacion.generica` | `app`, `email` |
| `reporte.generado` | `app`, `email` |
| `matricula.confirmada` | `app`, `email` |

Cambiar un texto exige una migración nueva que incremente `version`; no se edita la fila sembrada a mano. Las críticas se definen en código (`notification-policy.ts`), no en la base.

## 8. Límites de C3

- **No hay SMTP real.** `EMAIL_DRIVER` sólo admite `stub`; el envío se verifica hasta el puerto `EmailSender` y no registra PII.
- **No hay BullMQ.** La outbox en proceso es la decisión D53; la migración a cola se evalúa en C5.
- **No hay purga programada.** Los eventos procesados se conservan; la limpieza se define en C5.
- **No hay notificaciones de negocio reales.** C3 entrega el servicio y el evento `reporte.generado`; los eventos académicos llegan con C4/C6.

## 9. Verificación

```bash
pnpm --filter @ccltpg/api test src/modules/notifications
pnpm test:integration        # con DATABASE_*_URL y PostgreSQL real
```

Evidencia esperada:

- `notification-policy.spec.ts`: canales cerrados, críticas y formato de evento.
- `notifications.service.spec.ts`: bandeja propia, marcado, preferencias y rechazo de críticas.
- `notification-dispatcher.spec.ts`: destinatarios, preferencia deshabilitada, canal de correo y fallo.
- Integración: outbox procesada una vez, dos canales, dos auditorías y no reentrega en el segundo ciclo.
