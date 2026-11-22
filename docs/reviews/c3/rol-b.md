# Paquete de revisión — Compuerta 3 (Rol B)

- **Rol:** B — Seguridad, identidad y operación
- **Compuerta:** C3 — Archivos, notificaciones y exportaciones
- **Estado:** **Ejecutada con límites de evidencia.** RB1-20…RB1-27 están implementados y verificados localmente; quedan bloqueos externos (MinIO, CI en GitHub, acta C0/C1) y ratificaciones formales pendientes.
- **Plan asociado:** `docs/tasks/rol-b/rol-b-it3-plan.md`
- **Registro de ejecución:** `docs/tasks/rol-b/rol-b-it3-registro.md`
- **Regla:** no se marca ningún criterio como cumplido sin evidencia enlazada.

## 1. Alcance entregado frente al planificado

| Tarea | Entregable | Estado | Evidencia |
| --- | --- | --- | --- |
| RB1-20 | Migraciones `0004`–`0006`, puertos y configuración | **Cumplido con límites** | `up/down/up` contra PostgreSQL 16 real; 6 tablas, 6 plantillas y 4 índices; puertos `ObjectStorage`, `MalwareScanner`, `EmailSender`, `OutboxPort` e `IdempotencyStore` |
| RB1-21 | Carga segura de archivos | **Cumplido con límites** | 7 pruebas de inspector MIME; política, servicio y EICAR; integración de PDF, MIME falsificado, tamaño y cuarentena |
| RB1-22 | Descarga autorizada | **Cumplido** | Permiso global/propio, 404 para ajeno y cuarentenado, cabeceras seguras, auditoría antes de responder |
| RB1-23 | Notificaciones | **Cumplido con límites** | Outbox transaccional, plantillas, preferencias, críticas no silenciables, canales `app`/`email` y entrega única |
| RB1-24 | Exportaciones | **Cumplido con límites** | Plantilla `matriculas-por-programa` v1, PDF/XLSX/CSV, límites, registro como archivo y auditoría |
| RB1-25 | Idempotencia | **Cumplido** | Repetición, conflicto, en curso, expiración y purga; integración R-032 |
| RB1-26 | Contrato, permisos y matriz | **Cumplido con ratificación pendiente** | 24 operaciones, 4 públicas, 61 eventos, 37 permisos; matriz de 24 × 3 perfiles |
| RB1-27 | Pruebas de compuerta, CI y runbooks | **Cumplido con límites** | 245 unitarias, 31 de integración, 3 de arquitectura, 11 de contrato y 6 de seguridad; runbooks de archivos, notificaciones y exportaciones |

**No se modificó** `docs/diseno-arquitectonico.md` ni `docs/vision-alcance.md`. Tampoco se editó el diccionario de Rol A: los cambios de modelo se registran como propuestas R-032/R-033 en §2.4.

## 2. Decisiones y supuestos con reversibilidad

### 2.1 Decisiones D49…D58 aplicadas

El usuario aprobó el contenido del bloque D49…D58; la firma formal del equipo queda pendiente (ver §9).

