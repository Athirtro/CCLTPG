# Runbook — arranque local

- **Objetivo:** clonar el repositorio y dejar API, SPA, PostgreSQL, Redis y MinIO funcionando.
- **Tiempo estimado:** 15–25 minutos la primera vez (descarga de imágenes incluida).

## 1. Requisitos

| Herramienta | Versión | Verificación |
| --- | --- | --- |
| Node.js | 22.12+ (probado con 22.19.0) | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker Desktop + Compose | Reciente, con motor Linux | `docker compose version` |
| Git | Cualquiera reciente | `git --version` |

Si `corepack enable` falla con `EPERM` en Windows, instalar pnpm de forma global:

```powershell
npm i -g pnpm@9.15.4
```

## 2. Instalar dependencias

```bash
pnpm install --frozen-lockfile
```

No se debe regenerar `pnpm-lock.yaml` para arrancar. Si el lockfile está desactualizado, es un defecto que debe corregirse en el cambio que añadió la dependencia.

## 3. Configurar variables de entorno

1. Copiar el ejemplo de infraestructura y cambiar **todas** las contraseñas:

   ```bash
   cp infra/compose/.env.example infra/compose/.env
   ```

2. Copiar el ejemplo de la aplicación:

   ```bash
   cp .env.example .env
   ```

3. Alinear en `.env` las URLs de base de datos con las contraseñas de `infra/compose/.env`:

   ```dotenv
   DATABASE_URL=postgresql://ccltpg_app:<CCLTPG_APP_PASSWORD>@localhost:5432/ccltpg
   DATABASE_MIGRATOR_URL=postgresql://ccltpg_migrator:<CCLTPG_MIGRATOR_PASSWORD>@localhost:5432/ccltpg
   DATABASE_READONLY_URL=postgresql://ccltpg_readonly:<CCLTPG_READONLY_PASSWORD>@localhost:5432/ccltpg
   REDIS_URL=redis://localhost:6379
   ```

`infra/compose/postgres/init/00-roles.sql` crea los roles y esquemas cuando el volumen de PostgreSQL se inicializa por primera vez. Si se cambia una contraseña después, hay que rotarla también dentro de PostgreSQL; ver [rotación de secretos](rotacion-secretos.md).

## 4. Levantar infraestructura

```bash
pnpm infra:up
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml ps
```

Se esperan cuatro contenedores: `ccltpg-postgres`, `ccltpg-redis`, `ccltpg-minio` y `ccltpg-minio-init` (este último termina con código 0). PostgreSQL, Redis y MinIO deben reportarse como `healthy`.

Si un servicio queda `unhealthy`:

```bash
pnpm infra:logs
```

## 5. Aplicar migraciones

```bash
pnpm migrate:status
pnpm migrate:up
```

En C1 no hay tablas de negocio: el comando deja el mecanismo, los historiales y los esquemas listos. El detalle está en [migraciones](migraciones.md).

## 6. Arrancar API y SPA

```bash
pnpm dev
```

| Servicio | URL |
| --- | --- |
| API | `http://localhost:3000/api/v1` |
| SPA | `http://localhost:5173` |
| Estado de la SPA | `http://localhost:5173/estado` |
| Métricas (fuera de `/api/v1`) | `http://localhost:3000/metrics` |
| Consola MinIO | `http://localhost:9001` |

Verificación mínima:

```bash
curl -i http://localhost:3000/api/v1/health/live
curl -i http://localhost:3000/api/v1/health/ready
```

- `live` debe responder `200` con `status: "ok"` y `requestId`.
- `ready` debe responder `200` con PostgreSQL y Redis en `up`.
- Si falta una dependencia, `ready` responde `503` en `application/problem+json` con `code=SERVICE_UNAVAILABLE`.

## 7. Verificación de calidad

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:architecture
pnpm test:security
pnpm test:contracts
pnpm contracts:validate
pnpm contracts:lint
pnpm build
```

La integración con base real requiere las variables `DATABASE_*_URL` y un PostgreSQL accesible:

```bash
pnpm test:integration
```

## 8. Apagar el entorno

```bash
pnpm infra:down          # conserva volúmenes
pnpm infra:reset         # elimina contenedores y volúmenes (destructivo)
```

## 9. Problemas frecuentes

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `corepack enable` → `EPERM` | Permisos sobre la instalación de Node en Windows | Usar `npm i -g pnpm@9.15.4` |
| `ready` responde 503 con `redis` | Redis aún no está listo o el puerto está ocupado | `pnpm infra:logs`; verificar `REDIS_URL` |
| `password authentication failed for user "ccltpg_app"` | `.env` no coincide con `infra/compose/.env` | Alinear contraseñas o rotarlas |
| Los roles no existen | El volumen ya estaba inicializado antes de cambiar el script | Ejecutar el script manualmente o recrear el volumen en local |
| `EADDRINUSE` en 3000 o 5173 | Otro proceso ocupa el puerto | Cambiar `PORT` o detener el proceso |
| `docker: command not found` | Docker no está instalado | Instalar Docker Desktop o ejecutar el guion en otra máquina |
