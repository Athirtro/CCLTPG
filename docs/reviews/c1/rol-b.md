# Paquete de revisión — Compuerta 1 (Rol B) — esqueleto

- **Rol:** B — Seguridad, identidad y operación
- **Compuerta:** C1 — Esqueleto caminante
- **Estado:** **Pendiente de ejecución.** Este documento es la plantilla que se completa al cerrar C1; no contiene evidencia todavía.
- **Plan asociado:** `docs/tasks/rol-b/rol-b-it1-plan.md`
- **Regla:** no se marca ningún criterio como cumplido sin evidencia enlazada.

## 1. Alcance entregado frente al planificado

| Tarea | Entregable | Estado | Evidencia |
| --- | --- | --- | --- |
| RB1-01 | Monorepo y toolchain | Pendiente | — |
| RB1-02 | Compose con PostgreSQL, Redis y MinIO | Pendiente | — |
| RB1-03 | Migrador y esquemas | Pendiente | — |
| RB1-04 | Roles y privilegios | Pendiente | — |
| RB1-05 | Bootstrap backend y salud | Pendiente | — |
| RB1-06 | Bootstrap frontend | Pendiente | — |
| RB1-07 | Pipeline OpenAPI | Pendiente | — |
| RB1-08 | Validador de contrato y eventos | Pendiente | — |
| RB1-09 | Pipeline CI | Pendiente | — |
| RB1-10 | Pruebas de arquitectura | Pendiente | — |
| RB1-11 | Línea base HTTP | Pendiente | — |
| RB1-12 | Secretos y escaneo | Pendiente | — |
| RB1-13 | Observabilidad mínima | Pendiente | — |
| RB1-14 | Documentación y este paquete | Pendiente | — |

## 2. Decisiones y supuestos con reversibilidad

Completar con las decisiones D27…D40 de `rol-b-it1-plan.md` §5 y su elección final.

| Decisión | Elección | Reversibilidad | Consecuencia |
| --- | --- | --- | --- |
| D27…D40 | Pendiente | — | — |

## 3. Preguntas abiertas

- Pendiente: enlazar PA-001…PA-017 y las nuevas que surjan en C1.

## 4. Informe de pruebas y matriz

| Prueba | Comando | Resultado |
| --- | --- | --- |
| Lint y typecheck | Pendiente | — |
| Unitarias | Pendiente | — |
| Integración (Testcontainers) | Pendiente | — |
| Arquitectura (violación deliberada) | Pendiente | — |
| Contrato (`x-*` y eventos) | Pendiente | — |
| SCA y secretos | Pendiente | — |
| Migraciones `up/down/up` | Pendiente | — |

## 5. Guion de demostración reproducible

1. Clonar el repositorio.
2. Copiar `.env.example` a `.env` y completar valores locales.
3. Ejecutar el comando único de arranque.
4. Verificar `/api/v1/health/ready` y la página de salud de la SPA.
5. Ejecutar la suite y mostrar el pipeline en verde.
6. Introducir una violación de arquitectura y mostrar que la prueba falla.

## 6. Diferencias (tablas, rutas, permisos, migraciones, dependencias)

Pendiente de completar con el diff real de C1.

## 7. Defectos y deuda técnica

Pendiente.

## 8. Autoevaluación anti-deriva (diseño §19.2)

Responder las 12 preguntas al cierre de C1.

## 9. Solicitud de firma

| Firmante | Qué aprueba | Estado |
| --- | --- | --- |
| Rol B | Línea base de seguridad, CI y migraciones de C1 | ☐ Pendiente |
| Equipo | Compuerta 1 y autorización de C2 | ☐ Pendiente |