| Decisión | Elección aplicada | Reversibilidad | Consecuencia |
| --- | --- | --- | --- |
| D49 — Almacenamiento | Puerto `ObjectStorage` con adaptador local y adaptador S3/MinIO; sin URLs prefirmadas ni bucket público | Media | La API es la única puerta de descarga; migrar a S3 no cambia el contrato |
| D50 — Endurecimiento | 10 MB, un archivo, lista blanca PDF/PNG/JPEG/DOCX/XLSX, bytes mágicos, nombre saneado y clave por hash | Barata | AC-SEC-27 cubierto en el flujo |
| D51 — Antimalware | Stub que detecta EICAR y una firma propia; infectado → cuarentena y descarga 404 | Barata | Cuarentena real probada; proveedor real en C5/C8 (SUP-008) |
| D52 — Descarga | `files:document:read` o `files:document:read_own`; ajeno → 404; auditoría antes de responder | Costosa si cambia el contrato | Contrato congelable; cabeceras `attachment`, `nosniff` y `no-store` |
| D53 — Bus de eventos | Outbox transaccional en PostgreSQL con `FOR UPDATE SKIP LOCKED`, reintentos y estado `fallida` | Media | Sin dependencia nueva; BullMQ se evalúa en C5 |
| D54 — Correo | Puerto `EmailSender` con adaptador stub; el arranque falla si `EMAIL_DRIVER` no es `stub` | Barata | No se simula un proveedor inexistente; SMTP real en C5/C8 |
| D55 — Plantillas | Plantillas versionadas en `plantilla_notificacion`, únicas por `(codigo, canal)`; críticas en código | Media | Seis plantillas sembradas; críticas no silenciables |
| D56 — Exportaciones | Registro en código con versión y validación; sin acceso a base; 10 000 filas y 10 MB | Media | Aislamiento de arquitectura probado |
| D57 — Idempotencia | Clave obligatoria por usuario + operación + hash canónico; TTL 24 h; conflicto 409 | Media | AC-SEC-30 cubierto para archivos y exportaciones |
| D58 — Contrato | `reporte.generado`; R-020 y R-029; sin rutas públicas nuevas | Costosa tras el congelamiento | Pendiente de ratificación formal |

### 2.2 Dependencias nuevas

| Dependencia | Versión exacta | Uso | Estado |
| --- | --- | --- | --- |
| `@aws-sdk/client-s3` | `3.1173.0` | Adaptador S3 compatible con MinIO | Instalada y fijada; ratificación pendiente |
| `file-type` | `22.3.0` | Verificación de MIME por bytes mágicos | Instalada y fijada; ratificación pendiente |
| `pdfkit` + `@types/pdfkit` | `0.20.2` / `0.17.7` | Generación de PDF | Instaladas y fijadas; ratificación pendiente |
| `exceljs` | `4.4.0` | Generación de XLSX | Instalada y fijada; ratificación pendiente |
| `multer` + `@types/multer` | `2.5.0` / `2.3.0` | Carga multipart explícita | Instaladas y fijadas; ratificación pendiente |

No se añadió `nodemailer` ni `bullmq`: el correo y la cola siguen detrás de puertos/stubs hasta C5/C8.

### 2.3 Cambios de contrato y de catálogo

1. **Siete operaciones nuevas:** `POST /files`, `GET /files/{id}/download`, `GET /notifications`, `PATCH /notifications/{id}`, `GET|PUT /notifications/preferences` y `POST /exports`.
2. **Permisos:** catálogo de 37; R-020 añade `notifications:notification:update_own` y `notifications:preference:read_own`; R-029 asigna `files:document:read_own` al educador.
3. **Evento:** `reporte.generado` en el catálogo y en `events.json`; total 61 eventos.
4. **Rutas públicas:** se mantienen 4; no hay rutas anónimas nuevas.
5. **Descarga de exportaciones:** reutiliza `GET /files/{id}/download`; no se crea una segunda ruta.

### 2.4 Propuestas de cambio para Rol A

1. **R-032 — Idempotencia:** tabla `idempotency_key` con unicidad `(usuario_id, operacion, clave)`, hash canónico, respuesta almacenada y expiración.
2. **R-033 — Outbox:** tabla `evento_outbox` con estados `pendiente`, `procesando`, `procesada` y `fallida`, intentos, disponibilidad y último error.
3. **R-009:** semántica de `notificacion.estado` (`pendiente`, `enviada`, `leida`, `fallida`) y unicidad de plantillas y preferencias.
4. **`reporte.generado`:** evento con `recurso='archivo'` y `recurso_id=archivo.id`.

**No se editó el diccionario**; los cambios quedan registrados aquí para ratificación.

