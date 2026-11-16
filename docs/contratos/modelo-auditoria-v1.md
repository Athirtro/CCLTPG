# Modelo de auditoría v1.0 (propuesta Rol B)

- **Estado:** Propuesta para **ratificación en Compuerta 0**. Complementa el cap. 11 del diseño y el ADR-0004; no sustituye el diccionario de datos (propiedad de Rol A).
- **Fecha:** 2026-11-16
- **Responsable:** Rol B (seguridad, identidad y operación)
- **Alcance:** modelo lógico de `public.evento_auditoria`, catálogo de eventos, reglas de redacción, inmutabilidad verificable, escritura transaccional, consulta y retención.
- **Fuentes:** diseño caps. 4.2, 7.2, 11, 12, 13; `docs/diccionario-datos.md` §2.7 y §4; `docs/contratos/matriz-autorizacion-v1.md`; `docs/contratos/auth-v1.md`; ADR-0004; R-023, R-030, R-031.
- **Regla:** toda adición al modelo se propone como resolución (R-030/R-031) para que Rol A actualice el diccionario y Rol C el OpenAPI. Nada de este documento es vinculante hasta C0.

## 1. Principios

| # | Principio | Consecuencia |
| --- | --- | --- |
| P1 | **Solo inserción** | La aplicación no actualiza ni borra eventos; la base lo impide con privilegios y disparador. |
| P2 | **Trazabilidad de negocio** | El evento describe la acción de negocio, no el `INSERT`/`UPDATE` físico. |
| P3 | **Minimización** | Se copia lo necesario para reconstruir el cambio; nunca secretos ni PII sensible completa. |
| P4 | **Atomicidad** | El evento se escribe en la misma transacción que el cambio; si falla, la operación se revierte. |
| P5 | **Corrección por compensación** | El pasado no se edita: se añade un evento que explica y corrige. |
| P6 | **Consulta restringida y auditada** | Solo `audit:event:read`; la propia consulta genera evento. |
| P7 | **Correlación** | `request_id` enlaza evento, log estructurado y traza. |

## 2. Modelo de datos

### 2.1 Cambios respecto al diccionario vigente (R-030)

| Cambio | Detalle | Motivo |
| --- | --- | --- |
| Semántica de `recurso` | Pasa a ser el **tipo** de recurso (`usuario`, `estudiante`, `matricula`, `clase`, `archivo`, …), no una cadena libre con el id embebido. | Permite filtrar por tipo y consultar el historial de un registro. |
| Nuevo `recurso_id` | `uuid` nulo; nulo en eventos de colección, login fallido sin usuario y consultas globales. | Historial por registro e índice eficiente. |
| Índices | `(recurso, recurso_id, ocurrido_en)`, `(accion, ocurrido_en)`, `(request_id)`; se conservan `(ocurrido_en)` y `(actor_id, ocurrido_en)`. | Filtros del endpoint de consulta y correlación de incidentes. |
| Comentario de columna | `recurso` documentado como tipo; `actor_perfil` documentado como perfil que autorizó. | Evita la ambigüedad actual. |

Sin otros cambios de esquema: no se añaden columnas de hash ni de estado (ver ADR-0004 §8 y PA-016).

### 2.2 Estructura resultante

| Campo | Tipo | Nulo | Regla |
| --- | --- | --- | --- |
| `id` | uuid | No | PK; UUIDv7 (ordenable por tiempo). |
| `actor_id` | uuid | Sí | Usuario que ejecuta; nulo solo en eventos de sistema y login fallido sin cuenta. |
| `actor_perfil` | text | Sí | Perfil que **otorgó** el permiso (`estudiante`, `educador`, `administrador`, `sistema`); no el perfil “activo” del cliente. |
| `ip` | inet | Sí | IP de origen; se conserva completa por respuesta a incidentes. |
| `dispositivo` | text | Sí | `User-Agent` truncado a 512 caracteres. |
| `recurso` | text | No | Tipo de recurso (lista del §3). |
| `recurso_id` | uuid | Sí | Identificador del registro afectado; nulo en colecciones. |
| `accion` | text | No | Evento del catálogo, formato `recurso.accion`. |
| `datos_antes` | jsonb | Sí | Estado previo **redactado**; nulo en creaciones. |
| `datos_despues` | jsonb | Sí | Estado posterior **redactado**; nulo en borrados lógicos sin datos. |
| `ocurrido_en` | timestamptz | No | UTC, generado por el servidor. |
| `request_id` | text | Sí | `requestId` de la solicitud; obligatorio en eventos de API. |

