# Runbook — operación y diagnóstico

- **Objetivo:** determinar si la API está sana, localizar la causa de un fallo y correlacionar logs, métricas y trazas.
- **Herramientas:** `/health/live`, `/health/ready`, `/metrics`, logs Pino y trazas OpenTelemetry.

## 1. Salud

### Liveness — `GET /api/v1/health/live`

Confirma que el proceso responde. **No** consulta dependencias.

```bash
curl -s http://localhost:3000/api/v1/health/live
```

```json
{
  "status": "ok",
  "uptimeSeconds": 42,
  "timestamp": "2026-11-17T12:00:00.000Z",
  "requestId": "01a1ec52-3f1b-7c4d-8e5f-6a7b8c9d0e1f"
}
```

- `200`: proceso vivo.
- Sin respuesta: el proceso no está escuchando, está bloqueado o el puerto es incorrecto.
- Kubernetes/Compose debe usar esta ruta para reinicios por proceso colgado, **nunca** para retirar tráfico.

### Readiness — `GET /api/v1/health/ready`

Comprueba PostgreSQL y Redis con `HEALTH_TIMEOUT_MS` (2 s por defecto).

```bash
curl -i http://localhost:3000/api/v1/health/ready
```

- `200`: `status: "ok"` y ambas dependencias en `up`.
- `503`: Problem Details con `code: "SERVICE_UNAVAILABLE"` y el detalle de las dependencias caídas.

```json
{
  "type": "about:blank",
  "title": "Service Unavailable",
  "status": 503,
  "detail": "Dependencias no disponibles: redis.",
  "instance": "/api/v1/health/ready",
  "code": "SERVICE_UNAVAILABLE",
  "requestId": "01a1ec52-3f1b-7c4d-8e5f-6a7b8c9d0e1f"
}
```

La respuesta **no** filtra `ECONNREFUSED`, credenciales ni cadenas de conexión.

### Uso esperado

| Entorno | Liveness | Readiness |
| --- | --- | --- |
| Compose/Kubernetes | Reiniciar el contenedor si falla 3 veces seguidas | Retirar tráfico mientras falle |
| Monitorización | Alerta si falla > 2 min | Alerta si falla > 1 min |

## 2. Métricas

`GET /metrics` expone formato Prometheus. Está **fuera** de `/api/v1`, no aparece en OpenAPI y no es una ruta pública de negocio.

```bash
curl -s http://localhost:3000/metrics | head
```

Métricas propias:

| Métrica | Tipo | Etiquetas | Uso |
| --- | --- | --- | --- |
| `ccltpg_http_requests_total` | Counter | `method`, `route`, `status` | Volumen y tasa de errores |
| `ccltpg_http_request_duration_seconds` | Histogram | `method`, `route`, `status` | Latencia p50/p95/p99 |

Además se exportan las métricas por defecto de Node con prefijo `ccltpg_` (CPU, memoria, event loop, handles).

La etiqueta `route` usa la ruta declarada; las rutas no reconocidas se agrupan como `unmatched` para evitar cardinalidad ilimitada desde 404 arbitrarios.

### Consultas útiles

```promql
# Tasa de 5xx por ruta
sum by (route) (rate(ccltpg_http_requests_total{status=~"5.."}[5m]))

# p95 de latencia
histogram_quantile(0.95, sum by (le, route) (rate(ccltpg_http_request_duration_seconds_bucket[5m])))

# Disponibilidad de readiness (si se sondea con blackbox_exporter)
probe_success{job="ccltpg-ready"}
```

### Restricción de acceso

En producción, `/metrics` **no** debe quedar expuesto a Internet:

- Restringirlo por red (security group, NetworkPolicy, listener interno).
- O exigir mTLS/autenticación en el proxy.
- El contenedor no debe publicar ese puerto en el balanceador público.

## 3. Logs

Formato JSON en producción; `pino-pretty` en desarrollo. Campos estables:

| Campo | Significado |
| --- | --- |
| `req.id` | `requestId` (UUIDv7) aceptado o generado; se devuelve en `X-Request-Id` |
| `req.method`, `req.url`, `req.remoteAddress` | Datos mínimos de la solicitud |
| `res.statusCode` | Estado HTTP |
| `responseTime` | Duración en ms |
| `traceId`, `spanId` | Presentes solo si OpenTelemetry está activo |
| `msg` | Mensaje |
| `level`, `time`, `pid`, `hostname` | Metadatos Pino |

### Redacción

Se eliminan de los logs:

