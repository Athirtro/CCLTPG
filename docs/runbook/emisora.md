# Runbook — compuerta manual de carga de la Emisora R.A.C. (RNF-06)

- **Objetivo:** ejecutar y interpretar la compuerta manual de 200 usuarios concurrentes sobre la consulta de programación diaria.
- **Umbrales aceptados:** p95 < 4 s, tasa de peticiones fallidas < 1 % y **cero** errores 5xx.
- **Carácter:** compuerta manual de aceptación. **No se ejecuta en el CI estándar**; el job `e2e` de `.github/workflows/ci.yml` ya corre `pnpm test:e2e` (recorridos E2/E3/E4, incluida la emisora) con Chromium. Añadir k6 al CI convertiría una medición de rendimiento en una compuerta no determinista y compartiría recursos con las pruebas funcionales.
- **Responsable:** Rol B — operación; Jefe de emisora — negocio.
- **Script:** `k6/emisora-programacion.js`; atajo `pnpm load:emisora`.

## 1. Requisitos previos

| Requisito | Verificación |
| --- | --- |
| k6 instalado (o contenedor con k6) | `k6 version` |
| PostgreSQL y Redis disponibles | `curl -fsS http://localhost:3000/api/v1/health/ready` responde 200 |
| Migraciones y semilla aplicadas | `pnpm migrate:up && pnpm db:seed` |
| Datos deterministas E2/E4 presentes | `pnpm test:e2e` ejecutado al menos una vez en el entorno (su `globalSetup` siembra la programación del `2026-01-19`) |
| API iniciada **sin** limitador de tasa | `AUTH_RATE_LIMIT_ENABLED=false` en el entorno de la API |

El dato consultado es `GET /api/v1/emisora/programacion-diaria?fecha=2026-01-19`
(`operationId getEmisoraProgramacion`). Si se elige otra fecha, definir
`K6_FECHA`. La fecha debe existir en `emisora.programacion_diaria`.

### ¿Por qué `AUTH_RATE_LIMIT_ENABLED=false`?

El script inicia sesión una sola vez en `setup()` y reparte el mismo
`accessToken` entre los 200 VUs. El limitador `api:user` está fijado en
300 peticiones/minuto **por `userId`** (`apps/api/src/modules/identity/application/rate-limits.ts`).
Con un token compartido, 200 VUs superarían ese cupo en segundos y la medición
se llenaría de `429`, que no son 5xx pero invalidan la lectura de latencia.
El limitador se desactiva **solo en el entorno de carga**: su comportamiento se
verifica en las pruebas de C2, no en una prueba de rendimiento. Si el equipo
quisiera medir con el limitador activo, debe aprovisionar 200 cuentas distintas
y usar un token por VU; en ese caso documentar el cambio aquí antes de ejecutar.

> No ejecutar la compuerta contra producción. Usar un entorno de
> staging con datos sembrados y elapsed times equiparables a producción.

## 2. Credenciales

La contraseña **nunca** se versiona. El usuario por defecto es la fixture
determinista `e2e-jefe-emisora@ccltpg.org` (perfil `jefe_emisora`, sin MFA, sin
cambio de contraseña obligatorio), que posee `emisora:*:manage` y por tanto
`emisora:programacion:read`.

```bash
export K6_BASE_URL='http://localhost:3000'      # host de la API, sin /api/v1
export K6_API_PREFIX='/api/v1'                  # API_PREFIX de la API
export K6_EMAIL='e2e-jefe-emisora@ccltpg.org'
export K6_PASSWORD='<contraseña_del_entorno>'   # secreto: nunca en el repo
export K6_FECHA='2026-01-19'
```

El script falla en `setup()` si `K6_PASSWORD` está vacío, antes de generar
cualquier carga. La contraseña no se imprime ni se envía a ningún sistema
distinto del endpoint `/auth/login` del entorno elegido.

## 3. Ejecución

```bash
pnpm load:emisora
```

Equivalente directo:

```bash
k6 run k6/emisora-programacion.js --summary-export /tmp/emisora-k6-resumen.json
```

Perfil de carga (definido en `options.scenarios`):

| Etapa | Duración | VUs |
| --- | --- | --- |
| Rampa de subida | 30 s | 0 → 200 |
| Sostenido | 1 min | 200 |
| Rampa de bajada | 30 s | 200 → 0 |