### 2.5 Desviaciones que requieren decisión del equipo

1. **Adaptador local como evidencia:** MinIO no es descargable en esta máquina; el adaptador S3 existe y compila, pero no se ejecutó contra un servidor real.
2. **Escáner stub:** detecta EICAR y `CCLTPG-TEST-MALWARE`; no inspecciona ZIP ni malware real. Se declara explícitamente para no dar falsa seguridad.
3. **Correo stub:** la entrega se verifica hasta el puerto; no hay SMTP real.
4. **Purga programada:** `purgeExpired` existe y está probado, pero C3 no incluye el disparador periódico.
5. **Nombre malicioso:** el nombre se sanea (rutas, controles y puntos iniciales) y se prueba a nivel unitario; no hay caso HTTP con nombre `../` de extremo a extremo.

## 3. Preguntas abiertas

- **Acta de C0/C1:** sigue sin existir; sin acta no se puede declarar C3 cerrada formalmente.
- **MinIO:** `quay.io/minio/minio:latest` devuelve 401 y Compose no arranca; la evidencia usa el adaptador local.
- **CI en GitHub:** el workflow existe y valida localmente, pero no se ha ejecutado en GitHub.
- **Ratificación de D49…D58 y de las dependencias de §2.2.**
- **Ratificación de R-009, R-020, R-029, R-032, R-033 y `reporte.generado`.**
- **Ratificación de SUP-008 (antimalware stub) y del stub de correo.**
- **PA-011:** sin política de retención no se implementa borrado ni purga de archivos.
- **Apertura manual de PDF/XLSX:** pendiente para cerrar la compuerta de documentos.

## 4. Informe de pruebas y matriz

### 4.1 Comandos ejecutados (21 de noviembre de 2026)

| Prueba | Comando | Resultado |
| --- | --- | --- |
| Formato | `pnpm format:check` | Todos los archivos aplicables cumplen Prettier |
| Tipos | `pnpm typecheck` | `@ccltpg/api` y `@ccltpg/web` sin errores |
| Lint | `pnpm lint` | Ambos paquetes sin errores ni advertencias |
| Unitarias API | `pnpm --filter @ccltpg/api test` | **29 archivos / 245 pruebas** verdes |
| Build API | `pnpm --filter @ccltpg/api build` | `nest build` correcto |
| Arquitectura | `pnpm arch:check` | Sin violaciones (207 módulos, 659 dependencias) |
| Arquitectura (prueba) | `pnpm test:architecture` | **3 pruebas** verdes |
| Integración | `pnpm test:integration` + PostgreSQL 16 real | **3 archivos / 31 pruebas** verdes |
| Contrato | `pnpm contracts:validate` | 24 operaciones, 4 públicas, 61 eventos |
| Validador | `pnpm test:contracts` | **11 pruebas** verdes |
| Secretos | `pnpm security:secrets` | Sin hallazgos |
| Escáner (pruebas) | `pnpm test:security` | **6 pruebas** verdes |
| CI | validación YAML | Workflow válido; **no ejecutado en GitHub** |
| Compose | `docker compose ps` | **No ejecutado**: Docker/MinIO con bloqueos de entorno |

### 4.2 Matriz de autorización

`apps/api/test/api/authorization-matrix.spec.ts` lee el OpenAPI generado y somete cada operación al guard real con los tres perfiles de la semilla:

- **24 operaciones** cubiertas exactamente; una operación nueva sin caso permitido/denegado hace fallar la prueba.
- Las 7 operaciones de C3 tienen al menos un caso permitido y uno denegado.
- **37 permisos** en el catálogo; la expansión de `manage` y `*` se valida antes de guardar y de devolver en `/me`.
- Denegación por defecto: una ruta sin metadatos falla en la prueba del guard.
- Rutas públicas: acceso sin credenciales permitido; no hay rutas anónimas nuevas.

### 4.3 Criterios AC-SEC

