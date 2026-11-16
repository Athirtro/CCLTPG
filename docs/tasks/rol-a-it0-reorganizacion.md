# Registro de tarea — Reorganización documental (Iteración 0)

- **Fecha:** 2026-11-15
- **Iteración / compuerta:** Iteración 0 (preparación documental) / Compuerta 0
- **Responsable:** Rol A (backend, dominio y datos)
- **Estado:** Completada (pendiente de confirmación final del equipo sobre ubicación de `reviews/`)

## Objetivo
Reorganizar la documentación del repositorio para alinearla con la estructura descrita en el capítulo 6.1 del documento de diseño, sin renombrar archivos ni cambiar su contenido sustantivo, y dejar preparada la base documental de la Iteración 0.

## Qué cambió
- **Directorios creados:** `docs/`, `docs/requirements/`, `docs/contratos/`, `docs/tasks/`, `docs/adr/`, `docs/reviews/`.
- **Archivos movidos (nombres conservados):**
  - `diseño-arquitectonico.md` → `docs/diseno-arquitectonico.md`
  - `vision-alcance.md` → `docs/vision-alcance.md`
  - `readme.md` conservado en la raíz.
- **Enlaces/referencias de ruta actualizados (sin cambios de contenido normativo):**
  - `readme.md`: tabla de documentación y documentación de apoyo actualizadas para incluir `docs/contratos/` y usar `docs/reviews/`; árbol de estructura del repositorio actualizado para reflejar `docs/contratos/` y `docs/reviews/`, con nota sobre la diferencia respecto a `reviews/` en raíz (cap. 6.1).
  - `docs/vision-alcance.md`: referencia del diagrama actualizada de `media/images/diagrama1.png` a `../media/images/diagrama1.png` para mantener validez desde `docs/`.
- **Archivos creados:**
  - `docs/open-questions.md` (registro inicial de preguntas abiertas, incluyendo ubicación de `reviews/`, decisiones de permisos/contratos y `.gitignore`).
  - `docs/assumptions.md` (supuestos explícitos extraídos de visión/diseño y supuestos provisionales de trabajo).
  - `.gitignore` con exclusión de artefactos/instrucciones locales de herramientas de agentes (propuesta aplicada) y sin excluir entregables documentales del proyecto.
  - `docs/tasks/rol-a-it0-reorganizacion.md` (este registro).

## Por qué
- Cumplir la instrucción de reorganización documental previa a la Iteración 0, centralizando la documentación en `docs/` y preparando carpetas requeridas (`requirements`, `contratos`, `tasks`, `adr`, `reviews`) y registros (`open-questions.md`, `assumptions.md`).
- Facilitar trazabilidad y revisión por compuertas, manteniendo coherencia de enlaces tras el movimiento de archivos.

## Qué no se hizo
- No se renombraron archivos ni se modificó el contenido normativo de los documentos de visión y diseño.
- No se creó `apps/`, `packages/` ni `infra/` (corresponden a Iteración 1/código).
- No se creó carpeta `reviews/` en la raíz; se adoptó `docs/reviews/` y se registró la decisión como pregunta abierta (PA-001).
- No se movió `media/`.
- No se generaron ni modificaron artefactos de código, migraciones ni contratos ejecutables; las propuestas de permisos/contratos se documentan por separado como pendientes de aprobación.

## Pendiente / seguimiento
- Confirmación del equipo sobre ubicación definitiva de paquetes de revisión (`docs/reviews/` vs `reviews/` raíz).
- Confirmación/ajuste de patrones de `.gitignore` para archivos de agentes (PA-008).
- Completar entregables de Iteración 0 (Rol A): `docs/diccionario-datos.md` y `docs/tasks/rol-a-it0-revision-modelo.md`.
- Registrar y formalizar propuestas de gramática/catálogo de permisos y contratos API v1 en `docs/contratos/` como pendientes de aprobación (Compuerta 0).

## Evidencia
- Estructura actual: `docs/{requirements,contratos,tasks,adr,reviews}/`, `docs/open-questions.md`, `docs/assumptions.md`, `docs/diseno-arquitectonico.md`, `docs/vision-alcance.md`.
- Cambios de rutas verificados en `readme.md` y `docs/vision-alcance.md`.
- Estado de control de versiones: movimientos registrados como renombres en git.
