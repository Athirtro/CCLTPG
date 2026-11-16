# Inventario y trazabilidad de la superficie de seguridad (Iteración 0 — Rol B)

- **Fecha:** 2026-11-16
- **Iteración / compuerta:** Iteración 0 / Compuerta 0
- **Responsable:** Rol B (seguridad, identidad y operación)
- **Tarea:** 0 — inventario de la superficie de seguridad y trazabilidad
- **Fuentes:** `docs/diseno-arquitectonico.md` (caps. 4, 6–14, 16–19), `docs/vision-alcance.md` (CAR-07, CAR-12), `docs/diccionario-datos.md`, `docs/contratos/api-v1.openapi.yaml` (v1.0.0-propuesta), `docs/contratos/gramatica-y-catalogo-permisos-v1.md`, `docs/contratos/reconciliacion-c0.md` (R-001…R-017), `docs/open-questions.md` (PA-001…PA-008), planes de trabajo por rol.
- **Regla:** el OpenAPI, el catálogo y el diccionario son **propuestas**; este inventario no los modifica. Las correcciones se registran en `docs/contratos/reconciliacion-c0-rol-b.md` (R-018…R-028) para ratificación en C0.

## 1. Método

1. Enumerar todas las operaciones del contrato propuesto (30 rutas, 35 operaciones).
2. Clasificar cada operación por acceso (público, parcial, autenticado o permiso), ámbito (global, propio, grupo), idempotencia, evento de auditoría esperado y tratamiento de PII.
3. Cruzar el catálogo cerrado de permisos contra las operaciones para detectar permisos sin uso y operaciones sin permiso adecuado.
4. Registrar brechas con severidad, impacto, propuesta y compuerta de resolución.
5. Trazar a CAR-07, CAR-12 y capítulos de seguridad/privacidad/operación.

## 2. Resumen cuantitativo

| Métrica | Valor |
| --- | --- |
| Rutas en el contrato propuesto | 30 |
| Operaciones | 35 |
| Públicas | 3 (`/auth/login`, `/auth/mfa/verify`, `/auth/refresh`) |
| Públicas con token parcial | 1 (`/auth/mfa/verify`) |
| Autenticadas sin permiso específico | 2 (`/auth/logout`, `/me`) |
| Con permiso del catálogo | 30 |
| Operaciones que escriben estado | 22 |
| Operaciones con PII en respuesta o auditoría | 11 |
| Permisos del catálogo sin operación asociada | 14 (3 bloqueantes: `enrollment:read`, `attendance:read`, `evaluation:read`) |
| Brechas registradas | 17 (G-01…G-17) |

## 3. Inventario por contexto

> **Idem.** = requiere `Idempotency-Key`. Los GET son seguros por HTTP y no llevan clave.
> La columna **Auditoría** es la propuesta de Rol B; el catálogo definitivo se cierra en la tarea 4.

### 3.1 Autenticación y sesión

| ID | Método y ruta | Permiso / acceso | Ámbito | Idem. | Auditoría propuesta | PII | Brecha |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OP-01 | `POST /auth/login` | Público | — | — | `sesion.iniciada` / `sesion.fallida` | Email (HMAC en fallo) | G-05, G-15 |
| OP-02 | `POST /auth/mfa/verify` | Público + token parcial | — | — | `sesion.mfa_verificada` / `sesion.mfa_fallida` | No | G-05 |
| OP-03 | `POST /auth/refresh` | Público + cookie | — | — | `sesion.refresh_reutilizado` (solo reutilización) | No | G-15 |
| OP-04 | `POST /auth/logout` | Autenticado | — | Sí (semántica) | `sesion.cerrada` | No | G-05 |
| OP-05 | `GET /me` | Autenticado | Propio | — | No | Propio | G-14 |

### 3.2 Identidad

