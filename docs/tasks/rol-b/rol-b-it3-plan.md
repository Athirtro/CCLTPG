# Plan de trabajo — Iteración 3 (Rol B)

- **Fecha:** 19 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Iteración objetivo:** **C3 — Archivos, notificaciones y exportaciones** (Release 1.0)
- **Estado:** **Ejecutada con límites de evidencia.** RB1-20…RB1-27 implementados y verificados localmente; ratificación formal, MinIO y CI en GitHub pendientes. Ver `docs/reviews/c3/rol-b.md` y `docs/tasks/rol-b/rol-b-it3-registro.md`.
- **Plan predecesor:** `docs/tasks/rol-b/rol-b-it2-plan.md` (bloques RB1-15…RB1-19).
- **Paquete de revisión previo:** `docs/reviews/c2/rol-b.md`.
- **Requisitos:** `docs/requirements/seguridad.md` (AC-SEC-27, AC-SEC-30, AC-AUD-04; compuerta C3 en §6).
- **Controles:** `docs/contratos/controles-seguridad-v1.md` (C-35, C-38; cierre de C3 en §9).
- **Diseño:** `docs/diseno-arquitectonico.md` (§10.2–10.5, §18.2, §19).

## 1. Objetivo de la iteración

Entregar los tres servicios compartidos que el resto de módulos consumirá, con sus contratos congelados y con la seguridad verificada antes de que existan datos académicos reales:

1. **Archivos:** carga con lista blanca, límite de tamaño, hash, deduplicación, escaneo y cuarentena; descarga siempre autorizada y auditada.
2. **Notificaciones:** bus de eventos de dominio, plantillas versionadas, preferencias por usuario, canales `app` y `email` detrás de puertos, y bandeja de solo lectura propia.
3. **Exportaciones:** registro de plantillas, entrada JSON saneada sin acceso directo a la base, salidas PDF/Excel/CSV y vínculo con el servicio de archivos.
4. **Idempotencia transversal:** `Idempotency-Key` en creaciones con efectos secundarios (AC-SEC-30, C-38), empezando por cargas y exportaciones.
5. **Contratos congelados** de los tres servicios, con matriz de autorización y catálogo de eventos actualizados.

La iteración **no implementa** reportes académicos reales, dashboards ni envío real de correo: eso llega en C6/C8. C3 entrega el servicio y un reporte de muestra.

## 2. Criterios de salida y Compuerta 3

Según `docs/requirements/seguridad.md` §6 y el diseño §18.2:

| Condición | Criterio verificable |
| --- | --- |
| **C3 se considera completa** cuando | AC-SEC-27 y AC-AUD-04 tienen evidencia; los contratos de archivos, notificaciones y exportaciones están congelados; la matriz cubre el 100 % de las operaciones nuevas con caso permitido y denegado. |
| **Compuerta 3 — abuso de cargas y descargas** | Se demuestra rechazo por tamaño, MIME no permitido, MIME falsificado, nombre malicioso, archivo infectado (EICAR), descarga ajena (404) y repetición con la misma `Idempotency-Key`. |
| **Compuerta 3 — destinatarios correctos** | Cada evento del catálogo resuelve el destinatario esperado; un usuario no puede leer ni marcar notificaciones de otro; las notificaciones críticas no se pueden silenciar. |
| **Compuerta 3 — documentos generados abiertos correctamente** | Un PDF, un XLSX y un CSV de muestra se abren en sus aplicaciones reales, conservan caracteres UTF-8 y no contienen fórmulas inyectadas. |
| **Congelamiento** | Se congelan las rutas, los esquemas de carga/descarga, el modelo de notificación, el registro de plantillas de exportación y los eventos `archivo.*`, `notificacion.*`, `preferencia.actualizada` y `reporte.generado`. |

Regla de bloqueo: sin evidencia enlazada, la compuerta no se aprueba aunque el código funcione.

## 3. Alcance propuesto (tareas)

Convención: se continúa la numeración `RB1-nn` del Rol B.

