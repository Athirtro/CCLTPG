# Inicialización de PostgreSQL

`00-roles.sql` se ejecuta automáticamente cuando el volumen `ccltpg-pgdata` está vacío. Crea:

| Rol | Uso | Privilegios |
| --- | --- | --- |
| `ccltpg_migrator` | Migraciones Kysely | DDL y dueño de tablas en `public` y `academic` |
| `ccltpg_app` | API en ejecución | DML (`SELECT/INSERT/UPDATE/DELETE`), sin DDL |
| `ccltpg_readonly` | Consultas analíticas | Solo `SELECT`; `default_transaction_read_only = on` |

También crea los esquemas `public` y `academic` y retira los privilegios por defecto de `PUBLIC`.

## Reglas

- **No editar este archivo esperando que se re-ejecute**: solo corre con el volumen vacío. Para recrear el entorno: `pnpm infra:reset` (borra datos).
- Las contraseñas vienen de `infra/compose/.env` y nunca se versionan.
- La inmutabilidad de auditoría (revocar `UPDATE/DELETE` y disparador) se añade en C2 sobre `public.evento_auditoria`, no aquí.
