# Runbook — exportaciones

- **Objetivo:** generar reportes PDF, XLSX y CSV de forma reproducible, idempotente y descargable sólo por la API.
- **Alcance:** `POST /api/v1/exports` y descarga de la salida por `GET /api/v1/files/{id}/download`.
- **Decisiones:** D56 (plantillas en código), D57 (idempotencia), D58 (`reporte.generado`).
- **Paquete de revisión:** `docs/reviews/c3/rol-b.md`.

## 1. Reglas que no se negocian

1. La plantilla y la validación viven en **código**; el módulo `exports` no consulta la base ni repositorios de dominio.
2. La entrada es JSON saneado: no se aceptan consultas, SQL ni referencias a tablas.
3. La salida se registra como `archivo` y se descarga por la ruta autorizada de archivos.
4. Toda generación exige `Idempotency-Key`; la repetición devuelve el mismo `archivoId`.
5. La auditoría `reporte.generado` y el evento de outbox se escriben en la misma transacción que el archivo.
6. Las celdas que empiezan por `=`, `+`, `-`, `@`, tabulador o retorno de carro se neutralizan en CSV, XLSX y PDF.

## 2. Configuración

```dotenv
EXPORT_MAX_ROWS=10000
EXPORT_MAX_BYTES=10485760      # 10 MB
```

Los límites se validan antes y después de renderizar. Superar filas devuelve 400 `EXPORT_PARAMETERS_INVALID`; superar bytes devuelve 413 `EXPORT_TOO_LARGE`.

## 3. Plantillas disponibles

| Código | Versión | Formato de salida | Columnas |
| --- | --- | --- | --- |
| `matriculas-por-programa` | 1 | `pdf`, `xlsx`, `csv` | `Programa`, `Matriculados`, `Activos` |

Parámetros:

```json
{
  "periodo": "2026-1",
  "filas": [
    { "programa": "Artes", "matriculados": 40, "activos": 36 },
    { "programa": "Música", "matriculados": 25 }
  ]
}
```

Reglas de validación:

- `periodo` obligatorio, máximo 32 caracteres.
- `filas` debe ser un arreglo no vacío.
- `programa` obligatorio, máximo 200 caracteres.
- `matriculados` entero no negativo.
- `activos` es opcional; si falta, toma el valor de `matriculados`; no puede ser mayor que `matriculados`.

La plantilla de C3 es una **muestra de compuerta** con datos sintéticos; los reportes académicos reales llegan en C6.

## 4. Operación normal

### 4.1 Generar

```bash
curl -X POST "http://localhost:3000/api/v1/exports" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "plantilla": "matriculas-por-programa",
    "formato": "csv",
    "parametros": {
      "periodo": "2026-1",
      "filas": [{"programa":"Artes","matriculados":40,"activos":36}]
    }
  }'
```

Respuesta `201`:

```json
{
  "archivoId": "<uuid>",
  "nombre": "matriculas-por-programa-v1.csv",
  "mime": "text/csv; charset=utf-8",
  "tamano": 123,
  "formato": "csv",
  "hashSha256": "<sha256>",
  "descargaUrl": "/api/v1/files/<uuid>/download"
}
```

### 4.2 Descargar

```bash
curl -OJ "http://localhost:3000/api/v1/files/<archivoId>/download" \
  -H "Authorization: Bearer <access-token>"
```

El creador queda como `subido_por` y puede descargar con `files:document:read_own`; el administrador descarga con `files:document:read`. No se emite una URL alternativa ni un enlace temporal.

### 4.3 Repetir sin duplicar

Repetir la misma solicitud con la **misma** clave devuelve el mismo `archivoId` y no crea otro archivo, otra auditoría ni otro evento. Cambiar cualquier parte del cuerpo con la misma clave devuelve 409 `IDEMPOTENCY_KEY_REUSED`.

## 5. Diagnóstico

| Código / síntoma | Causa probable | Acción |
| --- | --- | --- |
| `404 EXPORT_TEMPLATE_NOT_FOUND` | Código de plantilla inexistente | Usar `matriculas-por-programa` v1 |
| `415 EXPORT_FORMAT_NOT_SUPPORTED` | Formato fuera de `pdf`, `xlsx`, `csv` | Corregir `formato` |
| `400 EXPORT_PARAMETERS_INVALID` | Falta período o filas, longitud excesiva, entero inválido o `activos > matriculados` | Corregir el JSON |
| `413 EXPORT_TOO_LARGE` | La salida supera `EXPORT_MAX_BYTES` | Reducir filas o columnas |
| `400 IDEMPOTENCY_KEY_REQUIRED` | Falta la cabecera | Añadir `Idempotency-Key` |
| `409 IDEMPOTENCY_KEY_REUSED` | Misma clave con cuerpo distinto | Usar una clave nueva |
| `409 IDEMPOTENCY_IN_PROGRESS` | La generación anterior sigue en curso | Esperar y reintentar con la misma clave |
| `503 FILE_STORAGE_UNAVAILABLE` | Almacenamiento caído | Revisar el adaptador de objetos |
| El archivo no abre | Descarga incompleta o cliente que fuerza otro MIME | Verificar `Content-Type` y `Content-Disposition` |

## 6. Inspección

```sql
-- Ejecutar como ccltpg_readonly o ccltpg_migrator.
select id, nombre_original, mime, tamano, hash_sha256, subido_por, creado_en
from public.archivo
where id = '<archivo-id>';

select accion, actor_id, recurso_id, ocurrido_en, datos_despues
from public.evento_auditoria
where accion = 'reporte.generado' and recurso_id = '<archivo-id>';

select id, estado, intentos, ultimo_error
from public.evento_outbox
where tipo = 'reporte.generado' and payload ->> 'archivoId' = '<archivo-id>';
```

El evento de outbox permite notificar la disponibilidad del reporte. Su entrega sigue el runbook de notificaciones.

## 7. Neutralización de fórmulas y UTF-8

- **CSV:** BOM UTF-8, campos entre comillas, comillas internas duplicadas y salto `\r\n`. Una celda `=HYPERLINK(...)` se escribe como `'=HYPERLINK(...)`.
- **XLSX:** la celda se escribe como texto con apóstrofo inicial; el libro se genera con ExcelJS.
- **PDF:** el texto se sanea con el mismo criterio antes de dibujarlo.

La prueba `default-export-renderer.spec.ts` relee el XLSX con ExcelJS y verifica el CSV y la firma `%PDF-` del PDF.

## 8. Límites de C3

- **Apertura manual pendiente:** PDF y XLSX se validan por estructura y firma, pero la compuerta pide abrirlos en su aplicación real antes de la firma.
- **Sin reportes académicos reales:** la plantilla de muestra no consulta la base; los reportes de C6 llegarán con sus propias plantillas y fuentes de datos.
- **Sin purga de exportaciones:** la retención de archivos depende de PA-011 y se define en C5/C8.
- **Sin programación:** C3 sólo genera bajo demanda; no hay tareas periódicas de reportes.

## 9. Verificación

```bash
pnpm --filter @ccltpg/api test src/modules/exports
pnpm test:integration        # con DATABASE_*_URL y PostgreSQL real
pnpm contracts:validate
```

Evidencia esperada:

- `export-templates.spec.ts`: registro y validación de parámetros.
- `default-export-renderer.spec.ts`: 3 pruebas de CSV, XLSX y PDF con fórmulas neutralizadas.
- `exports.service.spec.ts`: plantilla inexistente, formato, límites, idempotencia, auditoría y outbox.
- Integración: CSV real, repetición sin duplicado, BOM UTF-8, `reporte.generado` y evento de outbox.