| ID | Tarea | Entregable | Criterios que impulsa | Depende de |
| --- | --- | --- | --- | --- |
| RB1-20 | Fundaciones de C3 | Migraciones `0004` (archivos), `0005` (notificaciones) y `0006` (idempotencia + outbox); puertos de almacenamiento, escaneo, eventos y correo; configuración `OBJECT_STORAGE_*` y límites; pruebas `up/down/up` | AC-SEC-27, AC-SEC-30, AC-SEC-31 | C2 firmada o aceptada con condiciones |
| RB1-21 | Carga segura de archivos | `POST /files` multipart; 10 MB; lista blanca; verificación por bytes mágicos; nombre saneado; SHA-256; deduplicación; cuarentena; auditoría `archivo.subido`/`archivo.cuarentena` | AC-SEC-27, C-35 | RB1-20 |
| RB1-22 | Descarga autorizada | `GET /files/{id}/download`; permiso global o propio; 404 para ajeno; `Content-Disposition: attachment`; `nosniff`; sin URLs públicas; auditoría `archivo.descargado` antes de responder | AC-SEC-18 (archivos), AC-AUD-04, C-16/C-19 | RB1-21 |
| RB1-23 | Notificaciones | Bus/outbox transaccional; plantillas versionadas; preferencias; catálogo de críticas; canales `app` y `email` (stub); `GET /notifications`, `PATCH /notifications/{id}`, `GET`/`PUT /notifications/preferences`; auditoría de envío/fallo y preferencias | CAR-09, C-27 | RB1-20 |
| RB1-24 | Exportaciones | Registro de plantillas con versión y esquema JSON; renderizado PDF/Excel/CSV; límites de filas y tamaño; salida registrada como `archivo`; `POST /exports`; auditoría `reporte.generado` | CAR-04 (base), C-27 | RB1-20, RB1-22 |
| RB1-25 | Idempotencia | `Idempotency-Key` obligatoria en `POST /files` y `POST /exports`; misma clave y mismo cuerpo devuelve el resultado original; cuerpo distinto devuelve 409 `IDEMPOTENCY_KEY_REUSED`; TTL y limpieza | AC-SEC-30, C-38 | RB1-21, RB1-24 |
| RB1-26 | Contrato, permisos y matriz | 7 operaciones nuevas con `x-access`, `x-permission`, `x-scope`, `x-audit-event`; R-020 y R-029 en semillas; evento `reporte.generado`; matriz ejecutable ampliada; validador de contrato | AC-SEC-16/17/20, AC-AUD-13, C-15/C-27 | RB1-21…25 |
| RB1-27 | Pruebas de compuerta, CI y runbooks | Suite de abuso, EICAR, MIME falsificado, deduplicación, destinatarios, PDF/XLSX/CSV, PII, outbox y 503; runbooks de archivos/notificaciones/exportaciones; paquete `docs/reviews/c3/rol-b.md` | Compuerta 3 completa | RB1-20…26 |

**Delegación a Rol C:** pantallas de carga/descarga, bandeja de notificaciones y preferencias, y descarga de exportaciones. Rol B define contrato, permisos y pruebas de API; la navegación desde `/me` sigue siendo de Rol C (AC-SEC-21).

## 4. Decisiones propuestas para C3 (numeración provisional D49…D58)

