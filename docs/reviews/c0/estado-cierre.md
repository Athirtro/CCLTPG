# Estado de cierre — Compuerta 0

- **Fecha:** 2026-11-16
- **Propósito:** tablero único de qué está entregado, qué falta y quién lo desbloquea para dar por cerrada la Iteración 0.
- **Fuente normativa:** diseño cap. 18.2 (entregables de Iteración 0), cap. 18.3 (congelamiento), cap. 19.4 (paquete de revisión) y criterio de Compuerta 0: *todo requisito tiene criterio de aceptación o una pregunta abierta con responsable y valor por defecto*.
- **Regla:** este documento no aprueba nada. Marca el estado real para que el equipo firme o rechace con información completa.

## 1. Semáforo global

| Dimensión | Estado | Comentario |
| --- | --- | --- |
| Seguridad, identidad y auditoría (Rol B) | 🟢 Entregado con reservas | 9 artefactos, 48 operaciones, 59 eventos, 46 controles, 48 criterios |
| Modelo de datos y diccionario (Rol A) | 🟡 Existe, requiere actualización | RC-A-01…04 bloquean el congelamiento |
| Catálogo de permisos y OpenAPI (Rol C) | 🟡 Existe, requiere actualización | RC-C-01…04 bloquean el congelamiento |
| Catálogo de requisitos funcionales | 🟡 Cubierto con PA-017 | CAR-07/12 formales; CAR-01…05/09 en PA-017; CAR-06/08/11 con meta medible |
| Decisiones del equipo | 🔴 Pendientes | PA-006, PA-017, R-018…R-031 y ADR sin ratificar |
| Paquete de revisión C0 | 🟡 Emitido | `docs/reviews/c0/rol-b.md` listo; faltan respuestas de A/C y acta |

**Conclusión:** la Iteración 0 **no está cerrada**. Está en estado “lista para revisión”: el trabajo de Rol B terminó, pero el cierre depende de tres acciones ajenas a Rol B (Rol A, Rol C y ratificación del equipo), incluida la decisión sobre PA-017.

## 2. Entregables de Iteración 0 (diseño §18.2)

| # | Entregable | Estado | Evidencia / vacío | Dueño | Acción para cerrar |
| --- | --- | --- | --- | --- | --- |
| 1 | Catálogo de requisitos con criterios verificables | 🟡 **Cubierto con PA-017** | CAR-07/CAR-12 en `seguridad.md`; CAR-01…05 y CAR-09 en PA-017; CAR-06/08/11 con meta medible en el diseño cap. 14 | Rol A / Rol C | Ratificar PA-017 o crear el catálogo formal |
| 2 | Registro de decisiones tecnológicas | 🟢 Cumplido | Diseño cap. 5 (aprobado v1.0) | Equipo | Ratificar en el acta |
| 3 | Reglas de repositorio y convenciones | 🟡 Cumplido con PAs | Diseño cap. 6, `readme.md`, `.gitignore`; PA-001/PA-008 pendientes de confirmación | Equipo | Confirmar PA-001 y PA-008 |
| 4 | Modelo de permisos unificado | 🟡 Propuesta | `gramatica-y-catalogo-permisos-v1.md` + R-001/R-002 + PA-006 | Rol C / Equipo | Ratificar PA-006 y aplicar RC-C-01/02 |
| 5 | Modelo de datos v1 con diccionario | 🟡 Existe, desactualizado | `docs/diccionario-datos.md`; RC-A-01…04 | Rol A | Aplicar RC-A-01…04 |
| 6 | Máquinas de estado | 🟢 Cumplido (diseño) | Diseño cap. 9 + R-004/R-005 | Rol A | Reflejar enums/transiciones en diccionario y OpenAPI |
| 7 | Reglas de negocio y validaciones | 🟡 Parcial | Diseño caps. 9–10, R-008…R-012; payloads marcados `TODO` (PA-007) | Rol A / Rol C | Cerrar PA-007 o registrar los `TODO` restantes como PA |
| 8 | Catálogo de notificaciones, reportes y KPIs | 🔴 **No existe** | R-009/R-020 cubren eventos y criticidad; no hay catálogo de reportes/KPIs | Rol C (notificaciones) / Rol A (reportes) | Crear catálogo o registrar PA con valor por defecto y compuerta C6 |
| 9 | Mecanismo de auditoría y solo inserción | 🟢 Cumplido (diseño) | `modelo-auditoria-v1.md` + ADR-0004 | Rol B | Ratificar R-030/R-031 y el catálogo de 59 eventos |
| 10 | Traducción de requisitos no funcionales | 🟢 Cumplido (diseño) | Diseño cap. 14 + `docs/requirements/seguridad.md` | Rol B / Equipo | Ratificar criterios de seguridad; rendimiento y disponibilidad se verifican en C5 |
| 11 | Refinamiento del plan | 🟢 Cumplido | Diseño cap. 18 + `docs/tasks/rol-b/rol-b-it0-plan.md` | Equipo | Confirmar el plan de C1 |

