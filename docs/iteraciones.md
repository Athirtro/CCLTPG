# Resumen de iteraciones — CCLTPG

- **Fecha:** 22 de noviembre de 2026
- **Responsable:** Rol B (seguridad, identidad y operación) — y en adelante el equipo en conjunto.
- **Alcance:** visión general de las iteraciones del desarrollo, según `docs/diseno-arquitectonico.md` (§18) y `docs/requirements/seguridad.md`.

## 1. Cómo se organiza el trabajo por iteraciones

Cada iteración es una **compuerta de revisión humana obligatoria**. El equipo se detiene, produce un paquete de revisión en `docs/reviews/<compuerta>/rol-b.md` y espera aprobación explícita antes de continuar.

Regla de bloqueo: si un criterio de la compuerta no tiene evidencia, la compuerta **no se aprueba**, aunque el código funcione.

## 2. Resumen de iteraciones

| # | Iteración | Release | Foco / riesgo principal | Compuerta | Estado actual |
| --- | --- | --- | --- | --- | --- |
| 0 | Cierre de especificación | — | Suposiciones sobre reglas y modelo de datos | C0 | Cerrada con 5 condiciones P0 abiertas pendientes de resolver |
| 1 | **Esqueleto caminante** | 1.0 | Errores de herramientas y estructura | C1 | **Completada con límites de evidencia** (ver `docs/reviews/c1/rol-b.md`) |
| 2 | **Identidad, RBAC y auditoría** | 1.0 | Fallos de seguridad | C2 | **Ejecutada con límites de evidencia** (ver `docs/reviews/c2/rol-b.md`) |
| 3 | Archivos, notificaciones y exportaciones | 1.0 | Contratos compartidos inestables | C3 | **Ejecutada con límites de evidencia** (ver `docs/reviews/c3/rol-b.md`) |
| 4 | Académico A: programas, grupos, estudiantes, matrícula | 1.0 | Patrón de módulo equivocado | C4 | **Ejecutada con deuda registrada** (publicada en `a5444c8`; ver `docs/reviews/c4/rol-b.md`) |
| 5 | Académico B: asistencia, evaluación + endurecimiento | 1.0 | Rendimiento, respaldos, regresiones | C5 | **Ejecutada con deuda registrada** (publicada en `iteracion 5 b`; ver `docs/reviews/c5/rol-b.md`) |
| 6 | Reportes, dashboards y notificaciones | 2.0 | KPIs y reportes incorrectos | C6 | **Ejecutada con deuda registrada** (publicada en `0ecbe32` (`iteracion 6 b`); ver `docs/reviews/c6/rol-b.md`) |
| 7 | Accesibilidad y responsividad | 3.0 | Brechas de accesibilidad | C7 | **Rol B ejecutado; compuerta abierta, sin firmar ni publicar** (ver `docs/tasks/rol-b/rol-b-it7-plan.md`) |
| 8 | Endurecimiento y aceptación final | 3.0 | Brechas no funcionales y de cumplimiento | C8 | **Rol B ejecutado; compuerta abierta, sin firmar ni publicar** (ver `docs/tasks/rol-b/rol-b-it8-plan.md`) |

## 3. Contenido de cada iteración

### Iteración 0 — Cierre de especificación (sin código)

- Catálogo de requisitos con criterios de aceptación verificables (CAR-01…CAR-12).
- Registro de decisiones tecnológicas (ADR-0001…ADR-0004).
- Reglas de repositorio, convenciones y estructura.
- Modelo de permisos unificado, modelo de datos v1, máquinas de estado, reglas de negocio, catálogo de notificaciones/reportes/KPIs, mecanismo de auditoría y solo inserción, traducción de requisitos no funcionales.
- **Compuerta C0:** todo requisito tiene criterio de aceptación o una pregunta abierta con responsable y valor por defecto.

### Iteración 1 — Esqueleto caminante (completada)

- Monorepo, entorno, pipeline CI completo, migraciones por esquema, esqueletos de API y SPA, pruebas de arquitectura.
- Criterio de salida C1: clonar, ejecutar, CI en verde; arquitectura falla con violación deliberada.
- **Cierre parcialmente limitado por:** Docker ausente y CI de GitHub aún no ejecutado en el servicio.