### 2.3 Restricciones

- `accion` cumple `^[a-z_]+\.[a-z_]+$` (CHECK). La pertenencia al catálogo se valida en CI, no con un CHECK que obligue a migrar por cada evento.
- `jsonb` limitado a **8 KB** por campo; si el diff lo supera, se guarda `{"resumen": "...", "hash_sha256": "...", "campos": n}`.
- `ocurrido_en` se valida en el servicio con una tolerancia de ±5 minutos; no se usa un CHECK con `now()` para no romper la restauración de respaldos.
- No hay FK a `usuario` ni a recursos académicos: la auditoría sobrevive a la anonimización y al borrado lógico.

## 3. Catálogo de eventos (v1.0)

Convención: `recurso.accion`, en español, participio para acciones consumadas (`creado`, `cerrada`) y `fallida` para fallos. `recurso` es el tipo del §2.1.

> **Nota de nomenclatura:** las **sesiones de clase** usan el prefijo `clase.*` y `recurso = clase` para no colisionar con las **sesiones de autenticación**, que usan `sesion.*`. El inventario y la matriz se alinean a esta convención (corrección de H-07).

### 3.1 Autenticación y sesión

| Evento | Cuándo | `recurso` / `recurso_id` | `datos_antes` | `datos_despues` |
| --- | --- | --- | --- | --- |
| `sesion.credenciales_verificadas` | Contraseña correcta antes de MFA | `usuario` / id | — | `{amr_previsto}` |
| `sesion.iniciada` | Sesión completa emitida | `usuario` / id | — | `{amr, perfiles}` |
| `sesion.fallida` | Credencial inválida, cuenta inactiva o bloqueada | `usuario` / id o nulo | — | `{motivo, email_hmac}` |
| `sesion.mfa_verificada` | TOTP o recuperación correctos | `usuario` / id | — | `{metodo}` |
| `sesion.mfa_fallida` | Código incorrecto | `usuario` / id | — | `{metodo, intento}` |
| `sesion.mfa_agotada` | Se agotan los intentos del token parcial | `usuario` / id | — | `{intentos}` |
| `sesion.refresh_reutilizado` | Token ya rotado o revocado | `usuario` / id | — | `{familia_id, ip, user_agent}` |
| `sesion.cerrada` | Logout o cierre por el usuario | `usuario` / id | — | `{familia_id, motivo}` |
| `sesion.revocada` | Revocación por administrador, cambio de contraseña o estado | `usuario` / id | — | `{motivo, familias}` |

### 3.2 Identidad

| Evento | Cuándo | `recurso` / `recurso_id` | `datos_antes` | `datos_despues` |
| --- | --- | --- | --- | --- |
| `usuario.creado` | Alta de usuario | `usuario` / id | — | `{email_hmac, estado, perfiles}` |
| `usuario.actualizado` | Cambio de datos no sensibles | `usuario` / id | diff | diff |
| `usuario.activado` | Transición a activo | `usuario` / id | `{estado}` | `{estado}` |
| `usuario.desactivado` | Transición a inactivo | `usuario` / id | `{estado}` | `{estado, motivo}` |
| `usuario.bloqueado` | Bloqueo por intentos o administrador | `usuario` / id | `{estado}` | `{estado, motivo, intentos}` |
| `usuario.desbloqueado` | Desbloqueo administrativo | `usuario` / id | `{estado}` | `{estado, motivo}` |
| `usuario.perfil_asignado` | Asignación de perfil | `usuario` / id | — | `{perfil, valid_until}` |
| `usuario.perfil_revocado` | Retiro de perfil | `usuario` / id | `{perfil}` | `{perfil, motivo}` |
| `usuario.password_cambiada` | Cambio propio | `usuario` / id | — | `{sesiones_revocadas}` |
| `usuario.password_reseteada` | Reset administrativo | `usuario` / id | — | `{sesiones_revocadas, forzado: true}` |
| `usuario.mfa_inscrita` | Confirmación de inscripción MFA | `usuario` / id | — | `{metodo}` |
| `usuario.mfa_reset` | Reset administrativo de MFA | `usuario` / id | `{mfa_habilitado}` | `{mfa_habilitado, motivo}` |
| `usuario.mfa_recovery_regenerada` | Regeneración de códigos | `usuario` / id | — | `{cantidad}` |
| `usuario.mfa_recovery_usada` | Uso de un código de recuperación | `usuario` / id | — | `{restantes}` |