| Decisión | Propuesta | Recomendación | Reversibilidad |
| --- | --- | --- | --- |
| D49 — Almacenamiento | Puerto `ObjectStorage` con adaptador S3 (MinIO en desarrollo) y adaptador de sistema de archivos local para desarrollo y pruebas; descarga siempre a través de la API; sin URLs prefirmadas ni bucket público | **A — API como única puerta** | Media |
| D50 — Endurecimiento de carga | 10 MB, un archivo por solicitud, lista blanca (`pdf`, `png`, `jpg`, `docx`, `xlsx`), verificación por bytes mágicos además del MIME declarado, nombre saneado y clave de objeto derivada de UUID, no del nombre | **A — fijado** | Barata |
| D51 — Antimalware | Puerto `MalwareScanner`; implementación stub que detecta EICAR y firma de prueba; estado `infectado` → cuarentena y descarga 404; proveedor real se decide en C5/C8 (SUP-008) | **A — stub probado con EICAR** | Barata |
| D52 — Descarga | Permiso `files:document:read` (global) o `files:document:read_own` (propio); ajeno → 404; auditoría antes de responder; `Content-Type` permitido, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` | **A — fijado** | Costosa si se cambia el contrato |
| D53 — Bus de eventos | **Outbox transaccional en PostgreSQL** + trabajador en proceso con `FOR UPDATE SKIP LOCKED`, reintentos con backoff y estado `fallida`; BullMQ se evalúa en C5 | **A — outbox sin dependencia nueva** | Media (migrar a BullMQ después) |
| D54 — Canal de correo | Puerto `EmailSender`; adaptador `stub` en desarrollo que registra el envío sin PII; SMTP real en C5/C8 cuando exista proveedor | **A — stub explícito** | Barata |
| D55 — Plantillas de notificación | Plantillas versionadas en `public.plantilla_notificacion` sembradas por migración; clave única `(codigo, canal)`; las críticas se definen en código y no son silenciables | **A — fijado** | Media |
| D56 — Plantillas de exportación | Registro en código con `codigo`, `version` y esquema JSON; sin tabla nueva ni acceso a base; formatos `pdf`, `xlsx`, `csv`; salida máxima 10 MB y 10 000 filas | **A — registro code-first** | Media |
| D57 — Idempotencia | `Idempotency-Key` obligatoria en `POST /files` y `POST /exports`; almacenamiento por usuario + operación + hash canónico del cuerpo; repetición exacta devuelve la respuesta original; cuerpo distinto → 409; TTL 24 h | **A — fijado** | Media |
| D58 — Contrato y catálogo | Añadir `reporte.generado`; ratificar R-020 (`notifications:notification:update_own`, `notifications:preference:read_own`) y R-029 (`files:document:read_own` para educador); sin rutas públicas nuevas | **A — ratificar antes de congelar** | Costosa tras el congelamiento |

## 5. Dependencias nuevas propuestas

| Dependencia | Uso | Estado |
| --- | --- | --- |
| `@aws-sdk/client-s3` | Adaptador S3 compatible con MinIO | Propuesta; fijar versión exacta al instalar |
| `file-type` | Verificación de MIME por bytes mágicos | Propuesta; fijar versión exacta |
| `pdfkit` + `@types/pdfkit` | Generación de PDF | Propuesta; fijar versión exacta |
| `exceljs` | Generación de XLSX | Propuesta; fijar versión exacta |

`multer` ya llega con `@nestjs/platform-express`; si se usa `FileInterceptor`, se declara explícitamente y se fija la versión. **No** se añade cliente de correo (`nodemailer`) hasta que exista SMTP real. **No** se añade `bullmq` en C3.

Cada dependencia se instala con versión exacta (`-E`), se registra en el paquete de revisión y requiere ratificación del equipo, igual que `argon2` y `jose` en C2.

## 6. Requisitos que deben cerrarse antes de iniciar C3

1. **C2 aprobada** o aceptada formalmente con condiciones; sin compuerta 2 firmada no se abre C3.
2. **Ratificación de D49…D58** y de las dependencias de §5.
3. **R-020** (`notification:update_own`, `preference:read_own`) y **R-029** (`files:document:read_own` para educador) ratificadas.
4. **`reporte.generado`** aprobado como evento de auditoría, o una alternativa explícita.
5. **AC-FUN de CAR-09** (PA-017) antes de C3, y definición del reporte de muestra de CAR-04.
6. **Proveedor de correo** o aceptación del stub de D54.
7. **Antimalware**: aceptación del stub con EICAR o definición de proveedor (SUP-008).
8. **MinIO operativo** o aceptación del adaptador local como evidencia de C3, con la deuda de S3 registrada.
9. **Política de retención de archivos** (PA-011) al menos como valor por defecto; sin ella no se implementa borrado.

## 7. Plan de fases propuesto

1. **Fase 1 — Fundaciones:** migraciones `0004`–`0006`, puertos (`ObjectStorage`, `MalwareScanner`, `DomainEventBus`, `EmailSender`, `IdempotencyStore`), configuración, outbox e idempotencia; `up/down/up` contra PostgreSQL 16 real.
2. **Fase 2 — Archivos (escritura):** multipart, límites, lista blanca, bytes mágicos, nombre saneado, SHA-256, deduplicación, escaneo stub, cuarentena y auditoría.
3. **Fase 3 — Archivos (lectura):** descarga autorizada, 404 para ajeno, cabeceras seguras, auditoría antes de responder y pruebas de ámbito propio.
4. **Fase 4 — Notificaciones:** outbox, consumidor, plantillas, preferencias, críticas, canales `app`/`email` stub, bandeja y marcado de lectura.
5. **Fase 5 — Exportaciones:** registro de plantillas, validación de entrada, PDF/XLSX/CSV, límites, registro como archivo, descarga y auditoría.
6. **Fase 6 — Contrato y compuerta:** 7 operaciones en OpenAPI, matriz, eventos, pruebas de abuso, runbooks, paquete `docs/reviews/c3/rol-b.md` y registro de ejecución.

## 8. Operaciones y permisos propuestos

| OP | Operación | Acceso | Permiso | Ámbito | Auditoría |
| --- | --- | --- | --- | --- | --- |
| C3-01 | `POST /files` | permiso | `files:document:create` | global | `archivo.subido` |
| C3-02 | `GET /files/{id}/download` | permiso | `files:document:read` **o** `files:document:read_own` | mixed | `archivo.descargado` |
| C3-03 | `GET /notifications` | permiso | `notifications:notification:read_own` | own | — (lectura propia) |
| C3-04 | `PATCH /notifications/{id}` | permiso | `notifications:notification:update_own` (R-020) | own | — (marcado de lectura) |
| C3-05 | `GET /notifications/preferences` | permiso | `notifications:preference:read_own` (R-020) | own | — |
| C3-06 | `PUT /notifications/preferences` | permiso | `notifications:preference:update_own` | own | `preferencia.actualizada` |
| C3-07 | `POST /exports` | permiso | `exports:report:export` | global | `reporte.generado` |

- **Total del contrato:** 17 operaciones de C2 + 7 de C3 = **24 operaciones**; se mantienen **4 rutas públicas** y **0 rutas anónimas nuevas**.
- **Catálogo de permisos:** 35 + 2 de R-020 = **37**; R-029 no crea permiso, sólo asigna uno existente al educador.
- **Catálogo de eventos:** 60 + 1 (`reporte.generado`) = **61**, salvo que el equipo prefiera reutilizar un evento existente.
- La descarga de exportaciones **reutiliza** `GET /files/{id}/download`; no se crea una segunda ruta de descarga.
- No se expone `GET /files` (listado) ni borrado en C3: no están en la matriz y añadirían superficie sin criterio aprobado.

## 9. Modelo de datos propuesto

### 9.1 Tablas del diccionario

- `public.archivo`: `id`, `nombre_original`, `mime`, `tamano`, `hash_sha256`, `ruta_objeto`, `subido_por`, `estado_escaneo`, `creado_en`. Índices por `hash_sha256`, `subido_por` y `(estado_escaneo, creado_en)`.
- `public.notificacion`: `id`, `usuario_id`, `evento`, `canal`, `plantilla_id`, `payload`, `estado`, `leida_en`, `enviada_en`. Índice `(usuario_id, leida_en)` y único `(evento_id, usuario_id, canal)` si se añade `evento_id` para idempotencia de entrega.
- `public.preferencia_notificacion`: clave única `(usuario_id, evento, canal)`; `habilitado`.
- `public.plantilla_notificacion`: única `(codigo, canal)`; `asunto`, `cuerpo`, versión.

### 9.2 Propuestas de cambio para Rol A

1. **R-032 — Idempotencia:** tabla `public.idempotency_key` con `usuario_id`, `operacion`, `clave`, `hash_solicitud`, `estado`, `respuesta_status`, `respuesta_cuerpo` (jsonb), `creado_en`, `expira_en`; única `(usuario_id, operacion, clave)`.
2. **R-033 — Outbox:** tabla `public.evento_outbox` con `id`, `agregado`, `tipo`, `payload` (jsonb), `estado`, `intentos`, `disponible_en`, `creado_en`, `procesado_en`; índice `(estado, disponible_en)`.
3. **R-009 (ratificación):** semántica del estado de `notificacion` (`pendiente`, `enviada`, `leida`, `fallida`) y unicidad de preferencias/plantillas.
4. **`reporte.generado`** en el catálogo de auditoría, con `recurso = archivo` y `recurso_id = archivo.id`.

**No se edita el diccionario**: los cambios se registran aquí para que Rol A los ratifique y los aplique, igual que R-030 en C2.

## 10. Matriz de pruebas de compuerta

| Área | Casos mínimos |
| --- | --- |
| Carga | 10 MB exactos y 10 MB + 1 byte; MIME permitido y no permitido; MIME declarado falso con bytes mágicos reales; nombre con `../`, control chars y Unicode; archivo vacío |
| Malware | EICAR detectado → `infectado` → cuarentena → descarga 404; auditoría `archivo.cuarentena`; el objeto no se sirve |
| Deduplicación | Dos cargas del mismo contenido reutilizan el objeto físico y crean dos metadatos; hash estable |
| Descarga | Administrador descarga cualquiera; educador descarga lo propio (R-029); estudiante descarga lo propio; ajeno → 404; cuarentenado → 404; auditoría antes de la respuesta |
| Idempotencia | Misma clave + mismo cuerpo → misma respuesta, sin duplicado; misma clave + cuerpo distinto → 409; clave ausente → 400; TTL y limpieza |
| Notificaciones | Evento → destinatario correcto; preferencia deshabilitada respeta el canal; crítica no silenciable; un usuario no ve ni marca lo ajeno; outbox reintenta y marca `fallida`; auditoría de envío/fallo |
| Exportaciones | JSON inválido → 400; plantilla inexistente → 404; PDF/XLSX/CSV abren; UTF-8; fórmula CSV/Excel neutralizada; límite de filas y tamaño; salida registrada y descargable |
| Contrato | 24 operaciones con `x-*`; 61 eventos; sin rutas públicas nuevas; matriz permitido/denegado por perfil |
| Arquitectura | Contextos `files`, `notifications` y `exports` aislados; `shared` no importa módulos; sin acceso de exportaciones a repositorios de dominio |
| Auditoría | `archivo.subido`, `archivo.descargado`, `archivo.cuarentena`, `notificacion.enviada/fallida`, `preferencia.actualizada`, `reporte.generado`; payloads sin PII ni contenido binario; fallo de auditoría → 503 y rollback |

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| MinIO no descargable o Docker inestable | Adaptador local para desarrollo/pruebas; S3 se prueba con doble y se valida en un entorno con MinIO; deuda registrada en C3 |
| Antivirus stub que da falsa seguridad | EICAR en la suite, cuarentena real en el flujo y advertencia explícita en el paquete de revisión (SUP-008) |
| Correo no verificable sin SMTP | Persistencia y plantillas verificadas; `EmailSender` stub; entrega real diferida a C5/C8 |
| Zip bomb en `docx`/`xlsx` | Límite de 10 MB, un archivo, verificación de bytes mágicos y escaneo; inspección profunda del ZIP se evalúa con el proveedor antimalware |
| Fórmulas maliciosas en CSV/Excel | Neutralizar celdas que empiezan por `=`, `+`, `-`, `@`; prueba dedicada |
| PII en notificaciones, exportaciones o auditoría | Plantillas con campos permitidos; payload saneado; auditoría sólo con metadatos; pruebas de grep |
| Crecimiento de idempotencia/outbox | TTL de 24 h, limpieza programada e índices por estado/fecha |
| Exportaciones consultando la base | Regla de arquitectura y prueba: el módulo `exports` no importa repositorios ni Kysely |
| Contratos inestables | Congelamiento al cierre de C3; cambios posteriores exigen solicitud de cambio |

## 12. Preguntas abiertas para decidir antes de ejecutar

1. **Correo:** ¿se acepta el stub de D54 para C3 o se define ya un proveedor SMTP?
2. **Antimalware:** ¿se acepta el stub con EICAR o se contrata/instala un proveedor en C3?
3. **Reporte de muestra:** ¿cuál se usa para la compuerta? Propuesta: un resumen de matrículas por programa con datos sintéticos, sin consultar la base.
4. **Retención y borrado de archivos:** PA-011 sigue abierta; sin plazo definido no se implementa borrado ni purga automática.
5. **BullMQ:** ¿outbox en proceso para C3 y BullMQ en C5, o BullMQ ya en C3?
6. **Idempotencia en curso:** si llega la misma clave mientras la primera solicitud sigue procesando, ¿409 `IDEMPOTENCY_IN_PROGRESS` o espera corta? Propuesta: 409 con código estable.
7. **Plantillas de exportación:** ¿registro en código (D56) o tabla en base?
8. **Críticas:** ¿qué eventos son no silenciables? Propuesta: `matricula.*`, `horario.modificado` y cualquier evento de seguridad.
9. **Descarga:** ¿se confirma que no habrá URLs prefirmadas ni bucket público en v1.0?

## 13. Próximos pasos sugeridos

1. Revisar y ratificar este plan, D49…D58 y las dependencias de §5.
2. Cerrar la firma de C2 o aceptarla formalmente con condiciones.
3. Resolver R-020, R-029, `reporte.generado` y las preguntas de §12.
4. Confirmar el entorno de evidencia (MinIO real o adaptador local aceptado).
5. Iniciar la Fase 1 sólo con aprobación explícita.

## 14. Fuentes

- `docs/requirements/seguridad.md` (AC-SEC-18/27/30, AC-AUD-04, §6).
- `docs/contratos/controles-seguridad-v1.md` (C-27, C-35, C-38).
- `docs/contratos/matriz-autorizacion-v1.md` (OP-29…OP-34, R-020, R-029).
- `docs/contratos/modelo-auditoria-v1.md` (`archivo.*`, `notificacion.*`, `preferencia.actualizada`).
- `docs/diccionario-datos.md` (§2.8–2.11, §4, §6).
- `docs/diseno-arquitectonico.md` (§10.2–10.5, §18.2, §19).
- `docs/tasks/rol-b/rol-b-it2-plan.md`, `docs/reviews/c2/rol-b.md`.
- `docs/open-questions.md` (PA-009, PA-011, PA-017), `docs/assumptions.md` (SUP-008).
