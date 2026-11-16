# Revisión de gramática, catálogo y asignación de permisos (Iteración 0 — Rol B)

- **Fecha:** 2026-11-16
- **Iteración / compuerta:** Iteración 0 / Compuerta 0
- **Responsable:** Rol B (seguridad, identidad y operación)
- **Tarea:** 1 — revisión formal de la gramática de permisos y del catálogo
- **Documento revisado:** `docs/contratos/gramatica-y-catalogo-permisos-v1.md` (propuesta), reconciliación R-001/R-002/R-011/R-017.
- **Insumos:** `docs/contratos/api-v1.openapi.yaml` (35 operaciones), `docs/tasks/rol-b/rol-b-it0-inventario.md`, `docs/diseno-arquitectonico.md` (caps. 8, 9, 11, 12), `docs/diccionario-datos.md`.
- **Veredicto:** **Gramática aprobada** (reglas 1–6). **Catálogo y asignaciones aprobados con reservas**: no son firmables para C0 hasta resolver las objeciones B-01…B-09 mediante R-018…R-028.

## 1. Método

1. Verificar cada regla de semántica contra el capítulo 8 del diseño y el modelo de datos.
2. Cruzar cada permiso del catálogo contra las 35 operaciones del contrato propuesto (inventario, §4).
3. Cruzar cada asignación por perfil contra los flujos de estudiante, educador y administrador del Release 1.0.
4. Registrar objeciones con severidad, impacto y resolución propuesta; no se modifica el documento de Rol C.

## 2. Revisión regla por regla

| Regla | Texto revisado | Veredicto | Observación |
| --- | --- | --- | --- |
| 1 | Denegación por defecto | **Aprobada** | Correcta. Debe materializarse en guard global con lista blanca explícita de rutas públicas y prueba que falle si una ruta no declara permiso (ADR-0001). |
| 2 | Comodín solo como segmento completo | **Aprobada** | Correcta. `identity:*:manage`, `academic:*:manage`, `files:*:create/read` son válidos. La expansión para `/me` y para la matriz debe ser determinista (R-021/R-023). |
| 3 | Implicaciones `manage ⇒ create, read, update, delete, export`; `read ⇒ read_own`; `update ⇒ update_own` | **Aprobada con aclaración** | `manage` implica `export` aunque el recurso no tenga operación de exportación (`identity:user:export` no existe). Debe limitarse a las acciones definidas por recurso y documentarse (R-022). `read ⇒ read_own` no debe convertir una lectura global en lectura propia si el recurso no tiene noción de propiedad. |
| 4 | Ámbito propio verificado por fila; primero permiso, después propiedad | **Aprobada con reserva** | Falta la tabla de resolución de propiedad por recurso (estudiante, matrícula, sesión, archivo). Sin ella el guard es ambiguo (R-023, objeción B-07). |
| 5 | Unión de perfiles vigentes (`valid_until` nulo o futuro) | **Aprobada con aclaración** | Definir borde temporal en UTC (`valid_until > now()`), estado del usuario y revocación de sesiones al expirar (R-014). Si algún perfil exige MFA, la sesión completa lo exige (R-021). |
| 6 | Sin permisos negativos | **Aprobada** | Consecuencia aceptada: no hay administrador de solo lectura ni revocación puntual; se compensa con MFA, auditoría y roles de base de datos. Se registra el riesgo de concentración de poder (PA-014). |

## 3. Catálogo: hallazgos

