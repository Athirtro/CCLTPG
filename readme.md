# CCLTPG — Plataforma de Gestión del Centro Cultural Lucy Tejada

*Archivo: `README.md` — Versión 1.0*

---

## Descripción

**CCLTPG** es la plataforma web de gestión académica y administrativa del **Centro Cultural Lucy Tejada**, institución cultural adscrita a la Alcaldía de Pereira, Colombia. Centraliza el registro de estudiantes, la inscripción en programas formativos, el control de asistencia, la evaluación cualitativa, la generación de reportes y la visualización de métricas mediante dashboards interactivos, sustituyendo la dependencia de la plataforma externa de la Alcaldía y de los registros manuales.

El proyecto se ejecuta en tres releases: **1.0** (autenticación, gestión de estudiantes, inscripción, consulta académica y asistencia), **2.0** (reportes, dashboards y notificaciones) y **3.0** (accesibilidad, responsividad y compatibilidad extendida).

## Documentación del proyecto

La documentación se organiza en tres documentos complementarios:

| Documento | Ruta | Propósito |
| --- | --- | --- |
| README | `README.md` | Introducción general al proyecto, estado, equipo y guía de inicio |
| Visión y Alcance | `docs/vision-y-alcance.md` | Justificación del proyecto: problema de negocio, objetivos, características, alcance por releases, involucrados y entorno de operación |
| Diseño Arquitectónico | `docs/diseno-arquitectonico.md` | Planificación estructurada del desarrollo: estilo arquitectónico, decisiones tecnológicas, modelo de datos, permisos, contratos, requisitos no funcionales, pruebas y plan de iteraciones con compuertas de revisión |

Documentación de apoyo generada durante el proyecto:

- `docs/requirements/` — catálogo de requisitos con criterios de aceptación.
- `docs/adr/` — registros de decisión arquitectónica.
- `docs/tasks/` — registro de tareas por iteración.
- `docs/open-questions.md` y `docs/assumptions.md` — preguntas abiertas y supuestos registrados.
- `reviews/` — paquetes de revisión entregados en cada compuerta.

## Estado del proyecto

| Fase | Estado |
| --- | --- |
| Documento de Visión y Alcance | Aprobado (v1.0) |
| Documento de Diseño Arquitectónico | Aprobado (v1.0) |
| Iteración 0 — Cierre de especificación | Pendiente de inicio |
| Release 1.0 | Planificado |
| Release 2.0 | Planificado |
| Release 3.0 | Planificado |

## Equipo

| Rol | Integrante |
| --- | --- |
| Desarrollo | Kevin E. Cardona |
| Desarrollo | David J. T. Osorio |
| Desarrollo | Esteban G. Jiménez |

## Arquitectura en breve

Monolito modular con contextos delimitados (Académico, Identidad y Acceso, Auditoría, Archivos, Notificaciones, Exportaciones, Analítica) sobre **TypeScript**:

- **Backend:** NestJS, PostgreSQL 16, Kysely para acceso a datos y migraciones reversibles, Redis y BullMQ para trabajos en segundo plano.
- **Frontend:** React + Vite + TypeScript, MUI, cliente de API generado desde OpenAPI.
- **Calidad:** Vitest, Supertest, Testcontainers, Playwright, k6 y verificación de accesibilidad con `axe`.
- **Operación:** Docker, GitHub Actions, observabilidad con OpenTelemetry y métricas Prometheus.

Los detalles, las justificaciones y las reglas de dependencia están en el Documento de Diseño Arquitectónico.

## Estructura del repositorio

```
/
  apps/
    api/            # Backend NestJS
    web/            # SPA React
  packages/
    contracts/      # Tipos y esquemas generados desde OpenAPI
    config/         # Configuración común de lint, TypeScript y pruebas
  infra/
    compose/        # Docker Compose de desarrollo
    deploy/         # Despliegue y runbooks
  docs/
    requirements/   # Catálogo de requisitos
    adr/            # Decisiones arquitectónicas
    tasks/          # Registro de tareas
  reviews/          # Paquetes de revisión por compuerta
```

## Puesta en marcha (desarrollo)

Requisitos: Node.js LTS, pnpm, Docker y Docker Compose.

1. Clonar el repositorio.
2. Copiar el archivo de variables de entorno de ejemplo y completar los valores locales.
3. Ejecutar el comando único de arranque definido en el repositorio, que levanta PostgreSQL, Redis, el almacén de objetos, aplica migraciones, carga datos semilla e inicia la API y la SPA.
4. Verificar el estado del sistema mediante el endpoint de salud de la API y la página de salud de la SPA.

El comando exacto y los detalles del entorno se documentan en `infra/compose/` y en el Documento de Diseño Arquitectónico (capítulo 16).

## Flujo de trabajo

- El desarrollo se organiza en **iteraciones** con entregables acotados y **compuertas de revisión** obligatorias.
- Cada iteración se desarrolla en una rama `iter/N-nombre` y se integra a `main` solo tras la aprobación humana de su compuerta.
- Cada compuerta produce un **paquete de revisión** con alcance entregado, decisiones, supuestos, preguntas abiertas, informe de pruebas, guion de demostración, diferencias de esquema y API, deuda técnica y autoevaluación de calidad.
- Los artefactos congelados en una compuerta solo se modifican mediante una solicitud de cambio aprobada.
- La planificación completa, los criterios de terminado y la lista de verificación de calidad están en el Documento de Diseño Arquitectónico.

## Cómo contribuir

- Respetar las convenciones de nombres, el formato de errores y el versionado de API descritos en el Documento de Diseño Arquitectónico.
- Toda regla de negocio implementada debe estar trazada a un requisito del catálogo o a un supuesto registrado.
- No se aceptan funcionalidades fuera del alcance aprobado: las propuestas se registran y se evalúan por separado.
- No se desactivan pruebas, no se relajan reglas de lint ni se debilita la seguridad para hacer pasar un cambio.
- No se incorpora lógica de pagos, contabilidad, nómina ni inventario.

## Limitaciones conocidas

- Plataforma exclusivamente web; no contempla aplicaciones nativas para Android o iOS.
- Sin integración automática con la plataforma de la Alcaldía de Pereira.
- Los objetivos de disponibilidad, respaldo y recuperación dependen de la infraestructura y los servicios de alojamiento disponibles para el centro.
- El sistema no reemplaza las decisiones académicas o administrativas del personal del centro.

## Contacto

Líder de proyecto y equipo de desarrollo: ver sección **Equipo**. Para consultas institucionales, dirigirse a la dirección del Centro Cultural Lucy Tejada.
