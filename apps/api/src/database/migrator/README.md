# Migrador de base de datos

Ejecuta migraciones `up` / `down` separadas por esquema (`public`, `academic`) con Kysely.

## Reglas

- Cada esquema tiene su historial propio: `<schema>.kysely_migration` y `<schema>.kysely_migration_lock`.
- Toda migración implementa `up` y `down`; se verifica `up → down → up` sobre base vacía.
- Una migración pertenece a un solo esquema; no se escribe SQL de `academic` desde `public` ni al revés.
- Los esquemas y roles los crea la infraestructura (`infra/compose/postgres/init`), no una migración: así el historial puede crearse antes de la primera migración.
- Las tablas de negocio llegan en C2/C4, después de que Rol A aplique RC-A-01…04. En C1 solo se valida el mecanismo.

## Uso

```bash
pnpm --filter @ccltpg/api migrate:status
pnpm --filter @ccltpg/api migrate:up            # ambos esquemas
pnpm --filter @ccltpg/api migrate:up academic   # solo academic
pnpm --filter @ccltpg/api migrate:down public   # una reversión en public
```

Requiere `DATABASE_MIGRATOR_URL` (rol `ccltpg_migrator`). En desarrollo, si no está definida, usa el valor local de Compose.

## Estructura

```
src/database/migrations/
  public/       # tablas de identidad, auditoría, archivos, notificaciones, exportaciones, analítica
  academic/     # tablas del contexto académico
```

`FileMigrationProvider` solo carga archivos `.ts`/`.js`; los `README.md` se ignoran.