### 3.3 Académico

| Evento | Cuándo | `recurso` / `recurso_id` | `datos_antes` | `datos_despues` |
| --- | --- | --- | --- | --- |
| `programa.creado` / `programa.publicado` / `programa.archivado` | Alta y transiciones | `programa` / id | `{estado}` | `{estado}` |
| `grupo.creado` / `grupo.cerrado` | Alta y cierre | `grupo` / id | `{estado}` | `{estado}` |
| `horario.modificado` | Alta o cambio de horario | `grupo` / id | `{franjas: n}` | `{franjas: n}` |
| `estudiante.creado` | Alta de estudiante | `estudiante` / id | — | `{nombres_iniciales, apellidos_iniciales, documento_cargado: true, consentimiento: true}` |
| `estudiante.actualizado` | Cambio de datos | `estudiante` / id | diff redactado | diff redactado |
| `estudiante.anonimizado` | Supresión por anonimización | `estudiante` / id | `{anonimizado: false}` | `{anonimizado: true, motivo}` |
| `consentimiento.registrado` | Registro de consentimiento | `estudiante` / id | — | `{version_aviso, fecha}` |
| `consentimiento.revocado` | Revocación | `estudiante` / id | `{vigente: true}` | `{vigente: false, motivo}` |
| `matricula.creada` / `matricula.confirmada` / `matricula.activada` / `matricula.finalizada` / `matricula.cancelada` / `matricula.retirada` | Transición correspondiente | `matricula` / id | `{estado}` | `{estado, motivo?}` |
| `clase.creada` / `clase.realizada` / `clase.cancelada` | Alta y transiciones de la sesión de clase | `clase` / id | `{estado}` | `{estado}` |
| `asistencia.registrada` | Registro masivo de asistencia | `clase` / id | — | `{registros: n, presentes: n, ausentes: n}` |
| `asistencia.corregida` | Corrección posterior | `clase` / id | `{registros: n}` | `{registros: n, motivo}` |
| `evaluacion.registrada` | Alta de evaluación | `evaluacion` / id | — | `{indicador_id, periodo, valor}` |
| `evaluacion.actualizada` | Corrección | `evaluacion` / id | `{valor}` | `{valor, motivo}` |
| `indicador.creado` / `indicador.actualizado` | Gestión de indicadores (C4) | `indicador` / id | diff | diff |

### 3.4 Archivos, notificaciones y auditoría

| Evento | Cuándo | `recurso` / `recurso_id` | `datos_antes` | `datos_despues` |
| --- | --- | --- | --- | --- |
| `archivo.subido` | Carga completada | `archivo` / id | — | `{mime, tamano, hash_sha256}` |
| `archivo.descargado` | Descarga autorizada | `archivo` / id | — | `{mime, tamano}` |
| `archivo.eliminado` | Baja lógica | `archivo` / id | `{estado}` | `{estado, motivo}` |
| `archivo.cuarentena` | Escaneo detecta amenaza | `archivo` / id | `{estado_escaneo}` | `{estado_escaneo, firma}` |
| `notificacion.enviada` | Entrega correcta | `notificacion` / id | — | `{canal, plantilla}` |
| `notificacion.fallida` | Error de entrega | `notificacion` / id | — | `{canal, motivo}` |
| `preferencia.actualizada` | Cambio de preferencias | `usuario` / id | diff | diff |
| `auditoria.consultada` | Consulta al endpoint de auditoría | `evento_auditoria` / nulo | — | `{filtros, resultados}` |
| `auditoria.correccion` | Evento compensatorio | `evento_auditoria` / id del original | — | `{justificacion}` |

### 3.5 Evento opcional de seguridad (C8)

