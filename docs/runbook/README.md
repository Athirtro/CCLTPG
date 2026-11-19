# Runbooks de operación — CCLTPG

- **Ámbito:** Iteraciones 1 y 2 (esqueleto caminante; identidad, RBAC y auditoría). Los procedimientos de academia y archivos se amplían en C3/C4.
- **Responsable:** Rol B — seguridad, identidad y operación.
- **Regla:** ningún procedimiento de este directorio sustituye una decisión de equipo. Las decisiones pendientes se registran en `docs/tasks/rol-b/rol-b-it2-registro.md`.

| Runbook | Cuándo usarlo |
| --- | --- |
| [Arranque local](arranque-local.md) | Un tercero clona el repositorio y necesita levantar API, SPA e infraestructura. |
| [Migraciones y reversión](migraciones.md) | Hay que aplicar, inspeccionar o revertir migraciones de esquema. |
| [Operación y diagnóstico](operacion.md) | La API responde mal, hay que leer salud, métricas, logs o trazas. |
| [Rotación de secretos](rotacion-secretos.md) | Se cambia una contraseña, token o credencial de CI. |
| [Incidente de seguridad](incidente-seguridad.md) | Se sospecha exposición de secretos, acceso no autorizado o fuga de datos. |
| [Reset de MFA](reset-mfa.md) | Una persona perdió el dispositivo TOTP o los códigos de recuperación. |
| [Revocación de sesiones](revocacion-sesiones.md) | Hay que cortar una sesión, una familia o todas las sesiones de una cuenta. |
| [Cambio de contraseña forzado](cambio-password-forzado.md) | Primer acceso, credencial comprometida o reset administrativo. |

## Estado de verificación

- Los comandos de API, contrato, arquitectura, seguridad HTTP y pruebas se ejecutaron en la máquina de desarrollo con Node 22.19.0 y pnpm 9.15.4.
- La integración con PostgreSQL se verificó contra un PostgreSQL 16 real embebido en el puerto 55432.
- **Docker Desktop está instalado, pero el host Windows no autentica contra el contenedor Compose (`28P01`) y MinIO no es descargable (`quay.io` responde 401).** Los pasos de `docker compose` están escritos y el archivo Compose valida como YAML, pero su ejecución queda pendiente. Ver la deuda registrada en `docs/reviews/c2/rol-b.md`.
- Los runbooks de identidad se apoyan en los endpoints reales de C2 y en consultas de solo lectura para verificar el estado; el break-glass solo se usa si la API no está disponible y exige ticket aprobado.

## Convenciones

- Nunca se versionan archivos `.env` ni credenciales reales.
- Los ejemplos usan `change_me_local_only`; cualquier valor distinto debe vivir en `.env` local o en secretos de CI.
- Los comandos se ejecutan desde la raíz del repositorio salvo que se indique otra cosa.