| ID | Hallazgo | Severidad | Resolución propuesta |
| --- | --- | --- | --- |
| B-01 | El educador no tiene permiso ni ruta para ver las matrículas/roster de sus grupos; `GET /academic/students` exige `academic:student:manage`. | Alta (bloquea asistencia y evaluación) | Asignar `academic:enrollment:read` al educador con ámbito de grupo y añadir `GET /academic/enrollments` con filtros (R-018). No se concede `academic:student:read`; la respuesta del roster se minimiza (id, nombres, apellidos, estado, periodo). |
| B-02 | `PATCH /notifications/{id}` (marcar leída) se autoriza con `notifications:notification:read_own`, que es una lectura. | Alta (semántica de autorización) | Añadir `notifications:notification:update_own` al catálogo y a los tres perfiles (R-020). |
| B-03 | `GET /notifications/preferences` se autoriza con `notifications:preference:update_own`. | Media | Añadir `notifications:preference:read_own`; mantener `update_own` para el PUT (R-020). |
| B-04 | Faltan operaciones de lectura para sesiones, asistencia y evaluaciones; hay permisos (`attendance:read/update`, `evaluation:read/update`, `enrollment:read`) sin ruta. | Alta (flujos incompletos) | Añadir rutas de lectura y definir indicadores en C4 (R-019). |
| B-05 | El ciclo de identidad no tiene contrato: enrolamiento MFA, recuperación, cambio/reset de contraseña; el modelo no soporta códigos de recuperación ni cambio obligatorio. | Alta (MFA obligatorio inoperable) | Contrato `auth-v1` + cambios de modelo (R-021, R-027). |
| B-06 | `manage ⇒ export` crea permisos implícitos sin operación; no hay politica de exportación por recurso. | Media | Limitar la implicación a acciones existentes y documentar que no hay exportaciones en v1.0 (R-022). |
| B-07 | No hay resolución de propiedad para `*_own` ni para ámbito de grupo; `files:document:read_own` no tiene vínculo de propiedad en el modelo (`archivo` solo tiene `subido_por`). | Alta (riesgo de fuga) | Tabla de resolución y regla 403 vs 404 (R-023). Archivos: `read_own` = `subido_por` en v1.0; vínculo documental se define en C3/C6. |
| B-08 | Los permisos están en prosa; no hay extensión legible por máquina ni semántica OR formal (`manage` o `read_own`). | Media (automatización) | `x-permission` (arreglo, OR), `x-access`, `x-audit-event`; CI valida que toda operación declare acceso (R-028). |
| B-09 | Un solo perfil administrador concentra identidad, académico, auditoría y archivos; no hay separación de funciones. | Media (riesgo aceptado) | Aceptar para v1.0 con MFA obligatorio, auditoría inmutable y roles de BD; revisar en C8 (PA-014). |

### Permisos sin operación (no son error por sí mismos)

`identity:profile:read`, `identity:profile:update`, `identity:temporary-identity:manage`, `academic:schedule:read`, `academic:enrollment:delete`, `academic:attendance:update`, `academic:indicator:manage`, `exports:report:create`, `exports:report:export`, `analytics:kpi:read`.

**Regla propuesta:** todo permiso sin operación debe figurar como **reservado** con compuerta de activación (C2, C4, C6 u C8) o retirarse del catálogo. No puede quedar como ambigüedad. `identity:temporary-identity:manage` queda reservado y **sin asignación** hasta PA-004.

## 4. Asignación por perfil

### 4.1 Estudiante

**Veredicto:** aprobada con dos correcciones.

| Permiso | Uso | Observación |
| --- | --- | --- |
| `academic:enrollment:read_own` | `/me/enrollments` | Correcto; propiedad vía `matricula → estudiante.usuario_id`. |
| `academic:schedule:read_own` | `/me/schedule` | Correcto; horario de grupos donde está matriculado. |
| `academic:evaluation:read_own` | `/me/evaluations` | Correcto. |
| `academic:student:read_own` | `/me/student` | Correcto; requiere definir `usuario_id` (R-026). |
| `notifications:notification:read_own` | listado | Correcto. |
| `notifications:preference:update_own` | GET/PUT preferencias | **Corregir**: el GET debe usar `preference:read_own`; añadir `notification:update_own` para marcar leída (R-020). |
| `files:document:read_own` | descarga | **Inerte en v1.0**: no hay vínculo de propiedad distinto de `subido_por` y el estudiante no puede subir. Se mantiene reservado y se documenta (R-023). |

### 4.2 Educador

**Veredicto:** aprobada con una adición bloqueante.

| Permiso | Uso | Observación |
| --- | --- | --- |
| `academic:group:read_own` | listar sus grupos | Correcto; colecciones filtradas, acceso directo fuera de ámbito → 404. |
| `academic:schedule:read_own` | su horario | Correcto. |
| `academic:session:create` / `update` | crear/transicionar sesiones | Correcto con condición de dueño del grupo. |
| `academic:attendance:create` / `update` / `read` | asistencia | `create` cubre el PUT; `update/read` requieren rutas (R-019). |
| `academic:evaluation:create` / `update` / `read` | evaluación | `update/read` requieren rutas (R-019). |
| `files:document:create` | cargar material | Correcto; límites y lista blanca en C3. |
| `notifications:notification:read_own` | bandeja | Correcto; añadir `update_own` y preferencias propias (R-020). |
| **Falta** `academic:enrollment:read` | roster de sus grupos | **Bloqueante**: sin esto no puede pasar lista ni evaluar (R-018). |