| Criterio | Estado | Evidencia / límite |
| --- | --- | --- |
| AC-SEC-18 (archivos propios) | **Cumple con límite** | Descarga ajena → 404 y descarga propia auditada; la prueba es de servicio, no HTTP extremo a extremo |
| AC-SEC-27 | **Cumple** | Lista blanca, 10 MB, bytes mágicos, nombre saneado, EICAR → cuarentena y descarga 404; el contenido infectado no se conserva |
| AC-SEC-30 | **Cumple** | `Idempotency-Key` obligatoria en `POST /files` y `POST /exports`; repetición exacta, conflicto 409 y en curso 409; integración R-032 |
| AC-SEC-31 | **Cumplido en C1/C2** | Migraciones con rol de migración y `up/down/up` de C3 contra PostgreSQL real |
| AC-SEC-14/19/21 | **Sin cambios en C3** | Siguen como en C2; los límites de throttling y el frontend no se reabren aquí |

### 4.4 Criterios AC-AUD

| Criterio | Estado | Evidencia / límite |
| --- | --- | --- |
| AC-AUD-03 (archivos/notificaciones) | **Cumple** | `archivo.subido`, `archivo.cuarentena`, `notificacion.enviada`, `notificacion.fallida` y `preferencia.actualizada` con `recurso_id` |
| AC-AUD-04 (descargas) | **Cumple** | `archivo.descargado` se escribe antes de `response.end`; integración con conteo exacto |
| AC-AUD-04 (PII académica) | **No aplica en C3** | Los listados de estudiantes son C4 |
| AC-AUD-05/06/10/13 | **Sin regresión** | Las pruebas de C2 siguen verdes; el contrato exige `x-audit-event` y el validador lo comprueba |
| AC-AUD-08/09 | **Cumple con límite** | Los payloads de C3 no incluyen contenido binario; la exportación audita sólo metadatos (plantilla, formato, filas y tamaño) |

### 4.5 Compuerta 3 (diseño §18.2)

| Condición | Resultado |
| --- | --- |
| Rechazo por tamaño, MIME no permitido, MIME falsificado y archivo vacío | **Cumple** en unitarias e integración; el nombre malicioso se sanea y se prueba a nivel unitario |
| Archivo infectado (EICAR) → cuarentena → descarga 404 | **Cumple** en integración, con auditoría `archivo.cuarentena` |
| Descarga ajena → 404 y descarga propia autorizada | **Cumple** a nivel de servicio; falta prueba HTTP de cabeceras |
| Repetición con la misma `Idempotency-Key` | **Cumple** en archivos y exportaciones; conflicto y en curso probados |
| Destinatario correcto y entrega única por evento/canal | **Cumple** en integración; un usuario no ve ni marca lo ajeno (servicio) |
| Reintento de la outbox ante fallo de procesamiento | **Cumple**: la integración fuerza el fallo y verifica backoff, agotamiento y estado `fallida` |
| Notificaciones críticas no silenciables | **Cumple** en política y servicio (422) |
| PDF, XLSX y CSV abren en sus aplicaciones reales | **Parcial**: CSV verificado en integración; XLSX releído con ExcelJS; PDF válido por firma y tamaño; **falta apertura manual** |
| UTF-8 y fórmulas neutralizadas | **Cumple** en unitarias (BOM, comillas y prefijos `=`, `+`, `-`, `@`) |
| Contrato congelado | **Pendiente de ratificación formal**; el contrato está generado y validado |

## 5. Guion de demostración reproducible

