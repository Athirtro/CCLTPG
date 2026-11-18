# Runbooks de operación — CCLTPG

- **Ámbito:** Iteración 1 (esqueleto caminante). Los procedimientos de identidad, RBAC y auditoría funcional se amplían en C2.
- **Responsable:** Rol B — seguridad, identidad y operación.
- **Regla:** ningún procedimiento de este directorio sustituye una decisión de equipo. Las decisiones pendientes se registran en `docs/tasks/rol-b/rol-b-it1-registro.md`.

| Runbook | Cuándo usarlo |
| --- | --- |
| [Arranque local](arranque-local.md) | Un tercero clona el repositorio y necesita levantar API, SPA e infraestructura. |
| [Migraciones y reversión](migraciones.md) | Hay que aplicar, inspeccionar o revertir migraciones de esquema. |
| [Operación y diagnóstico](operacion.md) | La API responde mal, hay que leer salud, métricas, logs o trazas. |
| [Rotación de secretos](rotacion-secretos.md) | Se cambia una contraseña, token o credencial de CI. |
| [Incidente de seguridad](incidente-seguridad.md) | Se sospecha exposición de secretos, acceso no autorizado o fuga de datos. |

## Estado de verificación

- Los comandos de API, contrato, arquitectura, seguridad HTTP y pruebas se ejecutaron en la máquina de desarrollo con Node 22.19.0 y pnpm 9.15.4.
- La integración con PostgreSQL se verificó contra un PostgreSQL 16 real embebido en el puerto 55432.
- **Docker no está instalado en la máquina de desarrollo actual.** Los pasos de `docker compose` están escritos y el archivo Compose valida como YAML, pero su ejecución queda pendiente. Ver la deuda registrada en `docs/reviews/c1/rol-b.md`.

## Convenciones

- Nunca se versionan archivos `.env` ni credenciales reales.
- Los ejemplos usan `change_me_local_only`; cualquier valor distinto debe vivir en `.env` local o en secretos de CI.
- Los comandos se ejecutan desde la raíz del repositorio salvo que se indique otra cosa.
