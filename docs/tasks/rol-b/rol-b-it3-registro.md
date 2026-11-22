# Registro de ejecución — Iteración 3 (Rol B)

- **Fecha:** 21 de noviembre de 2026 (ejecución y verificación final: 19–21 de noviembre)
- **Rol:** B — Seguridad, identidad y operación
- **Alcance:** RB1-20 a RB1-27 (fases 1 a 6 del plan de C3)
- **Plan:** `docs/tasks/rol-b/rol-b-it3-plan.md`
- **Paquete de revisión:** `docs/reviews/c3/rol-b.md`

> Este registro documenta la ejecución real, los comandos y los límites de la evidencia. Las cifras corresponden a la verificación final del 21 de noviembre de 2026.

## 1. Entorno verificado

| Herramienta | Versión | Nota |
| --- | --- | --- |
| Node.js | 22.19.0 | D39 |
| pnpm | 9.15.4 | Instalación global vía npm |
| TypeScript | 5.9.3 | `NodeNext`, ESM |
| Vitest | 5.1.0 | Unitarias, integración, contrato y arquitectura |
| NestJS | 12.5.1 | ESM (`"type": "module"`) |
| PostgreSQL | 16.15.0 (embebido) | Puerto 55432; sustituye a Compose |
| Docker Desktop | instalado | Host Windows → contenedor falla con `28P01` |
| MinIO | no descargable | `quay.io/minio/minio:latest` responde 401 |

## 2. Ejecución por tarea

### RB1-20 — Fundaciones de C3

**Hecho**

- Migraciones `0004_create_files`, `0005_create_notifications` y `0006_create_outbox_idempotency`:
  - `archivo` con `hash_sha256`, `ruta_objeto`, `estado_escaneo` e índices por hash, autor y estado.
  - `plantilla_notificacion`, `preferencia_notificacion` y `notificacion`; clave única `(codigo, canal)`, `(usuario_id, evento, canal)` y `(evento_id, usuario_id, canal)`.
  - `idempotency_key` con unicidad `(usuario_id, operacion, clave)` y `evento_outbox` con índice `(estado, disponible_en)`.
  - Seis plantillas sembradas: `notificacion.generica`, `reporte.generado` y `matricula.confirmada`, cada una en `app` y `email`.
- Puertos compartidos: `ObjectStorage`, `MalwareScanner`, `EmailSender`, `OutboxPort`, `IdempotencyStore`, `DomainEventBus`.
- Adaptadores: almacenamiento local, S3 compatible (MinIO), escáner stub, correo stub y escritor de outbox Kysely.
- Configuración validada al arranque: `OBJECT_STORAGE_*`, `MAX_FILE_BYTES`, `IDEMPOTENCY_TTL_SECONDS`, `OUTBOX_*`, `EXPORT_MAX_*`, `EMAIL_DRIVER` y `ANTIVIRUS_DRIVER`.
- `EMAIL_DRIVER` o `ANTIVIRUS_DRIVER` distintos de `stub` hacen fallar el arranque: no se simula un proveedor inexistente.

**Evidencia**

```text
PostgreSQL 16 embebido (55432):
  migrator.spec.ts   up → down → up de C3, 6 tablas, 6 plantillas y 4 índices
  identity-flow.spec.ts  idempotencia R-032 (reserva, repetición, conflicto, expiración, purga)
```

**Límite:** la evidencia de S3/MinIO no se ejecutó; el adaptador local cubre el flujo completo. La deuda queda registrada en el paquete de revisión.

### RB1-21 — Carga segura de archivos

**Hecho**

- `POST /files` multipart con `FileInterceptor`, un archivo por solicitud y límite `MAX_FILE_BYTES` (10 MB por defecto).
- Lista blanca cerrada: PDF, PNG, JPEG, DOCX y XLSX; extensión coherente con el MIME declarado y verificación por bytes mágicos (`file-type`; ZIP para DOCX/XLSX).
- Nombre saneado (NFKC, sin rutas, sin controles, máximo 200 caracteres) y clave de objeto derivada del SHA-256, nunca del nombre.
- Deduplicación física por hash: dos metadatos pueden compartir el mismo objeto; el objeto sólo se escribe si no existe.
- Escaneo antimalware antes de persistir; un archivo infectado se registra con `estado_escaneo='infectado'`, **no se conserva el contenido** y se audita `archivo.cuarentena`.
- Auditoría `archivo.subido` o `archivo.cuarentena` dentro de la misma transacción que el metadato.
- Si la transacción falla, se abandona la reserva de idempotencia y se elimina el objeto recién escrito.

**Evidencia**