## 3. Paquete de revisión (diseño §19.4)

| Sección exigida | Dónde está | Estado |
| --- | --- | --- |
| Alcance entregado frente al planificado | `docs/reviews/c0/rol-b.md` §1–§3; `docs/reviews/c0/estado-cierre.md` §2 | Cubierto |
| Decisiones y supuestos con reversibilidad | `rol-b.md` §4 + §4.3; `docs/adr/README.md` §3–§6 | Cubierto |
| Preguntas abiertas | `rol-b.md` §6; `docs/open-questions.md`; `adr/README` §5 | Cubierto |
| Informe de pruebas y matriz de autorización | `rol-b.md` §3; `matriz-autorizacion-v1.md` §7 | Cubierto (pruebas documentales; ejecución en C2) |
| Guion de demostración reproducible | `rol-b.md` §9 | Cubierto |
| Resumen de diferencias (tablas, rutas, permisos, migraciones, dependencias) | `rol-b.md` §3–§8; `revision-cruzada.md` §4; `reconciliacion-c0-rol-b.md` §3–§4 | Cubierto |
| Defectos y deuda técnica conocidos | `rol-b.md` §6–§7; `estado-cierre.md` §5 | Cubierto |
| Autoevaluación anti-deriva | `rol-b.md` §10 | Cubierto |

## 4. Condiciones de cierre, en orden

### P0 — impiden firmar C0

| # | Condición | Dueño | Evidencia de cierre |
| --- | --- | --- | --- |
| 1 | Aplicar RC-A-01…04 en el diccionario (cifrado + hash, `recurso_id`, identidad MFA, vínculo `usuario_id`) | Rol A | Diccionario actualizado y revisión cruzada marcada como cerrada |
| 2 | Aplicar RC-C-01…04 en catálogo y OpenAPI (permisos, asignaciones, `x-*`, rutas) | Rol C | Catálogo y OpenAPI actualizados; 48 operaciones cubiertas |
| 3 | Ratificar ADR-0001…0004, R-018…R-031 y PA-006 | Equipo | Acta de C0 con checklist de `docs/adr/README.md` §7 |
| 4 | Confirmar PA-001 (ubicación de revisiones) y PA-003/PA-005 (idioma y regeneración de contratos) | Equipo | Acta de C0 |
| 5 | Resolver el vacío del catálogo de requisitos funcionales (entregable 1) | Rol A / Rol C | Ratificar PA-017 **o** crear el catálogo formal; ver `docs/reviews/c0/cobertura-requisitos.md` |

### P1 — pueden quedar como PA con valor por defecto

