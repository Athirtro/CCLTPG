# Migrador de base de datos

**Propósito:** ejecutar migraciones `up/down` separadas por esquema (`public`, `academic`) usando Kysely (según decisión tecnológica).

## Reglas previstas
- Migraciones reversibles (`up`, `down`) y verificables en secuencia `up`, `down`, `up` sobre base vacía y sobre instantánea de compuerta anterior.
- Una migración por esquema/cambio coherente; sin SQL cruzado entre esquemas de otros contextos.
- Roles de BD: `ccltpg_migrator` (DDL), `ccltpg_app` (DML sin DDL), `ccltpg_readonly` (vistas analíticas).

## Estado
Placeholder (implementación en Iteración 1).