| ID | Método y ruta | Permiso / acceso | Ámbito | Idem. | Auditoría propuesta | PII | Brecha |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OP-06 | `GET /identity/users` | `identity:user:manage` | Global | — | `usuario.listado` | Email, nombre | G-12 |
| OP-07 | `POST /identity/users` | `identity:user:manage` | Global | Sí | `usuario.creado` | Email | G-05 |
| OP-08 | `PATCH /identity/users/{id}` | `identity:user:manage` | Global | — | `usuario.actualizado` | Email | G-05 |
| OP-09 | `POST /identity/users/{id}/transitions` | `identity:user:manage` | Global | — | `usuario.<estado>` | No | G-05 |
| OP-10 | `POST /identity/users/{id}/profiles` | `identity:user:manage` | Global | Sí | `usuario.perfil_asignado` | No | — |

### 3.3 Académico

| ID | Método y ruta | Permiso / acceso | Ámbito | Idem. | Auditoría propuesta | PII | Brecha |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OP-11 | `GET /academic/programs` | `academic:program:manage` | Global | — | No | No | — |
| OP-12 | `POST /academic/programs` | `academic:program:manage` | Global | Sí | `programa.creado` | No | — |
| OP-13 | `POST /academic/programs/{id}/transitions` | `academic:program:manage` | Global | — | `programa.<estado>` | No | — |
| OP-14 | `GET /academic/groups` | `academic:group:manage` **o** `academic:group:read_own` | Global / propio | — | No | No | G-13 |
| OP-15 | `POST /academic/groups` | `academic:group:manage` | Global | Sí | `grupo.creado` | No | G-09 |
| OP-16 | `POST /academic/groups/{id}/transitions` | `academic:group:manage` | Global | — | `grupo.cerrado` | No | — |
| OP-17 | `GET /academic/students` | `academic:student:manage` | Global | — | `estudiante.listado` | Documento, contacto, dirección | G-02, G-10, G-12 |
| OP-18 | `POST /academic/students` | `academic:student:manage` | Global | Sí + consentimiento | `estudiante.creado` | Alta PII | G-11 |
| OP-19 | `GET /me/student` | `academic:student:read_own` | Propio | — | No | Propio | G-11 |
| OP-20 | `POST /academic/enrollments` | `academic:enrollment:create` | Global | Sí | `matricula.creada` | No | — |
| OP-21 | `POST /academic/enrollments/{id}/transitions` | `academic:enrollment:update` | Global | — | `matricula.<estado>` | No | G-02 |
| OP-22 | `GET /me/enrollments` | `academic:enrollment:read_own` | Propio | — | No | Propio | — |
| OP-23 | `GET /me/schedule` | `academic:schedule:read_own` | Propio | — | No | Propio | — |
| OP-24 | `POST /academic/sessions` | `academic:session:create` + dueño del grupo | Grupo | Sí | `clase.creada` | No | G-01 |
| OP-25 | `POST /academic/sessions/{id}/transitions` | `academic:session:update` + dueño | Grupo | — | `clase.<estado>` | No | G-01 |
| OP-26 | `PUT /academic/sessions/{id}/attendance` | `academic:attendance:create` + dueño | Grupo | Sí (estado resultante) | `asistencia.registrada` | No | G-03 |
| OP-27 | `POST /academic/evaluations` | `academic:evaluation:create` + dueño | Grupo | Sí | `evaluacion.registrada` | Valor y observación | G-04 |
| OP-28 | `GET /me/evaluations` | `academic:evaluation:read_own` | Propio | — | No | Propio | — |

### 3.4 Archivos, notificaciones y auditoría

| ID | Método y ruta | Permiso / acceso | Ámbito | Idem. | Auditoría propuesta | PII | Brecha |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OP-29 | `POST /files` | `files:document:create` | Global | Sí | `archivo.subido` | Nombre, MIME, hash | SUP-008 |
| OP-30 | `GET /files/{id}/download` | `files:document:read` **o** `files:document:read_own` | Global / propio | — | `archivo.descargado` (siempre) | Sí | G-08 |
| OP-31 | `GET /notifications` | `notifications:notification:read_own` | Propio | — | No | No | G-06 |
| OP-32 | `PATCH /notifications/{id}` | `notifications:notification:read_own` | Propio | — | No | No | G-06 |
| OP-33 | `GET /notifications/preferences` | `notifications:preference:update_own` | Propio | — | No | No | G-06 |
| OP-34 | `PUT /notifications/preferences` | `notifications:preference:update_own` | Propio | — | `preferencia.actualizada` | No | G-06 |
| OP-35 | `GET /audit/events` | `audit:event:read` | Global | — | `auditoria.consultada` | Actor, IP | G-17 |