| # | Condición | Valor por defecto | Compuerta |
| --- | --- | --- | --- |
| 6 | Catálogo de notificaciones, reportes y KPIs (entregable 8) | Eventos de R-020; reportes/KPIs en C6 | C6 |
| 7 | PA-004 acudiente | Sin acceso | Antes de C2 |
| 8 | PA-007 detalle de esquemas OpenAPI | Completar en C1 | C1 |
| 9 | PA-009…PA-016 | Valores de `auth-v1`, PA-011 y PA-016 | C2–C8 |

## 5. Deuda y riesgos conocidos al cierre

| Deuda / riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Diccionario y OpenAPI desalineados de las resoluciones | Bloquea el congelamiento y C2 | RC-A/RC-C antes de firmar |
| Catálogo de requisitos funcionales ausente | No se cumple el criterio literal de Compuerta 0 | Crear catálogo o PAs en el acta |
| 5 celdas † en la matriz | Matriz no firmable | Ratificar R-018/R-020/R-029 |
| Payloads OpenAPI con `TODO` | Contratos incompletos para el frontend | PA-007 en C1 |
| Verificación de seguridad solo documental | Los controles no están probados | C1/C2 con evidencia |
| Un solo perfil administrador | Concentración de poder | PA-014 + MFA + auditoría |

## 6. Qué se puede congelar hoy

Si el equipo ratifica sin cambios, quedan listos para congelar:

- Decisiones tecnológicas y estructura del repositorio (diseño caps. 5–6).
- Gramática de permisos y semántica de autorización (R-001, R-002, ADR-0001, PA-006).
- Formato de errores y códigos estables (`auth-v1` §9).
- Modelo de auditoría y catálogo de eventos (ADR-0004, R-030/R-031).
- Criterios de aceptación de CAR-07 y CAR-12.
- Controles de seguridad y su mapa por compuerta.

**No se puede congelar** el modelo de datos v1 ni el OpenAPI hasta aplicar RC-A y RC-C.

## 7. Definición exacta de “Iteración 0 cerrada”

La Iteración 0 se considera cerrada cuando se cumplen las cinco condiciones P0 y existe un acta de C0 que:

1. Declara ratificados los ADR y las resoluciones.
2. Registra la actualización del diccionario y del OpenAPI (o su fecha comprometida).
3. Cierra PA-006 y confirma PA-001/PA-003/PA-005.
4. Resuelve el catálogo de requisitos funcionales (artefacto o PA).
5. Autoriza el inicio de C1 y el congelamiento de los artefactos listados en la §6.

> Plan de C1 listo para revisión: `docs/tasks/rol-b/rol-b-it1-plan.md` (14 tareas, 14 decisiones con recomendación y criterio de salida de Compuerta 1).

## 8. Plantilla de acta (para el equipo)

```text
ACTA DE COMPUERTA 0 — CCLTPG
Fecha:
Participantes:

1. Ratificación de ADR:        ADR-0001 [ ]  ADR-0002 [ ]  ADR-0003 [ ]  ADR-0004 [ ]
2. Resoluciones ratificadas:   R-018 [ ] R-019 [ ] R-020 [ ] R-021 [ ] R-022 [ ] R-023 [ ]
                               R-024 [ ] R-025 [ ] R-026 [ ] R-027 [ ] R-028 [ ] R-029 [ ]
                               R-030 [ ] R-031 [ ]
3. PA cerradas:                PA-001 [ ] PA-003 [ ] PA-005 [ ] PA-006 [ ]
4. Diccionario actualizado:    [ ] RC-A-01  [ ] RC-A-02  [ ] RC-A-03  [ ] RC-A-04
5. OpenAPI/catálogo actualizado:[ ] RC-C-01  [ ] RC-C-02  [ ] RC-C-03  [ ] RC-C-04
6. Catálogo de requisitos:     [ ] creado   [ ] sustituido por PAs con responsable y valor por defecto
7. Artefactos congelados:      [ ] modelo de datos v1  [ ] gramática/catálogo  [ ] formato de errores
8. Inicio de C1 autorizado:    [ ] sí  [ ] no, condiciones:

Observaciones:
Firmas:
```