| Evento | Cuándo | Regla |
| --- | --- | --- |
| `seguridad.acceso_denegado` | 403/404 por ámbito repetidos sobre un usuario | **Opcional en v1.0**; si se activa, se agrega por ventana (máximo 1 evento por usuario y 5 minutos) para evitar ruido. |

## 4. Reglas de redacción

| Campo | Tratamiento en `datos_antes`/`datos_despues` |
| --- | --- |
| `password`, `password_hash` | **Nunca** se copian, ni completos ni parciales. |
| `mfa_secret_cifrado`, códigos TOTP, códigos de recuperación | **Nunca**; solo `metodo` o `cantidad`. |
| Access token, refresh token, token parcial, CSRF | **Nunca**; solo identificadores de familia (`familia_id`). |
| `numero_documento` | Nunca el valor; `{"cambiado": true}`. |
| `telefono`, `direccion` | Nunca el valor; `{"cambiado": true}`. |
| `email` | `email_hmac` (HMAC-SHA256 con clave separada, 16 hex) y `email_dominio` solo si es institucional. |
| `observacion` y texto libre | `{"cambiado": true, "longitud": n}`; nunca contenido. |
| `nombres`, `apellidos` | En creación se guardan iniciales; en actualización, `{"cambiado": true}`. |
| Consentimiento | Versión y fecha, no el texto del aviso. |
| IP y `User-Agent` | Se conservan (fin de seguridad); el `User-Agent` se trunca a 512 caracteres. |

Reglas adicionales:

1. **Diff mínimo:** solo campos modificados; si no hay cambios, no se emite evento.
2. **Sin secretos por accidente:** el serializador de auditoría usa lista blanca por evento; un campo no declarado no se copia (falla cerrada, no abierta).
3. **Clave HMAC separada** de las de cifrado y de la del índice ciego (ADR-0003); rotación anual documentada.
4. **Prueba de grep:** los fixtures de auditoría se someten a una búsqueda de patrones de secretos y PII prohibida en CI (C2).

## 5. Inmutabilidad

### 5.1 Privilegios

```sql
-- Rol de aplicación: solo inserción y lectura.
GRANT INSERT, SELECT ON public.evento_auditoria TO ccltpg_app;
REVOKE UPDATE, DELETE, TRUNCATE ON public.evento_auditoria FROM ccltpg_app;
-- El rol de migración conserva DDL, pero el disparador impide DML sobre la tabla.
```

### 5.2 Disparador

```sql
CREATE OR REPLACE FUNCTION public.auditoria_solo_insercion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'public.evento_auditoria es de solo inserción'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER trg_auditoria_no_update_delete
  BEFORE UPDATE OR DELETE ON public.evento_auditoria
  FOR EACH ROW EXECUTE FUNCTION public.auditoria_solo_insercion();

CREATE TRIGGER trg_auditoria_no_truncate
  BEFORE TRUNCATE ON public.evento_auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION public.auditoria_solo_insercion();
```

### 5.3 Verificación (C2)

| Prueba | Acción | Resultado esperado |
| --- | --- | --- |
| T-AUD-01 | `UPDATE public.evento_auditoria SET accion = 'x'` como `ccltpg_app` | Error de privilegios |
| T-AUD-02 | `DELETE FROM public.evento_auditoria` como `ccltpg_app` | Error de privilegios |
| T-AUD-03 | `TRUNCATE public.evento_auditoria` como `ccltpg_migrator` | Error del disparador |
| T-AUD-04 | `INSERT` válido como `ccltpg_app` | Éxito |
| T-AUD-05 | `has_table_privilege('ccltpg_app', 'public.evento_auditoria', 'UPDATE')` | `false` |

### 5.4 Corrección y restauración

- **Corrección:** `auditoria.correccion` con `justificacion` obligatoria (validada en el servicio) y `recurso_id` del evento corregido. No se altera el original.
- **Restauración de respaldo:** un `PITR` puede eliminar eventos posteriores al punto restaurado. Es un procedimiento de excepción: exige aprobación del responsable, registro en el runbook y un evento `auditoria.correccion` posterior que documente la pérdida. Se prueba en el simulacro de C5.

## 6. Escritura transaccional

