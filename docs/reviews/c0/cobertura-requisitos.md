# Cobertura de criterios de aceptación por requisito (C0)

- **Estado:** Revisión de Rol B para **Compuerta 0**. No crea criterios funcionales: verifica qué requisito tiene criterio verificable y cuál queda cubierto por pregunta abierta (PA) con responsable y valor por defecto, como exige el diseño §18.2.
- **Fecha:** 2026-11-16
- **Fuentes:** `docs/vision-alcance.md` (CAR-01…CAR-12); `docs/diseno-arquitectonico.md` caps. 7–10, 14, 17, 18; `docs/contratos/api-v1.openapi.yaml`; `docs/contratos/matriz-autorizacion-v1.md`; `docs/requirements/seguridad.md`; `docs/contratos/reconciliacion-c0.md`; `docs/open-questions.md`.
- **Regla:** un requisito está cubierto si tiene (a) criterio de aceptación verificable, o (b) PA con responsable, valor por defecto y compuerta. “Cubierto por diseño” no basta si no hay forma de verificarlo.

## 1. Resumen

| Estado | Requisitos | Total |
| --- | --- | --- |
| Criterio verificable formal | CAR-06, CAR-07, CAR-08, CAR-10, CAR-11, CAR-12 | 6 |
| Cubierto por diseño con meta medible, pendiente de formalizar | CAR-06, CAR-08, CAR-11 | (incluidos arriba) |
| Sin criterio formal; se propone PA-017 | CAR-01, CAR-02, CAR-03, CAR-04, CAR-05, CAR-09 | 6 |
| Sin cobertura alguna | Ninguno | 0 |

**Resultado:** con PA-017 registrada, **los 12 CAR quedan cubiertos** por criterio o por PA con dueño y valor por defecto. Sin PA-017, la Compuerta 0 no cumple su criterio literal.

## 2. Matriz por requisito

| CAR | Requisito (resumen) | Criterio existente | Dónde se verifica | Estado | Acción |
| --- | --- | --- | --- | --- | --- |
| CAR-01 | Registro y gestión de estudiantes; inscripción con validación de cupos | Reglas de diseño caps. 7.3 y 9; R-004, R-006, R-010; contratos `/academic/students` y `/academic/enrollments` | C4 (pruebas de matrícula y cupo) | 🟡 Sin AC formal | PA-017 |
| CAR-02 | Estudiante consulta matrícula, horarios, grupo, docente, salón y progreso | Ámbito propio AC-SEC-18; rutas `/me/student`, `/me/enrollments`, `/me/schedule`, `/me/evaluations` (OP-19/22/23/28) | C2 (autorización) y C4 (contenido) | 🟡 Sin AC de contenido | PA-017 |
| CAR-03 | Educador gestiona asistencia y evaluación cualitativa de sus grupos | R-010 (idempotencia), matriz OP-24…27 y OP-37…41, eventos `asistencia.*`/`evaluacion.*` | C4 | 🟡 Sin AC formal | PA-017 |
| CAR-04 | Reportes automáticos exportables (Excel, PDF, CSV) | R-003: sin endpoints en v1.0; catálogo reservado hasta C6 | C6 | 🔴 Sin criterio | PA-017 (C6) |
| CAR-05 | Dashboards interactivos con métricas | R-003: sin endpoints en v1.0; KPIs en C6 | C6 | 🔴 Sin criterio | PA-017 (C6) |
| CAR-06 | 200 usuarios concurrentes; p95 < 4 s en operaciones críticas | Diseño cap. 14 (meta medible); pruebas k6 (cap. 17) | C5 | 🟢 Criterio medible | Formalizar AC-FUN-06 en C1 |
| CAR-07 | Autenticación con MFA, RBAC y TLS | AC-SEC-01…AC-SEC-33 + AC-B-01…16 | C2/C5/C7 | 🟢 Completo | Ninguna |
| CAR-08 | Disponibilidad 99.9 %, DRP, backups, tolerancia a fallos | Diseño cap. 14: 99.9 %, RPO ≤ 15 min, RTO ≤ 4 h; SUP-004/005; C-25 | C5/C8 | 🟢 Criterio medible | Formalizar AC-FUN-08 en C1 |
| CAR-09 | Notificaciones automáticas (fechas, horario, progreso) | R-009/R-020 (eventos y criticidad); matriz OP-31…34; catálogo de eventos | C3/C6 | 🟡 Parcial | PA-017 (C3/C6) |
| CAR-10 | Tres niveles de usuario con permisos diferenciados | AC-SEC-16…AC-SEC-22; matriz de 48 operaciones; ADR-0001 | C2 | 🟢 Completo | Ninguna |
| CAR-11 | WCAG 2.1 AA y diseño responsivo | Diseño cap. 14: WCAG 2.1 AA y puntos de quiebre 360/768/1024/1440; `axe` en CI | C7 | 🟢 Criterio medible | Formalizar AC-FUN-11 en C1 |
| CAR-12 | Trazabilidad de inicios de sesión y cambios con usuario, fecha y hora | AC-AUD-01…AC-AUD-15; ADR-0004 | C2/C5 | 🟢 Completo | Ninguna |

## 3. Propuesta de PA-017

**Pregunta:** ¿Qué criterios de aceptación funcionales rigen CAR-01…CAR-05 y CAR-09, que aún no tienen AC formal?

**Valor por defecto propuesto:**

- **CAR-01…CAR-03 (Release 1.0):** adoptar como criterio vinculante las reglas de los caps. 7.3, 9 y 10 del diseño y los contratos de `api-v1.openapi.yaml`; redactar AC-FUN-01…03 antes de la implementación de su módulo y verificarlos en C4.
- **CAR-09 (notificaciones):** adoptar R-009/R-020 y el catálogo de eventos; redactar AC-FUN-09 antes de C3 y verificarlos en C3/C6.
- **CAR-04/CAR-05 (Release 2.0):** mantener R-003 (sin endpoints en v1.0); redactar AC-FUN-04/05 antes de C6 y verificarlos en C6.
- **CAR-06/08/11:** ya tienen meta medible en el diseño cap. 14; formalizarlas como AC-FUN en C1 sin cambiar el valor.

**Responsable / compuerta:** Rol A y Rol C / C1 (redacción), con verificación en la compuerta de cada módulo.

**Impacto si no se registra:** la Compuerta 0 no cumple el criterio “todo requisito tiene criterio o PA”; el equipo estaría aprobando con un vacío no declarado.

## 4. Observaciones

1. **CAR-06/08/11 no están “sin criterio”**: tienen meta medible en el diseño. Lo que falta es el identificador formal de AC y su prueba; puede hacerse en C1 sin reabrir C0.
2. **CAR-04/05 no se implementan en v1.0**: su criterio puede esperar a C6, pero debe quedar registrado como PA, no como olvido.
3. **CAR-10 se cubre con los criterios de seguridad**: la matriz y AC-SEC-16…22 son su verificación; no hace falta un AC funcional separado.
4. **CAR-01/02/03 son el núcleo del Release 1.0**: son los de mayor riesgo si llegan a C4 sin criterio. La PA-017 debe redactarse antes de C4, no después.

## 5. Qué no hace este documento

- No redacta los AC funcionales (propiedad de Rol A/C).
- No modifica el catálogo de requisitos ni el diseño.
- No sustituye la decisión del equipo sobre PA-017.