Cada VU espera 1 s entre consultas (`sleep(1)`), simula una persona leyendo la
programación y no un bombardeo. Para un esmoke rápido se puede bajar `K6_VUS`,
pero **la aceptación de RNF-06 exige el valor por defecto de 200**.

## 4. Criterio de aceptación

| Métrica | Umbral | Lectura |
| --- | --- | --- |
| `http_req_duration{name:programacion-diaria}` p95 | `< 4000` ms | RNF-06 |
| `http_req_failed` | `rate < 0.01` | Menos del 1 % de respuestas 4xx/5xx |
| `errores_5xx` | `count < 1` | Cero respuestas 5xx (estricto) |
| `checks` | `100.00%` | 200 en la consulta, sin 5xx y cuerpo JSON válido |

Un `k6 run` termina con código de salida distinto de cero si cualquier
umbral falla. Ese código es el veredicto de la compuerta: **no se considera
"aceptado con avisos"**. Adjuntar al registro de aceptación el resumen de k6
(p95, tasa de fallos, total de peticiones y checks) y la fecha/hora de ejecución.

## 5. Diagnóstico de fallos

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `setup()` falla con "No se pudo iniciar sesión" | Contraseña equivocada, cuenta bloqueada o MFA activo | Verificar la fixture y [reset de MFA](reset-mfa.md); revisar `/health/ready` |
| Respuesta `403` masiva | `K6_EMAIL` sin `emisora:programacion:read` | Usar el perfil `jefe_emisora` o revisar la matriz de autorización emisora |
| Respuesta `429` masiva | `AUTH_RATE_LIMIT_ENABLED=true` o cupo `api:user` agotado por compartir token | Reiniciar la API con el flag en `false`; no reintentar con el limitador activo |
| Respuesta `400` con `VALIDATION_FAILED` | `K6_FECHA` sin formato `YYYY-MM-DD` o sin programación | Usar `2026-01-19` o sembrar la fecha elegida |
| p95 alto sin 5xx | Saturación de CPU/pool de PostgreSQL o GC del proceso | Cruzar con [operación y diagnóstico](operacion.md): `ccltpg_http_request_duration_seconds`, `pg_stat_activity` y logs Pino |
| `errores_5xx > 0` | Fallo real de servicio; correlatear con `requestId` | Leer logs con el `requestId` de la respuesta Problem Details y [operación y diagnóstico](operacion.md) |

La compuerta se puede repetir las veces necesarias tras corregir la causa.
Cada repetición debe quedar registrada con su resumen; no se promedian
ejecuciones fallidas con exitosas.

## 6. Cierre y evidencia

La ejecución aceptada se registra en `docs/emisora-trazabilidad.md` (fila
RNF-06) y en `docs/diseno-emisora.md` §21. La evidencia mínima es:

1. Comando ejecutado y variables `K6_BASE_URL` / `K6_FECHA` / `K6_VUS` usadas
   (nunca `K6_PASSWORD`).
2. Fecha/hora y versión de k6.
3. Resumen con p95, `http_req_failed`, `errores_5xx` y total de peticiones.
4. Confirmación de que `AUTH_RATE_LIMIT_ENABLED=false` estaba activo.

### Registro de la ejecución de aceptación (2026-11-27)

| Dato | Valor |
| --- | --- |
| Fecha/hora | 2026-11-27T09:54Z |
| Versión | k6 v0.54.0 (linux/amd64) |
| Entorno | `K6_BASE_URL=http://localhost:3001`, instancia de carga con `AUTH_RATE_LIMIT_ENABLED=false`; `K6_FECHA=2026-01-19`, `K6_VUS=200` |
| Carga | 200 VUs máximos; 17 960 peticiones; 148,91 peticiones/s; 2 min |
| `http_req_duration{name:programacion-diaria}` | p95 9,82 ms (límite 4000 ms); máximo 53,05 ms |
| `http_req_failed` | 0,00 % (0 de 17 960) |
| `errores_5xx` | 0 |
| `checks` | 53 880/53 880 (100,00 %) |
| Veredicto | Umbrales `p(95)<4000`, `rate<0.01` y `count<1` cumplidos; compuerta **superada** |

Si la compuerta no se ejecuta en el entorno disponible, el estado se registra
como **pendiente de entorno**, nunca como "superada". Esa distinción ya se
aplicó en C5 (`docs/reviews/c5/rol-b.md`) y evita presentar una inferencia como
evidencia.
