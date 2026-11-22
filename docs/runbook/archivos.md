# Runbook — archivos y almacenamiento de objetos

- **Objetivo:** operar la carga y descarga de archivos de C3 sin exponer el almacenamiento, sin servir malware y sin perder trazabilidad.
- **Alcance:** `POST /api/v1/files` y `GET /api/v1/files/{id}/download`; adaptador local y adaptador S3/MinIO.
- **Decisiones:** D49 (API como única puerta), D50 (endurecimiento de carga), D51 (antimalware stub), D52 (descarga autorizada).
- **Paquete de revisión:** `docs/reviews/c3/rol-b.md`.

## 1. Reglas que no se negocian

1. La descarga pasa **siempre** por la API: no hay URLs prefirmadas, bucket público ni acceso directo al sistema de archivos.
2. La clave del objeto se deriva del SHA-256, nunca del nombre original.
3. Un archivo con `estado_escaneo='infectado'` no se sirve: su descarga responde 404 y su contenido no se conserva.
4. La auditoría `archivo.descargado` se escribe **antes** de enviar el contenido.
5. `Idempotency-Key` es obligatoria en la carga. Sin ella, la API responde 400.
6. El límite por defecto es 10 MB y un archivo por solicitud.

## 2. Configuración

```dotenv
OBJECT_STORAGE_DRIVER=local          # local | s3
OBJECT_STORAGE_LOCAL_ROOT=.data/objects
OBJECT_STORAGE_BUCKET=ccltpg
OBJECT_STORAGE_REGION=us-east-1
OBJECT_STORAGE_FORCE_PATH_STYLE=true
MAX_FILE_BYTES=10485760              # 10 MB
ANTIVIRUS_DRIVER=stub                # sólo "stub" en C3

# Sólo con OBJECT_STORAGE_DRIVER=s3
OBJECT_STORAGE_ENDPOINT=http://localhost:9000
OBJECT_STORAGE_ACCESS_KEY=<clave>
OBJECT_STORAGE_SECRET_KEY=<secreto>
```

El arranque falla si `OBJECT_STORAGE_DRIVER=s3` y falta endpoint, clave de acceso o secreto. También falla si `ANTIVIRUS_DRIVER` no es `stub`: C3 no debe aparentar un antivirus que no existe.

## 3. Disposición en el almacenamiento

| Estado | Ruta | Contenido |
| --- | --- | --- |
| Limpio | `objects/sha256/<hash>` | Se conserva y se sirve por la API |
| Infectado | `quarantine/sha256/<hash>` | Se registra el metadato y **se borra el contenido** |

La deduplicación es física: dos cargas con el mismo contenido comparten un objeto, pero cada una tiene su propio metadato. El objeto sólo se escribe si no existe.

## 4. Operación normal

### 4.1 Carga

```bash
curl -X POST "http://localhost:3000/api/v1/files" \
  -H "Authorization: Bearer <access-token>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F "file=@documento.pdf;type=application/pdf"
```

Respuesta `201` con `id`, `nombreOriginal`, `mime`, `tamano`, `hashSha256`, `estadoEscaneo` y `creadoEn`.

Repetir con la **misma** clave y el **mismo** archivo devuelve el mismo resultado sin crear otro metadato. Cambiar el contenido con la misma clave devuelve 409 `IDEMPOTENCY_KEY_REUSED`.

### 4.2 Descarga

```bash
curl -OJ "http://localhost:3000/api/v1/files/<id>/download" \
  -H "Authorization: Bearer <access-token>"
```

La respuesta incluye `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` y `Cache-Control: no-store`.

Permisos:

- `files:document:read` descarga cualquier archivo (administrador).
- `files:document:read_own` descarga sólo los propios (educador y estudiante).
- Un archivo ajeno, inexistente o en cuarentena responde **404**, sin distinguir el motivo.

## 5. Diagnóstico