### Iteración 2 — Identidad, RBAC y auditoría (ejecutada)

- Migraciones del núcleo, autenticación con MFA y refresh rotativo, motor de permisos con denegación por defecto, auditoría inmutable, ciclo de vida de identidades temporales, datos semilla e interfaz mínima de administración.
- Compuerta C2: intentos de escalada de privilegios; rutas sin decorador rechazadas por prueba; auditoría inalterable.
- **Decisiones aplicadas:** D41…D48 (Argon2id, JWT, refresh, cookies, CSRF, bloqueo, política de contraseña, MFA, throttling, cifrado y errores), con ratificación formal pendiente.
- **Evidencia:** 129 pruebas unitarias de API, 24 de integración contra PostgreSQL 16 real, 11 de contrato, 3 de arquitectura y 6 del escáner de secretos; `arch:check` sin violaciones.
- **Límites:** Docker/MinIO no ejecutables en esta máquina, CI de GitHub pendiente, acta C0/C1 pendiente y ratificaciones de R-030, dependencias, catálogo y semántica de AC-SEC-01/22 por firmar.

### Iteración 3 — Archivos, notificaciones y exportaciones (ejecutada)

- Carga con lista blanca, límite de 10 MB, verificación por bytes mágicos, nombre saneado, deduplicación por hash, escaneo y cuarentena; descarga siempre por la API, con permiso global o propio y auditoría antes de responder.
- Outbox transaccional, trabajador con `FOR UPDATE SKIP LOCKED`, plantillas versionadas, preferencias, canales `app`/`email` detrás de puertos, bandeja propia y críticas no silenciables.
- Exportaciones con plantillas en código, entrada JSON saneada, salidas PDF/XLSX/CSV, límites de filas y tamaño, registro como archivo y auditoría `reporte.generado`.
- Idempotencia obligatoria en `POST /files` y `POST /exports` con `Idempotency-Key`, conflicto 409 y TTL de 24 h.
- **Decisiones aplicadas:** D49…D58 (almacenamiento por puerto, carga endurecida, antimalware stub, descarga por API, outbox, correo stub, plantillas, idempotencia y contrato), con ratificación formal pendiente.
- **Evidencia:** 245 pruebas unitarias de API, 31 de integración contra PostgreSQL 16 real, 11 de contrato, 3 de arquitectura y 6 del escáner de secretos; contrato con 24 operaciones, 4 rutas públicas y 61 eventos; `arch:check` sin violaciones.
- **Límites:** MinIO no ejecutable (se usa adaptador local), antimalware y correo son stubs, CI de GitHub pendiente, apertura manual de PDF/XLSX pendiente, acta C0/C1 pendiente y ratificaciones de R-009/R-020/R-029/R-032/R-033 y dependencias por firmar.

### Iteraciones 4 a 8

- Se suceden por dominios: académico A, académico B + Release 1.0, reportes/dashboards, accesibilidad, endurecimiento/aceptación final.
- **Iteración 4:** académico A (programas, grupos, estudiantes y matrícula) sobre el patrón de módulo ya validado en C3.
- **Iteración 5:** académico B (sesiones, asistencia y evaluación) y Release 1.0; académico B verificado y publicado, con endurecimiento/carga pendientes de entorno.
- **Iteración 6:** reportes, KPIs y notificaciones académicas (Release 2.0), con verificación manual contra datos crudos; código verificado y publicado, con demo de Rol C y evidencia externa pendientes.

## 4. Partes importantes por iteración