## 4. Cobertura permiso → operación

| Permiso del catálogo | Operación(es) | Estado |
| --- | --- | --- |
| `identity:user:manage` | OP-06…OP-10 | Cubierto |
| `identity:profile:read` / `identity:profile:update` | — | Sin operación (reservado) |
| `identity:temporary-identity:manage` | — | Sin operación ni asignación; PA-004 bloqueante antes de C2 |
| `academic:program:manage` | OP-11…OP-13 | Cubierto |
| `academic:group:manage` | OP-14…OP-16 | Cubierto |
| `academic:group:read_own` | OP-14 | Cubierto (semántica OR, G-13) |
| `academic:schedule:read` | — | Sin operación (admin) |
| `academic:schedule:read_own` | OP-23 | Cubierto |
| `academic:student:manage` | OP-17, OP-18 | Cubierto |
| `academic:student:read_own` | OP-19 | Cubierto |
| `academic:enrollment:create` | OP-20 | Cubierto |
| `academic:enrollment:read` | — | **Sin operación ni asignación al educador** (G-02) |
| `academic:enrollment:read_own` | OP-22 | Cubierto |
| `academic:enrollment:update` | OP-21 | Cubierto |
| `academic:enrollment:delete` | — | Sin operación; cancelación/retiro por transición |
| `academic:session:create` | OP-24 | Cubierto |
| `academic:session:update` | OP-25 | Cubierto |
| `academic:attendance:create` | OP-26 | Cubierto |
| `academic:attendance:update` | — | Sin operación (el PUT usa `create`) |
| `academic:attendance:read` | — | **Sin operación** (G-03) |
| `academic:evaluation:create` | OP-27 | Cubierto |
| `academic:evaluation:update` | — | **Sin operación** (G-04) |
| `academic:evaluation:read` | — | **Sin operación** (G-04) |
| `academic:evaluation:read_own` | OP-28 | Cubierto |
| `academic:indicator:manage` | — | Sin operación (G-04) |
| `audit:event:read` | OP-35 | Cubierto |
| `files:document:create` | OP-29 | Cubierto |
| `files:document:read` / `read_own` | OP-30 | Cubierto |
| `notifications:notification:read_own` | OP-31, OP-32 | Cubierto con semántica dudosa (G-06) |
| `notifications:preference:update_own` | OP-33, OP-34 | Cubierto con semántica dudosa (G-06) |
| `exports:report:create` / `export` | — | Diferido a C6 (R-003) |
| `analytics:kpi:read` | — | Diferido a C6 (R-003) |

## 5. Brechas detectadas