- `authorization`, `cookie`, `x-csrf-token`, `set-cookie`.
- Contraseñas, códigos MFA, tokens y secretos de sesión.
- Email, documento, teléfono, dirección, nombres y apellidos.

Si aparece PII en un log, es un defecto de seguridad: abrir incidente y añadir la ruta al arreglo `REDACT_PATHS` de `apps/api/src/shared/observability/logger.config.ts` con su prueba.

### Correlación

1. Tomar `X-Request-Id` de la respuesta o del Problem Details (`requestId`).
2. Buscar ese UUID en los logs.
3. Si hay trazas, usar `traceId`/`spanId` del mismo registro para abrir la traza en el colector.

Las rutas de salud se excluyen del log automático de peticiones para no generar ruido.

## 4. Trazas (OpenTelemetry)

Desactivadas por defecto. Se activan con:

```dotenv
OTEL_ENABLED=true
OTEL_SERVICE_NAME=ccltpg-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

Instrumentaciones: HTTP, Express, PostgreSQL (`pg`) y Redis (`ioredis`). El exportador es OTLP/HTTP.

Al activarlas:

1. Arrancar un colector compatible (Jaeger, Tempo, OTel Collector) en el endpoint configurado.
2. Reiniciar la API.
3. Hacer una petición a `/api/v1/health/ready` (genera spans de HTTP, PostgreSQL y Redis).
4. Confirmar que el log incluye `traceId` y `spanId` y que la traza aparece en el colector.

Si el colector no está disponible, la API sigue funcionando: el exportador falla en segundo plano. Revisar los mensajes de diagnóstico de OpenTelemetry.

En C1 no hay muestreo configurado; todas las trazas se exportan. Ajustar el sampler en C5/C8 según volumen.

## 5. Diagnóstico paso a paso

### La API no responde

1. Confirmar proceso y puerto: `PORT` (3000 por defecto).
2. Revisar logs de arranque.
3. Probar `/health/live`.
4. Si el proceso murió, buscar el error de arranque (variables inválidas, puerto ocupado, migración faltante).

### `/health/live` responde pero `/health/ready` da 503

1. Leer `detail`: indica la dependencia caída.
2. PostgreSQL:
   - `docker compose ps` / estado del servicio.
   - Probar conexión con el rol `ccltpg_app`.
   - Revisar `DATABASE_URL` y que el rol exista.
3. Redis:
   - `redis-cli ping` o estado del contenedor.
   - Revisar `REDIS_URL`.
4. Reintentar. Si persiste, revisar timeouts y saturación de conexiones.

### Latencia alta

1. Consultar p95 por ruta en Prometheus.
2. Comparar con logs `responseTime`.
3. Si la latencia está en PostgreSQL, revisar plan de consultas y conexiones del pool.
4. Si está en Redis, revisar disponibilidad y tamaño de valores.
5. Si no hay trazas, activar `OTEL_ENABLED=true` en un entorno de diagnóstico.

### Errores 5xx

1. Agrupar por `route` y `status`.
2. Buscar el `requestId` de un caso concreto.
3. Revisar el Problem Details: `code` y `instance`.
4. Confirmar si el error es de dependencia, validación o defecto de código.
5. Abrir incidente si hay exposición de datos o supera el umbral acordado.

### CORS rechazado

Respuesta `403` con `code: "CORS_ORIGIN_DENIED"`. El `Origin` no está en `CORS_ORIGINS`. Añadirlo solo si el origen es legítimo y está autorizado; reiniciar la API.

## 6. Alertas mínimas sugeridas (C5)

| Alerta | Condición | Severidad |
| --- | --- | --- |
| API caída | `up == 0` durante 2 min | Crítica |
| Readiness fallando | `probe_success == 0` durante 1 min | Crítica |
| Tasa de 5xx | > 5 % durante 5 min | Alta |
| Latencia p95 | > 1 s durante 10 min | Media |
| Errores de Redis/PostgreSQL | incremento sostenido en logs | Alta |
| Reinicios frecuentes | > 3 en 15 min | Alta |

Los umbrales definitivos se ratifican en C5 junto con PA-009.

## 7. Evidencia C1

- `/metrics` probado: expone `ccltpg_http_requests_total` y `ccltpg_http_request_duration_seconds`; `/api/v1/metrics` responde 404.
- Redacción de PII probada en `apps/api/test/api/security-headers.spec.ts`.
- Trazas: configuración condicional implementada; requieren un colector externo para evidencia visual, que no forma parte de C1.