1. El interceptor de auditoría recibe `request_id`, actor y `actor_perfil` resueltos por el guard.
2. El servicio de negocio abre transacción, aplica el cambio y llama a `auditoria.registrar(evento)` con la misma conexión.
3. `registrar` valida el evento contra el catálogo (nombre, campos permitidos, tamaño) **antes** de insertar.
4. Si el `INSERT` falla, la transacción se revierte y la API responde 503 `SERVICE_UNAVAILABLE` (sin exponer el detalle).
5. En lecturas auditadas, el `INSERT` ocurre antes de serializar la respuesta.
6. Los eventos de sistema (tareas programadas, migraciones de datos) usan `actor_id = null` y `actor_perfil = 'sistema'`; el `request_id` es el del trabajo.

**Excepción controlada:** los eventos de autenticación que ocurren antes de tener una transacción de negocio (login fallido) se escriben en una transacción propia; si falla la escritura, el login falla igualmente con 401 y se emite alerta. No se acepta un login exitoso sin evento: si la auditoría no está disponible, el login responde 503.

## 7. Consulta

`GET /audit/events` (permiso `audit:event:read`, ámbito global):

| Parámetro | Tipo | Regla |
| --- | --- | --- |
| `actorId` | uuid | Opcional. |
| `recurso` | enum del §3 | Opcional. |
| `recursoId` | uuid | Opcional; exige `recurso`. |
| `accion` | string | Opcional; debe existir en el catálogo. |
| `desde`, `hasta` | ISO-8601 UTC | Por defecto últimos 30 días; rango máximo 366 días. |
| `page`, `pageSize` | enteros | `pageSize` ≤ 100. |

- Orden descendente por `ocurrido_en` (desempate por `id`).
- Respuesta con los campos del §2.2 y los payloads **ya redactados**; nunca se devuelven datos sin redactar.
- Cada consulta emite `auditoria.consultada` con los filtros y el número de resultados; no se copian las filas consultadas.
- Sin exportación ni detalle por id en v1.0 (C8).
- Si el rango supera el máximo o el filtro es ambiguo → 400 `VALIDATION_FAILED`.

## 8. Retención

- **Auditoría:** ≥ 5 años (PA-011, valor por defecto), sin borrado por la aplicación; la depuración/archivado es una tarea operativa del DBA con aprobación y registro.
- **PII:** mientras dure la relación y el plazo institucional; la supresión se hace por anonimización del registro vivo, nunca del evento.
- **Respaldos:** misma retención que la auditoría; las claves de descifrado se custodian por separado.
- **Staging:** sin datos reales; copia anonimizada (control C-24).

## 9. Trazabilidad CAR-12

| Operación (matriz) | Evento(s) | `recurso` |
| --- | --- | --- |
| OP-01…OP-05 (auth y `/me`) | §3.1; `/me` no audita | `usuario` |
| OP-06…OP-10 (identidad) | §3.2 | `usuario` |
| OP-11…OP-18, OP-48 (programas, grupos, estudiantes) | §3.3 | `programa`, `grupo`, `estudiante` |
| OP-20/21 (matrícula) | `matricula.*` | `matricula` |
| OP-24/25, OP-37/38, OP-46/47 (clases y horario) | `clase.*`, `horario.modificado` | `clase`, `grupo` |
| OP-26, OP-39 (asistencia) | `asistencia.*` | `clase` |
| OP-27, OP-40/41 (evaluación) | `evaluacion.*` | `evaluacion` |
| OP-29/30 (archivos) | `archivo.*` | `archivo` |
| OP-31…OP-34 (notificaciones) | `preferencia.actualizada`; lectura propia no se audita | `usuario` |
| OP-35 (auditoría) | `auditoria.consultada` | `evento_auditoria` |

## 10. Criterios de aceptación

Los criterios verificables están en `docs/requirements/seguridad.md` §4 (AC-AUD-01…AC-AUD-15). Este documento fija el modelo; el requisito fija la prueba.

## 11. Qué no se hizo

- No se modificó el diccionario ni el OpenAPI: los cambios son R-030/R-031 para Rol A y Rol C.
- No se implementaron migraciones, disparadores ni interceptor (C2).
- No se definió retención definitiva (PA-011) ni sellado criptográfico (PA-016).
- No se auditó la lectura de datos propios (`/me/*`) ni cada refresh válido, por decisión de minimización y ruido.
