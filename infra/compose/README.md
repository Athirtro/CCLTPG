# infra/compose — Entorno de desarrollo

Levanta PostgreSQL 16, Redis 7 y MinIO con un comando.

## Arranque

```bash
cp infra/compose/.env.example infra/compose/.env
# editar las contraseñas locales
pnpm infra:up
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml ps
```

Todos los servicios deben aparecer `healthy`. `minio-init` termina después de crear el bucket.

## Servicios

| Servicio      | Puerto por defecto          | Notas                                                                                        |
| ------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| PostgreSQL 16 | 5432                        | Crea roles `ccltpg_migrator`, `ccltpg_app`, `ccltpg_readonly` y esquemas `public`/`academic` |
| Redis 7.4     | 6379                        | AOF activo, sin expulsión de claves                                                          |
| MinIO         | 9000 (API) / 9001 (consola) | Bucket `ccltpg` privado                                                                      |
| minio-init    | —                           | Job de una ejecución                                                                         |

## URLs de conexión

```text
postgresql://ccltpg_migrator:<password>@localhost:5432/ccltpg
postgresql://ccltpg_app:<password>@localhost:5432/ccltpg
postgresql://ccltpg_readonly:<password>@localhost:5432/ccltpg
redis://localhost:6379
http://localhost:9000
```

Copiar esos valores al `.env` de la raíz (`DATABASE_URL`, `DATABASE_MIGRATOR_URL`, `DATABASE_READONLY_URL`, `REDIS_URL`).

## Comandos

| Comando            | Efecto                                                       |
| ------------------ | ------------------------------------------------------------ |
| `pnpm infra:up`    | Levanta o actualiza los servicios                            |
| `pnpm infra:logs`  | Sigue los logs                                               |
| `pnpm infra:down`  | Detiene sin borrar datos                                     |
| `pnpm infra:reset` | Detiene y **borra** volúmenes (re-ejecuta la inicialización) |

## Limitaciones conocidas

- La API y la SPA se ejecutan en el host (`pnpm dev`) en C1; su imagen queda para C5.
- `quay.io/minio/minio:latest` se fijará por digest cuando exista un registro verificado (C5/C8).
- Si Docker no está instalado, este entorno no se puede levantar: la verificación de C1 queda pendiente de evidencia.
