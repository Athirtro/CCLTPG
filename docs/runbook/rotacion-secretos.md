# Runbook — rotación de secretos

- **Objetivo:** cambiar credenciales sin filtrarlas, sin dejar el sistema sin servicio y dejando evidencia.
- **Regla de oro:** si un secreto pudo filtrarse, se considera comprometido y se rota **antes** de investigar el alcance.

## 1. Inventario de secretos

| Secreto | Dónde vive | Consumidor | Estado C1 |
| --- | --- | --- | --- |
| `POSTGRES_PASSWORD` | `infra/compose/.env` | Superusuario local de PostgreSQL | Local, no versionado |
| `CCLTPG_MIGRATOR_PASSWORD` | `infra/compose/.env` y `.env` | Migrador Kysely | Local, no versionado |
| `CCLTPG_APP_PASSWORD` | `infra/compose/.env` y `.env` | API (rol `ccltpg_app`) | Local, no versionado |
| `CCLTPG_READONLY_PASSWORD` | `infra/compose/.env` y `.env` | Consultas de solo lectura | Local, no versionado |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `infra/compose/.env` | MinIO local | Local, no versionado |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `.env` | Sesiones (C2) | Placeholder; sin uso real en C1 |
| Secretos de CI | GitHub Actions Secrets | Pipeline | Se definen al conectar el repositorio |

Ningún valor real se escribe en `.env.example`, documentación, pruebas ni artefactos generados.

## 2. Antes de rotar

1. Identificar el secreto y todos sus consumidores.
2. Confirmar el entorno: local, CI o compartido.
3. Programar la ventana si la rotación exige reinicio.
4. Tener a mano el procedimiento de reversión: la contraseña anterior se conserva en un gestor de secretos hasta confirmar que todo funciona.
5. Nunca pegar el secreto en un chat, issue, log o captura.

## 3. Rotar contraseñas de roles de PostgreSQL

### 3.1 Generar la nueva contraseña

Usar un generador criptográfico y una longitud mínima de 24 caracteres:

```bash
openssl rand -base64 32
```

No reutilizar contraseñas entre roles ni entre entornos.

### 3.2 Cambiar la contraseña en PostgreSQL

Conectado como superusuario o como el rol dueño:

```sql
ALTER ROLE ccltpg_app WITH PASSWORD 'nueva_contraseña';
```

Repetir para `ccltpg_migrator` o `ccltpg_readonly` según corresponda.

Verificar que los roles siguen sin privilegios elevados:

```sql
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles
WHERE rolname LIKE 'ccltpg_%';
```

### 3.3 Actualizar consumidores

1. Actualizar `infra/compose/.env` (si aplica) y `.env` con la nueva contraseña.
2. Actualizar el secreto de CI si el pipeline usa esa credencial.
3. Reiniciar la API para que el pool de conexiones use la nueva contraseña.
4. Si hace falta cortar conexiones antiguas:

   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE usename = 'ccltpg_app' AND pid <> pg_backend_pid();
   ```

### 3.4 Verificar

```bash
curl -s http://localhost:3000/api/v1/health/ready
pnpm migrate:status
```

- `ready` debe responder `200`.
- `migrate:status` debe conectar con el rol migrador.
- Las pruebas de integración deben seguir verdes:

  ```bash
  pnpm test:integration
  ```

### 3.5 Reversión

Si algo falla, restaurar la contraseña anterior con `ALTER ROLE` y los archivos `.env` desde el gestor de secretos. No dejar dos contraseñas válidas de forma permanente.

## 4. Rotar credenciales de MinIO

1. Crear un usuario/credencial nuevo con los permisos mínimos necesarios.
2. Actualizar `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` o la credencial de aplicación en `.env`.
3. Reiniciar MinIO y `minio-init` (o ejecutar la inicialización del bucket).
4. Verificar lectura/escritura en el bucket y que el acceso anónimo sigue deshabilitado.
5. Revocar la credencial anterior.

En C1 MinIO solo se usa en desarrollo; el bucket y las credenciales de producción se definen en C5/C8.

## 5. Rotar secretos de sesión (C2)

Aunque en C1 no hay autenticación real, el procedimiento queda preparado:

1. Generar un nuevo par de secretos de acceso/refresh.
2. Desplegar con **clave nueva y anterior** durante la transición (rotación con `kid`).
3. Invalidar sesiones y familias de refresh emitidas con la clave anterior cuando el diseño lo permita.
4. Auditar `sesion.revocada`/eventos equivalentes.
5. Retirar la clave anterior tras el periodo de gracia.

Nunca se rota solo el secreto de refresh sin invalidar las familias: un refresh válido con secreto antiguo podría seguir emitiendo tokens.

## 6. Rotar secretos de CI

1. Crear el nuevo valor en el proveedor correspondiente.
2. Actualizar el secreto en GitHub:

   ```bash
   gh secret set NOMBRE_DEL_SECRETO
   ```

3. Ejecutar el pipeline y confirmar los jobs de contrato, integración y seguridad.
4. Revocar el valor anterior en el proveedor.
5. Revisar los logs del pipeline para confirmar que el valor no aparece.

Los secretos de CI nunca se imprimen con `echo`, `env` ni `set -x`.

## 7. Si el secreto se filtró

1. **Rotar inmediatamente**, antes de cualquier otra acción.
2. Revocar sesiones/tokens emitidos con el secreto comprometido.
3. Revisar accesos y logs del periodo expuesto.
4. Abrir el [runbook de incidente de seguridad](incidente-seguridad.md).
5. No confiar en borrar el commit: si el secreto llegó a un remoto, se considera público. La limpieza del historial es complementaria, no sustitutiva.

## 8. Verificación periódica

```bash
pnpm security:secrets
pnpm test:security
```

- El escáner propio revisa archivos versionados y descarta placeholders.
- Gitleaks revisa el historial en CI.
- `pnpm audit --prod --audit-level critical` cubre dependencias.

Cadencia recomendada:

| Entorno | Rotación |
| --- | --- |
| Local | Al cambiar de equipo o ante sospecha |
| CI | Cada 90 días o ante cambio de responsable |
| Producción | Cada 90 días; inmediata ante incidente |

## 9. Registro

Cada rotación debe dejar constancia de:

- Fecha y responsable.
- Secreto rotado (nombre, nunca valor).
- Sistemas actualizados.
- Verificación realizada.
- Incidencias y reversiones.
