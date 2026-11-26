# Runbook — respaldo y restauración

- **Objetivo:** producir copias cifradas y verificables de PostgreSQL, Redis y MinIO, y restaurarlas en un entorno aislado sin romper la inmutabilidad de la auditoría.
- **Responsable:** Rol B (seguridad y operación); ejecución con DBA cuando el entorno lo requiera.
- **Estado:** **procedimiento documentado; simulacro NO ejecutado.** Este documento no acredita C-25, C-46 ni AC-SEC-33: hace falta un acta con tiempos medidos (§6).
- **Objetivos:** RPO ≤ 15 min y RTO ≤ 4 h. Son metas dependientes de la infraestructura disponible (`docs/assumptions.md`, SUP-004/SUP-005); no se declaran cumplidas sin medición.
- **Retención:** auditoría ≥ 5 años; respaldos con la misma retención que la auditoría; staging sin datos reales (`docs/contratos/cambios/cambio-retencion-c8.md`, control C-26).

## 1. Reglas

1. La API **nunca** ejecuta DDL. Esquemas y roles los crea `infra/compose/postgres/init/00-roles.sql`; las migraciones se ejecutan solo con `ccltpg_migrador` (`docs/runbook/migraciones.md`).
2. `public.evento_auditoria` **no se borra ni se edita**: sin `UPDATE`, `DELETE` ni `TRUNCATE` desde la aplicación (AC-AUD-06/07/15). Una restauración que retroceda la traza exige aprobación y un evento `auditoria.correccion` posterior (`modelo-auditoria-v1.md` §5.4).
3. Restaurar **siempre en una base/entorno separado**. Nunca se sobrescribe la base en producción como primer paso.
4. Los respaldos contienen ciphertext de PII (ADR-0003). Las claves de descifrado se custodian en el gestor de secretos, **nunca** en el repositorio ni en el mismo soporte que el respaldo.
5. Todo respaldo se cifra y se verifican su hash y su integridad antes de declararlo válido.
6. Los secretos de `infra/compose/.env` no se versionan; el operador los lee de ese archivo local o del gestor de secretos, sin pegarlos en tickets, logs ni comandos compartidos.

## 2. Inventario de lo que se respalda

| Componente | Dato | Mecanismo | Destino |
| --- | --- | --- | --- |
| PostgreSQL 16 | esquemas `public` y `academic`, auditoría, outbox, vistas | `pg_dump -Fc` + archivado de WAL para PITR | Almacenamiento cifrado externo |
| Redis 7.4 | sesiones parciales, caché, idempotencia | AOF (`appendonly yes` en Compose) | Copia del directorio `appendonlydir` |
| MinIO | objetos de `files` (bucket `ccltpg`) | `mc mirror` del bucket | Almacenamiento cifrado externo |
| Claves / secretos | JWT, cifrado PII, HMAC, base, MinIO | Gestor de secretos, exportación controlada | Bóveda separada del respaldo |

> En el Compose de desarrollo no hay `archive_mode` ni destino de WAL configurado: **PITR no está disponible localmente**. Para producción, la plataforma o el proveedor debe garantizar archivado continuo de WAL con retención ≥ 5 años.

## 3. Respaldo

### 3.1 Precondiciones

```bash
docker compose ps
curl -fsS http://localhost:3000/api/v1/health/ready
```

Ambas deben estar sanas. Si `/health/ready` responde 503, revisar `docs/runbook/operacion.md` §5 antes de continuar.

Definir el nombre del lote con UTC:

```bash
LOTE=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "backups/$LOTE"
```

### 3.2 PostgreSQL — copia base

```bash
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-ccltpg}" -Fc -Z 9 \
  > "backups/$LOTE/ccltpg.dump"
```

Verificación mínima del volcado:

```bash
pg_restore -l "backups/$LOTE/ccltpg.dump" | head
```