| Síntoma / código | Causa probable | Acción |
| --- | --- | --- |
| `400 FILE_EMPTY` | Cuerpo vacío o campo `file` ausente | Enviar un archivo no vacío en el campo `file` |
| `413 FILE_TOO_LARGE` | Supera `MAX_FILE_BYTES` | Reducir el archivo o revisar el límite aprobado |
| `415 FILE_MIME_NOT_ALLOWED` | MIME fuera de la lista blanca | Convertir a PDF, PNG, JPEG, DOCX o XLSX |
| `422 FILE_MIME_MISMATCH` | Extensión o bytes mágicos no coinciden con el MIME declarado | Verificar el archivo real; no confiar en la extensión |
| Nombre con rutas o controles | El nombre se sanea, no se rechaza | El archivo se guarda con el nombre saneado; no hay error por este motivo en C3 |
| `400 IDEMPOTENCY_KEY_REQUIRED` | Falta la cabecera | Añadir `Idempotency-Key` |
| `409 IDEMPOTENCY_KEY_REUSED` | Misma clave con cuerpo distinto | Usar una clave nueva para el nuevo contenido |
| `409 IDEMPOTENCY_IN_PROGRESS` | La primera solicitud sigue en curso | Esperar y reintentar con la misma clave |
| `503 FILE_STORAGE_UNAVAILABLE` | Almacenamiento caído o inaccesible | Revisar el adaptador y su configuración |
| Descarga 404 de un archivo propio | Cuarentenado, borrado o `id` incorrecto | Consultar `archivo.estado_escaneo` |

## 6. Cuarentena y respuesta a incidentes

1. Confirmar el estado del archivo:

   ```sql
   -- Ejecutar como ccltpg_readonly o ccltpg_migrator.
   select id, nombre_original, mime, tamano, hash_sha256, estado_escaneo, creado_en
   from public.archivo
   where id = '<archivo-id>';
   ```

2. Confirmar la auditoría:

   ```sql
   select accion, actor_id, recurso_id, ocurrido_en, request_id, datos_despues
   from public.evento_auditoria
   where recurso_id = '<archivo-id>'
   order by ocurrido_en;
   ```

3. Si `estado_escaneo='infectado'`, **no** restaurar el contenido. El objeto se elimina al detectar la firma; la descarga ya responde 404.
4. Identificar al autor (`subido_por`) y el `request_id`; abrir el procedimiento de `docs/runbook/incidente-seguridad.md` si hubo exposición.
5. Si el archivo limpio quedó sin objeto físico, la API responde 404. Registrar el incidente y pedir una nueva carga con una clave de idempotencia nueva.

## 7. Mantenimiento

- **Objetos huérfanos:** si una transacción falla después de escribir el objeto, el servicio intenta borrarlo. No hay tarea de barrido en C3; se revisa manualmente antes de C5.
- **Borrado y retención:** no implementados. PA-011 sigue abierta; no se purgan archivos sin política aprobada.
- **Migración local → S3:** cambiar `OBJECT_STORAGE_DRIVER` y las credenciales, copiar los objetos existentes conservando la clave `objects/sha256/<hash>` y verificar una descarga de muestra. El contrato de la API no cambia.
- **MinIO:** el adaptador S3 está implementado y compila, pero en la máquina de desarrollo `quay.io/minio/minio:latest` responde 401. La evidencia de C3 usa el adaptador local.

## 8. Verificación

```bash
pnpm --filter @ccltpg/api test src/modules/files
pnpm test:integration        # con DATABASE_*_URL y PostgreSQL real
pnpm arch:check
```

Evidencia esperada:

- `file-type-inspector.spec.ts`: 7 pruebas de tipo, extensión y MIME falsificado.
- `file.service.spec.ts`: carga, deduplicación, cuarentena, compensación y descarga.
- Integración: PDF limpio, repetición idempotente, descarga ajena 404, EICAR en cuarentena y auditoría de descarga.
