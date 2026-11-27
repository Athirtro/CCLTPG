# Runbook — migraciones y reversión

- **Objetivo:** aplicar, inspeccionar y revertir migraciones sin romper el historial por esquema.
- **Herramienta:** Kysely Migrator con `FileMigrationProvider` (decisión D30-A).
- **Esquemas:** `public`, `academic` y `emisora`, cada uno con historial y candado propios.

## 1. Reglas del mecanismo

1. Una migración pertenece a **un solo** esquema. No se escribe SQL de `academic` desde `public` ni al revés; `emisora` tampoco escribe en `public` ni en `academic` (§2.2 del plan).
2. Cada migración implementa `up` y `down`. Sin `down` no se acepta la migración.
3. Los esquemas y roles los crea `infra/compose/postgres/init/00-roles.sql`, no una migración.
4. Solo el rol `ccltpg_migrator` puede ejecutar DDL. La API usa `ccltpg_app`.
5. Todo cambio se valida con `up → down → up` sobre base vacía antes de considerarse entregado.
6. En C1 las carpetas de negocio estaban vacías; C2 añadió el núcleo de identidad y auditoría en `public`. Las tablas académicas llegan con RC-A en C4.

## 2. Variables necesarias

```dotenv
DATABASE_MIGRATOR_URL=postgresql://ccltpg_migrator:<password>@localhost:5432/ccltpg
```

`DATABASE_URL` (rol de aplicación) no sirve para migrar: el rol de aplicación no tiene DDL.

## 3. Comandos

```bash
pnpm migrate:status              # estado de public, academic y emisora
pnpm migrate:up                  # aplica pendientes en los tres esquemas
pnpm migrate:up public           # solo public
pnpm migrate:up academic         # solo academic
pnpm migrate:up emisora          # solo emisora
pnpm migrate:down public         # una migración atrás en public
pnpm migrate:down academic       # una migración atrás en academic
pnpm migrate:down emisora        # una migración atrás en emisora
```

`down` exige un esquema explícito; no existe `down all`. Es deliberado: una reversión masiva no debe ser accidental.

Los comandos equivalentes dentro del paquete son:

```bash
pnpm --filter @ccltpg/api migrate:status
pnpm --filter @ccltpg/api migrate:up academic
pnpm --filter @ccltpg/api migrate:up emisora
pnpm --filter @ccltpg/api migrate:down public
```

## 4. Añadir una migración

1. Crear el archivo en el esquema correcto:

   ```text
   apps/api/src/database/migrations/public/0002_crear_estudiante.ts
   apps/api/src/database/migrations/academic/0003_crear_grupo.ts
   apps/api/src/database/migrations/emisora/0001_create_emisora_core.ts
   ```

2. Exportar `up` y `down` con Kysely:

   ```ts
   import { type Kysely, sql } from 'kysely';

   export async function up(db: Kysely<unknown>): Promise<void> {
     await db.schema
       .createTable('estudiante')
       .addColumn('id', 'uuid', (column) => column.primaryKey())
       .execute();
   }

   export async function down(db: Kysely<unknown>): Promise<void> {
     await db.schema.dropTable('estudiante').execute();
   }
   ```

3. Añadir una prueba de integración que ejecute `up → down → up` con PostgreSQL real.
4. Verificar privilegios: el rol de aplicación debe poder hacer DML y el de solo lectura no debe poder escribir.
5. Actualizar el diccionario/modelo solo si Rol A ya ratificó RC-A-01…04.

## 5. Verificación con PostgreSQL real

Con PostgreSQL levantado y las variables `DATABASE_*_URL` definidas:

```bash
pnpm test:integration
```

La suite `apps/api/test/integration/migrator.spec.ts` comprueba:

- `up → down → up` en `public` con una migración fixture.
- Historiales separados: `public.kysely_migration`, `academic.kysely_migration` y `emisora.kysely_migration`.
- `emisora-migrations.spec.ts` aplica las cuatro migraciones de emisora con `up → down → up`.
- Que el candado por esquema no mezcle ejecuciones.

La suite `db-roles.spec.ts` comprueba que `ccltpg_app` no puede hacer DDL y que `ccltpg_readonly` no puede escribir.

## 6. Reversión

### Reversión normal de una migración

```bash
pnpm migrate:status             # confirmar qué está aplicado
pnpm migrate:down public        # revertir la última de public
pnpm migrate:status             # confirmar el estado
```

### Si `down` falla

1. **No** editar a mano las tablas de historial (`kysely_migration`, `kysely_migration_lock`).
2. Leer el error completo del comando.
3. Si el candado quedó tomado por un proceso muerto, confirmar que no hay otro migrador ejecutándose y liberar el candado solo con autorización explícita:

   ```sql
   -- Ejecutar como ccltpg_migrator, tras confirmar que no hay migrador activo.
   delete from public.kysely_migration_lock where id = 'main';
   ```

4. Si la migración ya modificó datos, la salida preferida es **forward-fix**: una migración nueva que corrija el estado. La reversión destructiva requiere copia de seguridad y aprobación.

### Reversión en un entorno con datos

1. Tomar copia de seguridad verificable.
2. Anunciar la ventana y el impacto.
3. Ejecutar `migrate:down` con el esquema explícito.
4. Verificar salud (`/api/v1/health/ready`) y pruebas críticas.
5. Registrar el incidente y la causa.

En producción no se ejecuta `down` como primera opción: se prefiere una migración correctiva hacia adelante.

## 7. Diagnóstico

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `Migrador: DATABASE_MIGRATOR_URL no está definida` | Falta la variable | Copiar `.env.example` y completar |
| `password authentication failed` | Contraseña desalineada | Alinear `.env` con PostgreSQL; ver rotación |
| `permission denied for schema public` | Se usó el rol de aplicación | Usar `DATABASE_MIGRATOR_URL` |
| `relation "kysely_migration" already exists` | Esquema creado fuera del flujo | Revisar el script de roles y el historial |
| `(nada por ejecutar)` | No hay migraciones pendientes | Es el resultado esperado en C1 |
| Error de candado | Otro migrador en ejecución o proceso interrumpido | Confirmar procesos y liberar con autorización |

## 8. Evidencia C1

- `apps/api/test/integration/migrator.spec.ts` — 2 pruebas verdes contra PostgreSQL 16 real (puerto 55432).
- `apps/api/test/integration/db-roles.spec.ts` — 5 pruebas verdes de privilegios.
- En la máquina de desarrollo no hay Docker: la ejecución de Compose sigue pendiente; la evidencia se produjo con PostgreSQL 16 embebido.