| ID | Severidad | Brecha | Impacto | Propuesta | Responsable / compuerta |
| --- | --- | --- | --- | --- | --- |
| G-01 | Alta | No hay operación para **listar o consultar sesiones**; solo crear y transicionar. El educador no puede obtener `sesion_id` para asistencia. | Bloquea el flujo de asistencia y evaluación; el admin no supervisa sesiones. | `GET /academic/groups/{id}/sessions` y `GET /academic/sessions/{id}` con ámbito de grupo | C/A · C0 (R-019) |
| G-02 | Alta | El educador **no puede ver las matrículas ni el roster** de sus grupos (`GET /academic/students` exige `student:manage`; no hay `GET /academic/enrollments`). | No puede pasar lista ni evaluar; el admin no puede confirmar matrículas sin conocer IDs. | Añadir `academic:enrollment:read` al educador con ámbito de grupo y `GET /academic/enrollments` con filtros | B/C · C0 (R-018) |
| G-03 | Alta | No hay **lectura de asistencia** (`GET .../attendance`); `attendance:read` y `attendance:update` no se usan. | No se puede verificar ni corregir asistencia; auditoría sin consulta operativa. | `GET /academic/sessions/{id}/attendance` con `attendance:read` y ámbito de grupo | C/A · C0–C4 (R-019) |
| G-04 | Media | No hay **listado ni edición de evaluaciones** por grupo/periodo; `evaluation:read`, `evaluation:update` e `indicator:manage` no tienen operación. | El educador no revisa ni corrige; el admin no gestiona indicadores. | `GET /academic/evaluations`, `PATCH /academic/evaluations/{id}`, CRUD de indicadores en C4 | C/A · C4 (R-019) |
| G-05 | Alta | Faltan operaciones del **ciclo de identidad**: enrolamiento MFA, códigos de recuperación, cambio de contraseña y reset administrativo; además no hay modelo para códigos de recuperación ni bandera de cambio obligatorio. | MFA obligatorio no es operable; recuperación de cuenta depende de soporte manual; el modelo v1 no soporta el flujo. | Contrato en `docs/contratos/auth-v1.md`; adiciones al modelo (R-027) | B · C0 (R-021, R-027) |
| G-06 | Alta | `PATCH /notifications/{id}` usa `read_own` para una escritura y `GET /notifications/preferences` usa `update_own` para una lectura. | Semántica de permisos incorrecta; matriz y pruebas ambiguas. | Añadir `notifications:notification:update_own` y `notifications:preference:read_own` (R-020) | B/C · C0 |
| G-07 | Media | `manage ⇒ export` implica acciones de exportación que no existen por recurso. | Permisos implícitos no representables ni probables. | Limitar la implicación a operaciones de exportación definidas; sin rutas de exportación en v1.0 (R-022) | B · C0 |
| G-08 | Alta | No hay **tabla de resolución de propiedad** para `*_own` ni para ámbito de grupo. | El guard no puede implementarse sin ambigüedad; riesgo de fuga de datos. | Tabla recurso → condición de propiedad/pertinencia (R-023) | B · C0/C2 |
| G-09 | Media | **Horarios** (`horario_grupo`) no tienen operación de creación/modificación; la notificación `horario.modificado` no tiene contrato. | No se puede validar solapamiento ni modificar horarios; regla de matrícula incompleta. | Tratar horarios como subrecurso de grupo; endpoints en C4 (R-024) | A/C · C4 |
| G-10 | Alta | `numero_documento` figura **no sensible** en el diccionario, pero el cap. 12 incluye el documento entre los campos cifrados; no hay estrategia de unicidad sobre texto cifrado. | Bloquea la unicidad y la búsqueda; contradicción entre diseño y diccionario. | Cifrado AES-256-GCM + índice ciego HMAC único (ADR-0003 / R-025) | A/B · C0 |
| G-11 | Media | `estudiante.usuario_id` está marcado “Sí/No” sin definir obligatoriedad, y `read_own` depende de ese vínculo. | `GET /me/*` indeterminado; unicidad y alta de estudiantes ambiguas. | Nulo permitido, único cuando existe; alta con `usuarioId` opcional; 404 propio si no está vinculado (R-026) | A · C0 |
| G-12 | Baja | Sin operaciones de detalle (`GET /identity/users/{id}`, `GET /academic/students/{id}`, `GET /academic/groups/{id}`). | Edición y verificación dependen de listados filtrados. | Cubrir con filtros en listados; detalle en C4 si hace falta (PA) | C · C4 |
| G-13 | Media | Rutas con **semántica OR** de permisos (`manage` o `read_own`) no están modeladas de forma legible por máquina. | La matriz no puede generarse ni probarse automáticamente. | `x-permission` como arreglo con semántica OR documentada (R-028) | C · C0 |
| G-14 | Media | `/me` no define permisos efectivos: expansión de comodines, perfiles vigentes, `mfaEnabled`, `mustChangePassword`. | El frontend no puede construir navegación ni estados de sesión. | Contrato de `/me` en `auth-v1` §5 | B/C · C0 (R-021) |
| G-15 | Alta | El contrato no declara **CSRF, 429, cookie de refresh ni esquema `cookieAuth`**; `/auth/logout` promete idempotencia pero responde 401 sin token. | Riesgo CSRF y de interoperabilidad; la matriz de auth queda incompleta. | Contrato en `auth-v1` §§6–8; `429` y `cookieAuth` en OpenAPI (R-021) | B/C · C0 |
| G-16 | Media | Los permisos están solo en `description` de prosa; no hay extensión legible por máquina ni verificación en CI. | No se puede validar que toda ruta declare permiso; la prueba de denegación por defecto queda manual. | `x-permission`, `x-access`, `x-audit-event` + verificación en CI (R-028) | C/B · C0–C1 |
| G-17 | Baja | Auditoría solo expone listado; no hay detalle ni contrato de exportación (correcto para v1.0, pero no explícito). | Revisión de incidentes limitada al listado. | Documentar “solo listado en v1.0”; detalle/exportación en C8 | B · C8 |