```text
file-policy.spec.ts              lista blanca, extensión, saneamiento y clave
file-type-inspector.spec.ts      7/7 (vacío, MIME no permitido, extensión, MIME falsificado, ZIP)
file.service.spec.ts             carga, deduplicación, cuarentena y compensación
stub-malware-scanner.spec.ts     3/3 (EICAR, firma propia y contenido limpio)
local-object-storage.spec.ts     escritura, lectura, existencia, borrado y traversal
Integración: PDF limpio, deduplicación, MIME falsificado, 10 MB + 1 byte y EICAR
```

**Límite:** el escáner es un stub (D51/SUP-008); detecta EICAR y una firma de prueba, no malware real. La inspección profunda de ZIP queda para el proveedor de C5/C8.

### RB1-22 — Descarga autorizada

**Hecho**

- `GET /files/{id}/download` con `files:document:read` (global) o `files:document:read_own` (propio).
- Archivo ajeno, inexistente o con `estado_escaneo !== 'limpio'` responde 404, sin distinguir el motivo.
- `Content-Disposition: attachment` con `filename*` UTF-8, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` y `Content-Length`.
- Auditoría `archivo.descargado` **antes** de enviar el contenido (`AC-AUD-04`), con actor, IP, user-agent y `requestId`.
- No se emiten URLs prefirmadas ni se expone el bucket.

**Evidencia**

```text
file.service.spec.ts             permiso global, propio, ajeno y cuarentenado
Integración: descarga ajena → FILE_NOT_FOUND; descarga propia con un único archivo.descargado
```

**Límite:** no se hizo prueba HTTP extremo a extremo de las cabeceras; se verifican en el controlador y en la suite de seguridad existente.

### RB1-23 — Notificaciones

**Hecho**

- Outbox transaccional: el evento se escribe en la misma transacción que el cambio de negocio; el trabajador lo reclama con `FOR UPDATE SKIP LOCKED`.
- Estados `pendiente`, `procesando`, `procesada` y `fallida`; recuperación de eventos atascados, reintentos con backoff exponencial (máximo 5 min) y `OUTBOX_MAX_ATTEMPTS` (5 por defecto).
- Consumidor idempotente por `(evento_id, usuario_id, canal)`: un segundo ciclo no reentrega.
- Plantillas versionadas en base por `(codigo, canal)`; canales cerrados `app` y `email`.
- Preferencias por usuario, evento y canal; los eventos críticos (`matricula.*`, `seguridad.*`, `usuario.password_*`) no se pueden silenciar (422 `NOTIFICATION_CRITICAL_NOT_SILENCEABLE`).
- Endpoints: `GET /notifications`, `PATCH /notifications/{id}`, `GET /notifications/preferences` y `PUT /notifications/preferences`.
- Auditoría `notificacion.enviada`, `notificacion.fallida` y `preferencia.actualizada`; el correo se envía por un stub que no registra PII.

**Evidencia**

```text
notification-policy.spec.ts       canales, críticos y formato de evento
notifications.service.spec.ts     bandeja propia, marcado, preferencias y críticas
notification-dispatcher.spec.ts   destinatarios, preferencias, canales y fallo
Integración: outbox procesada una vez, dos canales, dos auditorías y no reentrega
Integración: fallo de procesamiento reintentado hasta agotar OUTBOX_MAX_ATTEMPTS → estado fallida, sin notificaciones por rollback
```

**Límite:** no hay SMTP real (D54); el correo sólo se verifica hasta el puerto `EmailSender`.

### RB1-24 — Exportaciones

**Hecho**

- Registro de plantillas en código con `codigo`, `version`, columnas y constructor validado; muestra `matriculas-por-programa` v1.
- Entrada JSON saneada: período obligatorio, filas no vacías, longitudes máximas y `activos <= matriculados`; sin acceso a la base ni a repositorios de dominio.
- Formatos `csv`, `xlsx` y `pdf`; CSV con BOM UTF-8 y comillas; fórmulas neutralizadas en CSV, Excel y PDF cuando la celda empieza por `=`, `+`, `-`, `@`, tabulador o retorno de carro.
- Límites `EXPORT_MAX_ROWS` (10 000) y `EXPORT_MAX_BYTES` (10 MB).
- La salida se escribe en el almacenamiento y se registra como `archivo`; se descarga por `GET /files/{id}/download`.
- Auditoría `reporte.generado` con `recurso='archivo'`, `recursoId`, plantilla, formato, filas y tamaño; evento `reporte.generado` en la outbox para notificar la disponibilidad.

**Evidencia**

```text
export-templates.spec.ts          registro, validación y límites de parámetros
default-export-renderer.spec.ts   3/3 (CSV con BOM y fórmulas, XLSX releído con ExcelJS, PDF %PDF-)
exports.service.spec.ts           idempotencia, plantilla inexistente, formato, límites y auditoría
Integración: CSV real, 2ª llamada con la misma clave, 1 archivo, 1 auditoría y 1 evento de outbox
```

**Límite:** PDF y XLSX no se abrieron manualmente en su aplicación de escritorio en esta máquina; la prueba relee el XLSX con ExcelJS y valida la firma y el tamaño del PDF. La compuerta pide abrirlos manualmente antes de la firma.

### RB1-25 — Idempotencia

**Hecho**

- `Idempotency-Key` obligatoria en `POST /files` y `POST /exports`; ausente → 400 `IDEMPOTENCY_KEY_REQUIRED`.
- Clave por usuario + operación + hash canónico del cuerpo; la unicidad la resuelve PostgreSQL, no una comprobación previa.
- Misma clave y mismo cuerpo → respuesta original almacenada; mismo cuerpo distinto → 409 `IDEMPOTENCY_KEY_REUSED`; solicitud en curso → 409 `IDEMPOTENCY_IN_PROGRESS`.
- TTL configurable (24 h por defecto), expiración comprobada al reservar y `purgeExpired` para limpieza.
- Un fallo de negocio abandona la reserva, de modo que la clave no queda envenenada.

**Evidencia**

```text
canonical-hash.spec.ts            JSON canónico y SHA-256 estable
Integración R-032: reserva, en proceso, completa, repetición, conflicto, expiración y purga
Integración RB1-21/24: repetición exacta sin duplicar metadatos ni archivos
```

**Límite:** no hay tarea programada de purga en C3; el método existe y está probado, pero el disparador periódico se decide en C5.

### RB1-26 — Contrato, permisos y matriz

**Hecho**

- Siete operaciones nuevas con `x-access`, `x-permission`, `x-scope`, `x-audit-event` y `x-error-codes`.
- Permisos nuevos R-020 (`notifications:notification:update_own`, `notifications:preference:read_own`) y R-029 (`files:document:read_own` para educador) aplicados en semillas.
- Evento `reporte.generado` en el catálogo de auditoría y en `events.json`.
- Matriz de autorización ampliada a 24 operaciones y tres perfiles; una operación nueva sin casos permitido/denegado hace fallar la prueba.
- Contrato regenerado y validado: **24 operaciones, 4 rutas públicas y 61 eventos**.

**Evidencia**

```text
pnpm contracts:generate          openapi.json y events.json
pnpm contracts:validate          Contrato válido: 24 operaciones, 4 públicas, 61 eventos
pnpm test:contracts              11/11
authorization-matrix.spec.ts     24 operaciones × 3 perfiles
```

**Límite:** R-020, R-029, `reporte.generado` y el contrato quedan pendientes de ratificación formal antes del congelamiento.

### RB1-27 — Pruebas de compuerta, CI y runbooks

**Hecho**

- Suite de abuso de archivos, cuarentena EICAR, MIME falsificado, tamaño, deduplicación, descarga ajena e idempotencia.
- Suite de notificaciones: destinatario, preferencias, críticas, entrega única, fallo y auditoría.
- Suite de exportaciones: formatos, UTF-8, fórmulas neutralizadas, límites, registro como archivo y auditoría.
- Runbooks nuevos: `docs/runbook/archivos.md`, `notificaciones.md` y `exportaciones.md`.
- Paquete de revisión `docs/reviews/c3/rol-b.md` con evidencia enlazada y límites.

**Evidencia**

```text
pnpm test                       29 archivos / 245 pruebas
pnpm test:integration           3 archivos / 31 pruebas (6 flujos C3)
pnpm test:architecture          3/3
pnpm arch:check                 sin violaciones (207 módulos, 659 dependencias)
```

**Límite:** el pipeline de GitHub Actions no se ejecutó; el workflow existe y la validación local está verde.

## 3. Archivos principales añadidos

| Área | Archivos |
| --- | --- |
| Base de datos | `migrations/public/0004_create_files`, `0005_create_notifications`, `0006_create_outbox_idempotency`, `schema.ts` |
| Archivos | `files.module`, `files.controller`, DTO, `file-policy`, `file.service`, `file-type-inspector`, repositorios y unidad de trabajo |
| Notificaciones | `notifications.module`, `notifications.controller`, DTO, `notification-policy`, `notifications.service`, `notification-dispatcher`, `outbox-worker`, repositorio |
| Exportaciones | `exports.module`, `exports.controller`, DTO, `export-templates`, `exports.service`, `default-export-renderer`, repositorio |
| Compartido | `storage/*` (local, S3, módulo), `malware/*`, `email/*`, `events/outbox.port`, `idempotency/*`, `canonical-hash` |
| Contrato | `openapi.json`, `events.json` y matriz de autorización |
| Pruebas | Unitarias de los tres módulos y de los adaptadores; integración C3 en `identity-flow.spec.ts`; `migrator.spec.ts` |

## 4. Verificación final ejecutada

| Comando | Resultado |
| --- | --- |
| `pnpm format:check` | Todos los archivos aplicables cumplen Prettier |
| `pnpm typecheck` | API y web sin errores |
| `pnpm lint` | Sin errores ni advertencias |
| `pnpm test` | API: **29 archivos / 245 pruebas** |
| `pnpm --filter @ccltpg/api build` | `nest build` correcto |
| `pnpm arch:check` | Sin violaciones (207 módulos, 659 dependencias) |
| `pnpm test:architecture` | **3 pruebas** verdes |
| `pnpm test:integration` + PostgreSQL 16 real | **3 archivos / 31 pruebas** verdes |
| `pnpm contracts:validate` | 24 operaciones, 4 públicas, 61 eventos |
| `pnpm test:contracts` | **11 pruebas** verdes |
| `pnpm security:secrets` | Sin hallazgos |
| `pnpm test:security` | **6 pruebas** verdes |
| Validación YAML del pipeline | Workflow válido; **no ejecutado en GitHub** |

## 5. Correcciones aplicadas durante la ejecución

1. **`file-type@22`:** no exporta `isZip`; DOCX/XLSX se reconocen con la firma local `PK\x03\x04`, y el detector PNG exige `IHDR` en el offset 12.
2. **Multer y tamaño:** `LIMIT_FILE_SIZE` se traduce a 413 mediante `@nestjs/platform-express`; el servicio vuelve a comprobar `MAX_FILE_BYTES` antes de tocar el almacenamiento.
3. **Idempotencia en carrera:** se apoya en la restricción única de PostgreSQL; dos solicitudes concurrentes no ejecutan el efecto dos veces.
4. **Outbox determinista en pruebas:** el trabajador no arranca con `NODE_ENV=test`; la integración llama a `tick()` para no depender del reloj.
5. **Lint de pruebas:** los dobles usan `Promise.resolve` en lugar de `async` sin `await`; los espías se exponen en el arnés para evitar `unbound-method`.
6. **Decoradores con `tsx`:** controladores y módulos usan `@Inject(Token)` explícito porque `tsx` no emite `emitDecoratorMetadata`.
7. **Formato:** Prettier se aplicó a 29 archivos de C3 antes de la verificación final; `format:check` quedó verde.
8. **Auditoría de descarga:** se escribe antes de `response.end`, no después; una caída del flujo no deja una descarga sin rastro.

## 6. Decisiones pendientes y desviaciones

| Decisión | Estado | Qué falta |
| --- | --- | --- |
| D49…D58 | Aplicadas | Ratificación formal del equipo |
| `@aws-sdk/client-s3@3.1173.0`, `file-type@22.3.0`, `pdfkit@0.20.2`, `exceljs@4.4.0`, `multer@2.5.0`, `@types/multer@2.3.0`, `@types/pdfkit@0.17.7` | Fijadas | Ratificación de dependencias |
| R-032 / migración `0006` | Aplicada como propuesta | Ratificación de Rol A |
| R-033 / outbox | Aplicada como propuesta | Ratificación de Rol A |
| R-009 (estados de notificación) | Aplicada | Ratificación de Rol A |
| R-020 y R-029 | Aplicadas en semillas | Ratificación de permisos |
| `reporte.generado` en el catálogo | Aplicado | Ratificación del evento |
| Stub de antimalware (SUP-008) | Aplicado y probado con EICAR | Aceptación formal o proveedor real |
| Stub de correo (D54) | Aplicado | Aceptación formal o SMTP real |
| Adaptador local en lugar de MinIO | Aplicado | Aceptación de la evidencia o entorno con MinIO |
| Purga programada de idempotencia/outbox | No implementada | Decidir disparador en C5 |
| Borrado y retención de archivos (PA-011) | No implementado | Política de retención |
| Docker / MinIO / CI en GitHub / acta C0/C1 | Bloqueados | Acciones externas al código |

## 7. Deuda y siguiente paso

- Abrir los PDF y XLSX de muestra en sus aplicaciones reales y adjuntar la captura a la compuerta 3.
- Ejecutar el flujo contra MinIO real cuando el registro sea accesible; mientras tanto, el adaptador S3 sólo está probado por contrato.
- Publicar la rama y ejecutar el pipeline en GitHub Actions.
- Ratificar D49…D58, las dependencias, R-009/R-020/R-029/R-032/R-033, `reporte.generado` y los stubs de correo y antimalware.
- Definir el disparador de purga de idempotencia y outbox antes de C5.
- Resolver PA-011 (retención y borrado) antes de implementar purga de archivos.