| Iteración | Partes importantes | Notas de deriva |
| --- | --- | --- |
| 0 | Requisitos, ADRs, catálogos, modelo de datos/permisos/auditoría. | Condiciones P0 de C0 pendientes. |
| 1 | Infraestructura, CI, migraciones, contratos de salud, observabilidad, seguridad HTTP base. | Docker y CI en ejecución pendientes. |
| 2 | Autenticación, RBAC, auditoría, cifrado, tokens, MFA, throttling. | Riesgo alto; congelamiento de contratos de auth/RBAC/auditoría. |
| 3 | Archivos, notificaciones, exportaciones. | Congelar contratos de esos servicios. |
| 4 | Académico A: patrón de módulo. | Si el patrón falla, se corrige aquí (no se replica). |
| 5 | Académico B + Release 1.0: endurecimiento, backup/restauración, carga. | Etiqueta `release-1.0-rc`. |
| 6 | Reportes, dashboards, notificaciones (Release 2.0). | Verificación manual contra datos crudos (`docs/reviews/c6/verificacion-reportes-kpis.md`); cliente Rol C pendiente. |
| 7 | Accesibilidad (Release 3.0). | WCAG 2.1 AA. |
| 8 | Endurecimiento final, aceptación, trazabilidad requisito-código-prueba. | Aceptación final y etiqueta `release-3.0`. |

## 5. Estado consolidado de compuertas

| Compuerta | Criterio esencial | Evidencia | Estado |
| --- | --- | --- | --- |
| C0 | Requisitos con criterios; decisiones cerradas. | `docs/reviews/c0/*` | Con 5 condiciones P0 abiertas |
| C1 | Montaje limpio, CI, arquitectura, contratos, migraciones/roles, seguridad base. | `docs/reviews/c1/rol-b.md` | **Cerrada en código; pendiente CI en GitHub y Docker** |
| C2 | Seguridad de autenticación/RBAC/auditoría. | `docs/reviews/c2/rol-b.md` | **Ejecutada en código; pendiente firma, Docker/MinIO, CI en GitHub y acta C0/C1** |
| C3 | Contratos de archivos/notificaciones/exportaciones. | `docs/reviews/c3/rol-b.md` | **Ejecutada en código; pendiente firma, MinIO, CI en GitHub, apertura manual de PDF/XLSX y acta C0/C1** |
| C4 | Patrón académico y caso de uso. | `docs/reviews/c4/rol-b.md` | **Ejecutada con deuda registrada** (publicada en `a5444c8`); firma pendiente |
| C5 | Académico B, endurecimiento, carga y backup. | `docs/reviews/c5/rol-b.md` | **Ejecutada con deuda registrada** (publicada en `iteracion 5 b`); firma, entorno y RB1-43 pendientes |
| C6 | Reportes/KPIs y notificaciones. | `docs/reviews/c6/rol-b.md` | **Ejecutada con deuda registrada** (publicada en `0ecbe32` (`iteracion 6 b`)); firma, Rol C y entorno pendientes |
| C7 | Accesibilidad. | `docs/tasks/rol-b/rol-b-it7-plan.md` | **Rol B ejecutado; compuerta abierta, sin firmar ni publicar** |
| C8 | Aceptación final. | `docs/tasks/rol-b/rol-b-it8-plan.md` | **Rol B ejecutado; compuerta abierta, sin firmar ni publicar** |

## 6. Puntos críticos que aparecen en cada iteración

1. Ninguna iteración se considera aprobada sin evidencia enlazada en `docs/reviews/`.
2. Ningún artefacto congelado se modifica sin solicitud de cambio aprobada.
3. Ninguna garantía nueva se implementa sin test (anti-deriva).
4. Las decisiones pendientes se registran en el plan de la iteración correspondiente.

## 7. Fuentes

- `docs/diseno-arquitectonico.md` (§18, §19).
- `docs/requirements/seguridad.md`.
- `docs/tasks/rol-b/rol-b-it1-plan.md`, `docs/tasks/rol-b/rol-b-it2-plan.md`, `docs/tasks/rol-b/rol-b-it3-plan.md`.
- `docs/tasks/rol-b/rol-b-it2-registro.md`, `docs/tasks/rol-b/rol-b-it3-registro.md`.
- `docs/tasks/rol-b/rol-b-it5-plan.md`, `docs/tasks/rol-b/rol-b-it5-registro.md`, `docs/tasks/rol-b/rol-b-it6-plan.md`, `docs/tasks/rol-b/rol-b-it8-plan.md`.
- `docs/reviews/c1/rol-b.md`, `docs/reviews/c2/rol-b.md`, `docs/reviews/c3/rol-b.md`, `docs/reviews/c5/rol-b.md`.
- `docs/open-questions.md`, `docs/assumptions.md`.