## 6. Trazabilidad

| Requisito / capítulo | Qué exige | Artefacto de C0 | Brechas relacionadas |
| --- | --- | --- | --- |
| CAR-07 (seguridad) | MFA, RBAC, TLS | `auth-v1`, ADR-0001/0002, matriz v0.1 | G-05, G-06, G-08, G-15, G-16 |
| CAR-12 (auditoría) | Registrar inicios de sesión y cambios con usuario/fecha | Inventario de eventos, modelo de auditoría (tarea 4) | G-05, G-17 |
| Cap. 8 (permisos) | Gramática, catálogo, evaluación | Revisión de permisos, adenda R-018…R-023 | G-02, G-06, G-07, G-08, G-13 |
| Cap. 11 (auditoría) | Solo inserción, minimización, consulta admin | Modelo de auditoría (tarea 4) | G-17 |
| Cap. 12 (seguridad) | Argon2id, sesión, MFA, CSRF, cabeceras, cifrado, roles BD | `auth-v1`, ADR-0002/0003 | G-05, G-10, G-15 |
| Cap. 13 (privacidad) | Inventario PII, consentimiento, acceso auditado, supresión | Inventario PII, R-025/R-026 | G-10, G-11 |
| Cap. 14 (NFR) | 200 usuarios, RPO/RTO, WCAG, TLS | Controles (tarea 5) | — |
| Cap. 16 (CI/CD) | Escaneos, migraciones, entornos | Controles (tarea 5) | — |
| R-014 (vigencia/revocación) | Evaluar `valid_until` y revocar tokens | `auth-v1` §4/§8, ADR-0002 | G-05 |
| PA-002 (ámbito de grupo) | Guard vs dominio | ADR-0001 | G-08 |
| PA-004 (acudiente) | Sin acceso por defecto | Adenda R-021 (sin asignación) | — |
| PA-006 (gramática/catálogo) | Ratificación C0 | Revisión de permisos | G-02, G-06 |

## 7. Decisiones derivadas de esta tarea

1. La matriz de autorización se construye sobre **48 operaciones** (35 vigentes + 13 propuestas), no sobre “rutas”: una ruta con varios métodos tiene resultados distintos. Materializada en `docs/contratos/matriz-autorizacion-v1.md`.
2. Toda operación debe declarar acceso y permiso de forma legible por máquina; la prosa no es contrato.
3. Las lecturas de PII se auditan como evento de colección (con filtros) o de registro, según el caso; las lecturas propias no se auditan.
4. La ausencia de rutas de lectura en académico es un **bloqueo funcional**, no un detalle de implementación; se eleva a C0 (R-018/R-019).
5. El modelo de datos requiere dos adiciones de seguridad antes de congelarse: índice ciego de documento y soporte de identidad para MFA/contraseña (R-025/R-027).

## 8. Qué no se hizo

- No se modificó el OpenAPI, el catálogo de permisos ni el diccionario.
- No se aprobó ninguna brecha por cuenta propia: todas quedan como propuestas (R-018…R-028) para ratificación en C0.
- No se construyó todavía la matriz de autorización (tarea 3) ni el modelo de auditoría (tarea 4).