1. `pnpm install --frozen-lockfile` con Node 22.19+ y pnpm 9.15.4.
2. Copiar `.env.example` a `.env` y definir `DATABASE_URL`, `DATABASE_MIGRATOR_URL`, `JWT_SECRET_CURRENT`, `MFA_ENCRYPTION_KEY` y `EMAIL_HMAC_KEY`.
3. Mantener `OBJECT_STORAGE_DRIVER=local`, `EMAIL_DRIVER=stub` y `ANTIVIRUS_DRIVER=stub` para la demo sin infraestructura externa.
4. `pnpm migrate:status` y `pnpm migrate:up`.
5. `SEED_PASSWORD='<clave fuerte>' pnpm --filter @ccltpg/api db:seed`.
6. `pnpm dev` y completar login, cambio de contraseña, MFA y sesión completa.
7. Cargar un PDF con `POST /api/v1/files` (multipart, campo `file`, cabecera `Idempotency-Key`); repetir con la misma clave y comprobar que devuelve el mismo `id`.
8. Descargar con `GET /api/v1/files/{id}/download`; repetir con otro usuario sin permiso global y comprobar 404.
9. Enviar un PDF con EICAR; comprobar `estadoEscaneo='infectado'`, la descarga 404 y `archivo.cuarentena` en auditoría.
10. `GET /api/v1/notifications` y `PUT /api/v1/notifications/preferences`; intentar silenciar `matricula.confirmada` y comprobar 422.
11. `POST /api/v1/exports` con `plantilla='matriculas-por-programa'`, `formato='csv'` y filas sintéticas; descargar la salida y comprobar BOM UTF-8 y `reporte.generado`.
12. Ejecutar `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
13. Ejecutar `pnpm arch:check`, `pnpm test:architecture`, `pnpm contracts:validate`, `pnpm test:contracts`, `pnpm test:security` y `pnpm security:secrets`.
14. Con PostgreSQL real: `pnpm test:integration` (31 pruebas).
15. Abrir manualmente el PDF y el XLSX de muestra y adjuntar la captura a esta compuerta.

## 6. Diferencias (tablas, rutas, permisos, migraciones, dependencias)

- **Tablas nuevas:** `archivo`, `plantilla_notificacion`, `preferencia_notificacion`, `notificacion`, `idempotency_key` y `evento_outbox`.
- **Rutas (7 operaciones nuevas):** `POST /files`; `GET /files/{id}/download`; `GET /notifications`; `PATCH /notifications/{id}`; `GET|PUT /notifications/preferences`; `POST /exports`.
- **Permisos:** catálogo de 37; R-020 y R-029 aplicados; no se crean permisos nuevos para exportaciones (`exports:report:export` ya existía en el catálogo).
- **Migraciones:** `0004_create_files`, `0005_create_notifications` y `0006_create_outbox_idempotency`; todas con `down` probado en `up/down/up`.
- **Contrato:** `openapi.json` con 24 operaciones y 4 rutas públicas; `events.json` con 61 eventos.
- **Dependencias añadidas:** `@aws-sdk/client-s3@3.1173.0`, `file-type@22.3.0`, `pdfkit@0.20.2`, `exceljs@4.4.0`, `multer@2.5.0`, `@types/multer@2.3.0` y `@types/pdfkit@0.17.7` (exactas).
- **Frontend:** sin cambios funcionales de C3; las pantallas de carga, bandeja, preferencias y descarga de exportaciones quedan para Rol C.

## 7. Defectos y deuda técnica

| Deuda | Impacto | Destino |
| --- | --- | --- |
| MinIO no ejecutable; S3 sólo probado por contrato | Alto para la evidencia de almacenamiento real | Resolver registro/red o aceptar el adaptador local |
| Antimalware stub (SUP-008) | Alto si se interpreta como antivirus real | Proveedor real en C5/C8 |
| Correo stub | Medio: no hay entrega real | SMTP en C5/C8 |
| PDF/XLSX sin apertura manual | Medio: la compuerta pide abrirlos | Cierre de C3 |
| Purga programada de idempotencia/outbox ausente | Medio: crecimiento de tablas | C5 |
| Sin prueba HTTP de cabeceras de descarga | Bajo: el controlador las fija y hay suite de seguridad | C4/e2e |
| Fallo de entrega por canal no reabre el evento de outbox | Medio: la notificación queda `fallida` y auditada, pero el reintento automático no la vuelve a enviar | C5, al definir la política de reintento de entrega |
| Nombre malicioso sólo probado a nivel unitario | Bajo: el saneamiento es determinista | C4/e2e |
| Retención y borrado de archivos (PA-011) no implementados | Medio: sin política ejecutable | C5/C8 |
| CI no ejecutado en GitHub | Medio: valida configuración, no plataforma | Publicar rama y ejecutar |
| Sin tarea de limpieza de objetos huérfanos | Bajo: la compensación borra el objeto si falla la transacción | C5 |

## 8. Autoevaluación anti-deriva (diseño §19.2)

1. **¿Código accedió a partes internas o esquemas de otro contexto?** No. `files`, `notifications` y `exports` dependen de puertos; `exports` no importa repositorios de dominio ni Kysely; `shared` no importa módulos.
2. **¿Toda ruta nueva está protegida por permiso y probada permitida/denegada?** Sí. La matriz cubre las 24 operaciones y la denegación es por defecto.
3. **¿Toda operación que cambia estado emite auditoría?** Sí: carga, cuarentena, descarga, entrega/fallo de notificación, preferencias y generación de reporte. Las lecturas propias y el marcado de lectura están exentos con justificación en el contrato.
4. **¿Todo campo de estado nuevo tiene máquina de estados y transiciones probadas?** `archivo.estado_escaneo` (`limpio`/`infectado`) y `notificacion.estado` (`pendiente`/`enviada`/`leida`/`fallida`) se prueban en unitarias e integración.
5. **¿Las migraciones se mantienen en un solo esquema y pasan `up/down/up`?** Sí, contra PostgreSQL 16 real.
6. **¿Se modificó algún artefacto congelado?** No se editó el diseño ni la visión. Se añadió `reporte.generado` al catálogo de auditoría, registrado para ratificación.
7. **¿Se agregó alguna dependencia fuera de las decisiones registradas?** Las cinco familias de §2.2 están fijadas y registradas.
8. **¿Existe lógica de pagos o contabilidad?** No.
9. **¿Hay reglas sin trazabilidad a requisito o supuesto?** Cada criterio se enlaza a AC-SEC/AC-AUD, C-35/C-38 o a una decisión D49…D58.
10. **¿Las garantías de seguridad están en la base y no sólo en el código?** La unicidad de idempotencia, la unicidad de plantillas/preferencias y los estados se apoyan en restricciones de PostgreSQL; la auditoría sigue siendo de solo inserción.
11. **¿Alguna prueba se omitió o simuló ocultando comportamiento real?** Las de integración se omiten sin variables, pero se ejecutaron 30 contra PostgreSQL 16 real. Los stubs de correo y antimalware están declarados y probados como stubs, no como proveedores reales.
12. **¿Documentación, OpenAPI y diccionario coinciden con el código?** OpenAPI y eventos se generan desde el código y se validan. El diccionario aún no recoge R-032/R-033/R-009: está registrado como propuesta para Rol A.

## 9. Solicitud de firma

| Firmante | Qué aprueba | Estado |
| --- | --- | --- |
| Rol B | Archivos, notificaciones, exportaciones, idempotencia, outbox y runbooks de C3 | Pendiente |
| Equipo | D49…D58 (aprobadas por el usuario) y las dependencias de §2.2 | Aprobadas; firma formal pendiente |
| Rol A | R-009, R-032, R-033 y `reporte.generado` | Pendiente |
| Equipo | R-020, R-029 y el contrato con 24 operaciones | Pendiente |
| Equipo | SUP-008 (antimalware stub) y stub de correo | Pendiente |
| Equipo | Compuerta 3, con MinIO, CI en GitHub, apertura manual de PDF/XLSX y acta C0/C1 pendientes | Pendiente |