Si el entorno es administrado y no permite `pg_dump` directo, usar el mecanismo del proveedor, pero conservar el formato y la misma verificación.

### 3.3 PostgreSQL — WAL para PITR

Requerido para RPO ≤ 15 min. En producción confirmar que la plataforma tiene `archive_mode=on` y un destino de WAL con retención acorde a la política. Registrar en el acta el último WAL archivado y su timestamp. Sin esta evidencia, el RPO real es el intervalo entre copias base y **no** se afirma 15 min.

### 3.4 Redis

```bash
docker compose exec -T redis redis-cli BGREWRITEAOF
docker compose exec -T redis redis-cli INFO persistence | findstr aof_rewrite_in_progress
docker compose cp redis:/data/appendonlydir "backups/$LOTE/redis-appendonlydir"
```

Esperar a que `aof_rewrite_in_progress:0` antes de copiar. Los valores de sesión parcial son efímeros: su pérdida afecta a la experiencia de login, no a la auditoría.

### 3.5 MinIO

Requiere el cliente `mc` en la máquina del operador:

```bash
mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mirror --overwrite "local/${MINIO_BUCKET:-ccltpg}" "backups/$LOTE/minio"
```

No usar URLs prefirmadas ni bucket público. La descarga de archivos siempre pasa por la API.

### 3.6 Cifrado, integridad y registro

```bash
gpg --batch --yes --symmetric --cipher-algo AES256 \
  --output "backups/$LOTE/ccltpg.dump.gpg" "backups/$LOTE/ccltpg.dump"
sha256sum "backups/$LOTE/ccltpg.dump.gpg" \
  "backups/$LOTE/redis-appendonlydir"/* "backups/$LOTE/minio"/* \
  > "backups/$LOTE/MANIFEST.sha256"
sha256sum -c "backups/$LOTE/MANIFEST.sha256"
```

Borrar el volcado en claro solo después de verificar el cifrado y el hash. Registrar en el acta: lote, hora UTC inicio/fin, tamaño, hash, responsable y ubicación del respaldo cifrado.

## 4. Restauración en entorno aislado

### 4.1 Restauración de la copia base

```bash
LOTE=<lote-a-restaurar>
gpg --batch --yes --decrypt "backups/$LOTE/ccltpg.dump.gpg" > "backups/$LOTE/ccltpg.dump"
sha256sum -c "backups/$LOTE/MANIFEST.sha256"

psql -U postgres -d postgres -c 'create database ccltpg_restore_test'
pg_restore --no-owner --no-privileges \
  -U postgres -d ccltpg_restore_test "backups/$LOTE/ccltpg.dump"
```

`--no-owner --no-privileges` evita conflictos con roles ya existentes en el clúster. No reintentar `00-roles.sql` en un clúster donde los roles ya existen; solo en uno nuevo.

Comprobaciones:

```bash
psql -U postgres -d ccltpg_restore_test -c 'select count(*) from public.evento_auditoria'
psql -U postgres -d ccltpg_restore_test -c 'select count(*) from academic.estudiante'
```

Comparar con los conteos registrados en el acta de respaldo. Si la API debe apuntar a la base restaurada, cambiar `DATABASE_URL` **solo en el entorno aislado** y ejecutar `pnpm migrate:status` para confirmar que el historial está completo. No ejecutar migraciones nuevas sobre la restaurada salvo en prueba.

### 4.2 Restauración PITR

1. Restaurar la copia base en un clúster separado.
2. Repetir WAL hasta el instante objetivo según el procedimiento del proveedor.
3. Si el punto elegido es anterior al último evento de auditoría, comparar el conteo con la producción.
4. La pérdida de eventos es un procedimiento de **excepción**: requiere aprobación del responsable y un evento `auditoria.correccion` que documente el retroceso (ADR-0004, `modelo-auditoria-v1.md` §5.4). Nunca se reescriben eventos antiguos.

### 4.3 Redis y MinIO