No se concede `academic:student:manage` ni `academic:student:read` al educador: el roster se obtiene de la matrícula con campos mínimos (minimización de PII).

### 4.3 Administrador

**Veredicto:** aprobada con correcciones menores.

| Permiso | Uso | Observación |
| --- | --- | --- |
| `identity:*:manage` | usuarios, perfiles, transiciones | Correcto; incluye `profile:read/update` por implicación. |
| `academic:*:manage` | todo el contexto académico | Correcto; incluye programas, grupos, estudiantes, matrículas, sesiones, asistencia, evaluación e indicadores. |
| `audit:event:read` | consulta de auditoría | Correcto; la consulta se audita (meta-auditoría). |
| `files:*:create` / `files:*:read` | cargar/descargar | Correcto; redundante con `files:document:*`, pero válido. |
| `notifications:notification:read_own` | bandeja propia | Correcto; añadir `update_own` y preferencias propias (R-020). |
| `exports` / `analytics` | — | Sin asignación en v1.0; se activan en C6 (R-003). |

## 5. Objeciones y resoluciones

| Objeción | Resolución propuesta (adenda C0) | Artefactos impactados |
| --- | --- | --- |
| B-01 roster del educador | **R-018** | Catálogo (asignación), OpenAPI, matriz |
| B-02/B-03 notificaciones | **R-020** | Catálogo, asignaciones, OpenAPI, matriz |
| B-04 lecturas académicas | **R-019** | OpenAPI, matriz |
| B-05 ciclo de identidad | **R-021**, **R-027** | OpenAPI, diccionario, matriz, `auth-v1` |
| B-06 implicación de exportación | **R-022** | Catálogo (semántica), OpenAPI |
| B-07 propiedad y ámbito | **R-023** | Matriz, `auth-v1`, diseño de guard (C2) |
| B-08 contrato legible por máquina | **R-028** | OpenAPI, CI |
| B-09 concentración de poder | PA-014 (valor por defecto: aceptado v1.0) | Riesgos, C8 |
| Adicional: horarios | **R-024** | OpenAPI, modelo, C4 |
| Adicional: cifrado de documento | **R-025** | Diccionario, migraciones, ADR-0003 |
| Adicional: vínculo estudiante-usuario | **R-026** | Diccionario, OpenAPI |

## 6. Condiciones para firmar C0

1. Ratificar R-018 a R-021 y R-028 (cambios de catálogo, rutas y extensiones de contrato).
2. Aceptar R-022 a R-027 como resoluciones de semántica/modelo, con actualización del diccionario por Rol A.
3. Publicar la matriz v0.1 con las 48 operaciones (35 vigentes + 13 propuestas) y las nuevas rutas propuestas marcadas como “pendientes de ratificación”: hecho en `docs/contratos/matriz-autorizacion-v1.md`.
4. Confirmar que `identity:temporary-identity:manage` no se asigna hasta PA-004.
5. Registrar PA-014 (separación de funciones) y PA-012 (recuperación de contraseña de autoservicio) con valor por defecto.

**Firma:** Rol B aprueba la gramática; no firma el catálogo/asignaciones para C0 mientras B-01…B-05 sigan abiertas.

## 7. Qué no se hizo

- No se editó `gramatica-y-catalogo-permisos-v1.md` ni el OpenAPI (propiedad de Rol C).
- No se aprobaron permisos nuevos por cuenta propia: quedan como propuestas R-018…R-031.
- No se construyó la matriz de autorización (tarea 3).

## 8. Actualización posterior (C0)

- **Resoluciones completas:** R-018…R-031 en `docs/contratos/reconciliacion-c0-rol-b.md`; índice en `docs/adr/README.md`.
- **Matriz:** 48 operaciones con ámbitos y casos 404 en `docs/contratos/matriz-autorizacion-v1.md`; 5 celdas † dependen de R-018/R-020/R-029.
- **Auditoría:** catálogo de 59 eventos y modelo en `docs/contratos/modelo-auditoria-v1.md`; R-030/R-031.
- **Revisión cruzada:** `docs/reviews/c0/revision-cruzada.md` (RC-C-01/02 piden los permisos de R-018/R-020/R-029 en el catálogo).
- **Estado de firma:** se mantiene la reserva; B-01…B-05 se cierran cuando Rol C aplique los cambios y el equipo ratifique.
