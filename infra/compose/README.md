# infra/compose — Entorno de desarrollo

**Propósito:** levantar el entorno de desarrollo con un solo comando (objetivo Iteración 1).

## Servicios previstos
- PostgreSQL 16 (esquemas `public`, `academic`, roles `ccltpg_migrator`, `ccltpg_app`, `ccltpg_readonly`)
- Redis
- API (`apps/api`)
- (Opcional/dev) Almacén de objetos compatible S3 (MinIO), según necesidad

## Estado
Placeholder. `docker-compose.yml` y `.env.example` deben completarse en Iteración 1 sin incluir secretos.