Restaurar en instancias/buckets separados, nunca sobre los activos:

```bash
docker compose cp "backups/$LOTE/redis-appendonlydir" redis:/data/appendonlydir
mc mirror --overwrite "backups/$LOTE/minio" "local/${MINIO_BUCKET:-ccltpg}-restore"
```

Tras Redis, reiniciar el servicio y comprobar `redis-cli ping`. Tras MinIO, verificar la lista de objetos y que la API sigue siendo la única puerta de descarga.

### 4.4 Comprobación posterior

| Comprobación | Criterio |
| --- | --- |
| `GET /api/v1/health/ready` | 200 con PostgreSQL y Redis `up` |
| Conteos de auditoría y academic | Iguales a los del acta de respaldo (o diferencia explicada en PITR) |
| Correlación `requestId` | Los eventos restaurados conservan `request_id` y `actor_id` |
| Permisos | Prueba de denegación por defecto y un rol por perfil |
| Decisión de conmutación | Registrada y aprobada; sin switch automático |

## 5. Retención y baja

- Respaldos cifrados: misma retención que la auditoría (≥ 5 años) mientras exista deber de conservación.
- Staging/desarrollo: solo copia anonimizada o semilla (C-26); **nunca** un respaldo de producción sin anonimizar.
- Baja de respaldos: autorizada y registrada por el DBA; no purga automática desde la aplicación.

## 6. Simulacro y acta (pendiente)

| Campo | Valor |
| --- | --- |
| Fecha y entorno | **Pendiente** |
| Responsable / DBA | **Pendiente** |
| Lote de respaldo cifrado | **Pendiente** |
| Hora del último WAL y del incidente simulado | **Pendiente** |
| RPO medido (min) | **Pendiente** — objetivo ≤ 15 |
| RTO medido (min/h) | **Pendiente** — objetivo ≤ 4 h |
| Verificación de hash y cifrado | **Pendiente** |
| Conteos comparados y evento de corrección si aplica | **Pendiente** |
| Resultado / evidencia enlazada | **Pendiente** |

El simulacro debe ejecutarse al menos una vez y registrarse en `docs/reviews/c9/rol-b.md` (paquete donde se consolidó este runbook). Hasta que el acta exista, C-25 y C-46 permanecen **parciales** y AC-SEC-33/AC-AUD-15 no se marcan como verificados.

## 7. Diagnóstico

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `pg_dump: permission denied` | Rol sin permiso de lectura | Usar rol con privilegios de respaldo; no el de aplicación |
| `pg_restore` falla por roles/owners | Roles inexistentes o duplicados | `--no-owner --no-privileges`; revisar `00-roles.sql` solo en clúster nuevo |
| AOF incompleto | Copia durante `BGREWRITEAOF` | Esperar `aof_rewrite_in_progress:0` y repetir |
| `mc` sin credenciales | Variables no exportadas | Cargar `infra/compose/.env`; no versionar secretos |
| Hash no coincide | Respaldos parciales o manipulados | Descartar el lote, repetir y abrir incidente si hubo exposición |
| Restauración retrocede auditoría | PITR a punto anterior | Aprobación + `auditoria.correccion`; nunca editar eventos |

## 8. Referencias

- `docs/contratos/controles-seguridad-v1.md` (C-25, C-26, C-46).
- `docs/requirements/seguridad.md` (AC-SEC-33, AC-AUD-15).
- `docs/contratos/cambios/cambio-retencion-c8.md` (PA-011).
- `docs/contratos/modelo-auditoria-v1.md` (§5.4, §8) y `docs/adr/ADR-0004-auditoria-inmutable.md`.
- `docs/adr/ADR-0003-cifrado-columnas-sensibles.md` (claves separadas de los respaldos).
- `docs/runbook/migraciones.md`, `docs/runbook/operacion.md`, `docs/runbook/incidente-seguridad.md`.
