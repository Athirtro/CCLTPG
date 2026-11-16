# Matriz de autorización v1.0 (v0.1 documental)

- **Estado:** Propuesta de Rol B para **ratificación en Compuerta 0**. Es la versión documental de la matriz; en C2 se convierte en fixture ejecutable (ver §9).
- **Fecha:** 2026-11-16
- **Responsable:** Rol B (seguridad, identidad y operación)
- **Alcance:** **48 operaciones** = 35 del contrato vigente (`api-v1.openapi.yaml` v1.0.0-propuesta) + 13 propuestas en R-018, R-019, R-021, R-024 y R-026. R-029 no añade ruta: corrige la autorización de OP-30.
- **Fuentes:** `docs/tasks/rol-b/rol-b-it0-inventario.md` (OP-01…OP-35), `docs/tasks/rol-b/rol-b-it0-revision-permisos.md`, `docs/contratos/auth-v1.md`, `docs/contratos/gramatica-y-catalogo-permisos-v1.md`, `docs/contratos/reconciliacion-c0-rol-b.md` (R-018…R-029), ADR-0001/0002/0003.
- **Regla:** la matriz asume el catálogo v1.0 **con** los cambios de R-018, R-020 y R-029. Las celdas que dependen de una resolución aún no ratificada llevan **†**; si C0 no las ratifica, la celda se recalcula y la matriz no se firma.
- **No cubre:** validaciones de negocio (400/409/422), límites de tasa (429) ni disponibilidad (503); esas respuestas son ortogonales a la autorización y pertenecen a los contratos de recurso y a `auth-v1` §8–§9.

## 1. Cómo leer la matriz

| Columna | Significado |
| --- | --- |
| **OP** | Identificador estable de la operación (coincide con el inventario; OP-36…OP-48 son propuestas). |
| **Acceso** | `público`, `parcial` (token parcial de MFA/cambio de contraseña), `parcial o sesión`, `autenticado` o `permiso`. |
| **Permiso (OR)** | Permisos que satisfacen la operación. Varios valores = semántica **OR**. El administrador los obtiene por implicación de `manage` salvo que se indique lo contrario. |
| **Ámbito** | `global`, `own`, `group` o `mixed` (ramas con ámbitos distintos; el detalle está en la propia fila). |
| **Anón. / Est. / Edu. / Adm.** | Resultado esperado con **credenciales válidas** de ese perfil: `200`, `201`, `204`, `401`, `403`, `404`, `409`. |
| **Auditoría** | Evento esperado; `—` = no se audita la lectura propia. El catálogo definitivo se cierra en la tarea 4. |

Convenciones:

1. `401` = no autenticado, token inválido/vencido/revocado o token parcial ausente.
2. `403` = autenticado **sin** el permiso requerido (`PERMISSION_DENIED`).
3. `404` = tiene el permiso, pero el recurso no existe **o está fuera de su ámbito** (`RESOURCE_NOT_FOUND`, sin revelar existencia).
4. `200/201/204` = resultado esperado del caso permitido.
5. Cada fila con ámbito `own` o `group` tiene al menos un **caso de ámbito** en §6 que produce `404`.
6. La matriz evalúa **un perfil por vez**. Un usuario con varios perfiles vigentes obtiene la **unión** (regla 5 de la gramática) y, por tanto, el resultado más permisivo de las filas aplicables.

## 2. Reglas de evaluación (normativas para C2)

| # | Regla |
| --- | --- |
| E1 | **Denegación por defecto.** Solo son públicos `POST /auth/login`, `POST /auth/mfa/verify` y `POST /auth/refresh`. Toda otra operación exige autenticación y permiso declarado; sin declaración → 403 y la prueba de contrato falla. |
| E2 | **Orden de comprobación:** sesión → estado del usuario → `debe_cambiar_password` → permiso → ámbito → validación de entrada → reglas de negocio. El primer fallo determina la respuesta. |
| E3 | **CSRF antes de la lógica.** En operaciones mutantes con sesión, un `X-CSRF-Token` ausente o inválido responde 403 `AUTH_CSRF_INVALID` aunque el permiso exista. |
| E4 | **`manage` implica las acciones del recurso** (`create`, `read`, `update`, `delete`, `export` donde exista) y, por la regla `read ⇒ read_own`, también `read_own`. Consecuencia: el administrador satisface los permisos `*_own`, pero en rutas `/me/*` el recurso propio suele no existir → **404** (o colección vacía). |
| E5 | **Ámbito propio:** el permiso se comprueba primero y la propiedad después. Elemento ajeno → 404; colección → filtrada en silencio (200). |
| E6 | **Ámbito de grupo:** el permiso se satisface solo si el usuario es el educador del grupo (o el tutor del recurso). Se evalúa en el guard y se refuerza en el dominio. Elemento fuera de grupo → 404; colección → filtrada. |
| E7 | **Ámbito global:** el administrador (`academic:*:manage`, `identity:*:manage`, `files:*:read`) **no** queda sujeto a la condición de grupo ni de propiedad. La condición de grupo aplica al perfil cuyo permiso es de ámbito restringido. |
| E8 | **`debe_cambiar_password`:** con sesión completa solo se permite `GET /me`, `POST /auth/password`, `POST /auth/logout` y `POST /auth/refresh`; el resto → 403 `AUTH_PASSWORD_CHANGE_REQUIRED`. |
| E9 | **MFA:** obligatorio para administrador, educador e identidad temporal; opcional para estudiante. Un usuario con MFA obligatorio pendiente de inscribir queda limitado al estado parcial `mfa_enrollment_required`. |
| E10 | **Token parcial:** `mfa_verify` solo sirve para `POST /auth/mfa/verify`; `mfa_enroll` solo para `POST /auth/mfa/enroll` y `/confirm`; `pwd_change` solo para `POST /auth/password`. El resto de rutas → 401 `AUTH_MFA_SESSION_INVALID` o `AUTH_PASSWORD_CHANGE_REQUIRED`. Las operaciones `partial_or_session` aceptan token parcial o sesión completa; con sesión completa se aplica CSRF y la regla E8. |
| E11 | **`X-Perfil-Activo`** solo desambigua cuando varios perfiles otorgan el permiso; nunca concede permisos; perfil no vigente o ajeno → 400 `ACTIVE_PROFILE_INVALID`. |

## 3. Declaración de contrato (extensión R-028)

Cada operación del OpenAPI debe declarar, además de `security`:

| Extensión | Tipo | Valores | Regla |
| --- | --- | --- | --- |
| `x-access` | string | `public`, `partial`, `partial_or_session`, `authenticated`, `permission` | Ninguna operación puede omitirlo. `partial` exige token parcial; `partial_or_session` acepta token parcial **o** sesión completa. |
| `x-partial-scope` | array&lt;string&gt; | `mfa_verify`, `mfa_enroll`, `pwd_change` | Obligatorio si `x-access` es `partial` o `partial_or_session`. |
| `x-permission` | array&lt;string&gt; | permisos del catálogo | Obligatorio si `x-access = permission`; OR entre elementos; `[]` en los demás casos. |
| `x-scope` | string | `global`, `own`, `group`, `mixed` | `mixed` obliga a que la fila de la matriz detalle las ramas; no se admite en operaciones nuevas sin justificación. |
| `x-audit-event` | string | evento de auditoría | `—` cuando no se audita. |
| `x-error-codes` | array&lt;string&gt; | códigos de `auth-v1` §9 | Al menos los códigos propios de la operación. |

> **Precisión sobre R-028:** `x-scope` se declara como **un solo valor** con la opción `mixed`; no se usa un arreglo paralelo a `x-permission` para evitar ambigüedad posicional. Las ramas de una operación `mixed` se documentan en la fila de la matriz y en el fixture de C2.

## 4. Matriz de operaciones vigentes (35)

### 4.1 Autenticación y sesión

| OP | Operación | Acceso | Permiso (OR) | Ámbito | Anón. | Est. | Edu. | Adm. | Auditoría |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP-01 | `POST /auth/login` | público | — | — | 200 | 200 | 200 | 200 | `sesion.iniciada` / `sesion.fallida` |
| OP-02 | `POST /auth/mfa/verify` | parcial (`mfa_verify`) | — | — | 401 | 200 | 200 | 200 | `sesion.mfa_verificada` / `sesion.mfa_fallida` |
| OP-03 | `POST /auth/refresh` | público (cookie) | — | — | 401 (sin cookie) | 200 | 200 | 200 | solo reutilización |
| OP-04 | `POST /auth/logout` | autenticado | — | — | 204 | 204 | 204 | 204 | `sesion.cerrada` |
| OP-05 | `GET /me` | autenticado | — | — | 401 | 200 | 200 | 200 | — |

Notas:

- OP-01/OP-02/OP-03: `200` presupone credenciales o token válidos; el caso negativo es 401 (`AUTH_INVALID_CREDENTIALS`, `AUTH_MFA_INVALID_CODE`, `AUTH_TOKEN_*`) y no 403.
- OP-04: **204 siempre**, incluso sin token (idempotencia). El OpenAPI actual declara 401; la corrección está en `auth-v1` §6 y R-021 (hallazgo H-03).
- OP-02: los perfiles no cambian el resultado; lo determina el token parcial.

### 4.2 Identidad

| OP | Operación | Acceso | Permiso (OR) | Ámbito | Anón. | Est. | Edu. | Adm. | Auditoría |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP-06 | `GET /identity/users` | permiso | `identity:user:manage` | global | 401 | 403 | 403 | 200 | `usuario.listado` |
| OP-07 | `POST /identity/users` | permiso | `identity:user:manage` | global | 401 | 403 | 403 | 201 | `usuario.creado` |
| OP-08 | `PATCH /identity/users/{id}` | permiso | `identity:user:manage` | global | 401 | 403 | 403 | 200 | `usuario.actualizado` |
| OP-09 | `POST /identity/users/{id}/transitions` | permiso | `identity:user:manage` | global | 401 | 403 | 403 | 200 | `usuario.<estado>` |
| OP-10 | `POST /identity/users/{id}/profiles` | permiso | `identity:user:manage` | global | 401 | 403 | 403 | 201 | `usuario.perfil_asignado` |

Notas:

- OP-08 incluye reset administrativo de contraseña (`password` write-only + `debeCambiarPassword`) y `resetMfa`; ambos exigen `identity:user:manage` y se auditan (`usuario.password_reseteada`, `usuario.mfa_reset`).
- OP-09 es la única vía de cambio de estado; el desbloqueo de cuenta es `to: activo` sobre esta operación.
- Un administrador no puede quitarse su propio último perfil: 409 de regla de negocio, no de autorización.

### 4.3 Académico

| OP | Operación | Acceso | Permiso (OR) | Ámbito | Anón. | Est. | Edu. | Adm. | Auditoría |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP-11 | `GET /academic/programs` | permiso | `academic:program:manage` | global | 401 | 403 | 403 | 200 | — |
| OP-12 | `POST /academic/programs` | permiso | `academic:program:manage` | global | 401 | 403 | 403 | 201 | `programa.creado` |
| OP-13 | `POST /academic/programs/{id}/transitions` | permiso | `academic:program:manage` | global | 401 | 403 | 403 | 200 | `programa.<estado>` |
| OP-14 | `GET /academic/groups` | permiso | `academic:group:manage` **o** `academic:group:read_own` | mixed | 401 | 403 | 200 (filtrado) | 200 (todos) | — |
| OP-15 | `POST /academic/groups` | permiso | `academic:group:manage` | global | 401 | 403 | 403 | 201 | `grupo.creado` |
| OP-16 | `POST /academic/groups/{id}/transitions` | permiso | `academic:group:manage` | global | 401 | 403 | 403 | 200 | `grupo.<estado>` |
| OP-17 | `GET /academic/students` | permiso | `academic:student:manage` | global | 401 | 403 | 403 | 200 | `estudiante.listado` |
| OP-18 | `POST /academic/students` | permiso | `academic:student:manage` | global | 401 | 403 | 403 | 201 | `estudiante.creado` |
| OP-19 | `GET /me/student` | permiso | `academic:student:read_own` | own | 401 | 200 | 403 | 404 (sin vínculo) | — |
| OP-20 | `POST /academic/enrollments` | permiso | `academic:enrollment:create` | global | 401 | 403 | 403 | 201 | `matricula.creada` |
| OP-21 | `POST /academic/enrollments/{id}/transitions` | permiso | `academic:enrollment:update` | global | 401 | 403 | 403 | 200 | `matricula.<estado>` |
| OP-22 | `GET /me/enrollments` | permiso | `academic:enrollment:read_own` | own | 401 | 200 | 200 (vacío) † | 200 (vacío) | — |
| OP-23 | `GET /me/schedule` | permiso | `academic:schedule:read_own` | own | 401 | 200 | 200 | 200 (vacío) | — |
| OP-24 | `POST /academic/sessions` | permiso | `academic:session:create` | group | 401 | 403 | 201 (propio) / 404 (ajeno) | 201 | `clase.creada` |
| OP-25 | `POST /academic/sessions/{id}/transitions` | permiso | `academic:session:update` | group | 401 | 403 | 200 (propio) / 404 (ajeno) | 200 | `clase.<estado>` |
| OP-26 | `PUT /academic/sessions/{id}/attendance` | permiso | `academic:attendance:create` | group | 401 | 403 | 200 (propio) / 404 (ajeno) | 200 | `asistencia.registrada` |
| OP-27 | `POST /academic/evaluations` | permiso | `academic:evaluation:create` | group | 401 | 403 | 201 (propio) / 404 (ajeno) | 201 | `evaluacion.registrada` |
| OP-28 | `GET /me/evaluations` | permiso | `academic:evaluation:read_own` | own | 401 | 200 | 200 (vacío) | 200 (vacío) | — |

Notas:

- OP-14: el educador recibe la colección **filtrada** a sus grupos; no hay 404 porque es una colección.
- OP-19: el estudiante sin fila vinculada recibe 404 `RESOURCE_NOT_FOUND` (R-026). El administrador también (E4). Un educador con perfil de estudiante obtiene el resultado de la unión.
- OP-22: † el educador recibe `academic:enrollment:read` en R-018, que implica `read_own`; la colección es la suya (normalmente vacía). Sin R-018, la celda pasa a 403.
- OP-24/25/26/27: el educador solo opera sobre grupos donde `grupo.educador_id = sub`; otro grupo → 404. El administrador es global (E7).
- OP-26: `PUT` exige `academic:attendance:create` (estado resultante completo, R-010); `attendance:update` se reserva para correcciones en C4.

### 4.4 Archivos, notificaciones y auditoría

| OP | Operación | Acceso | Permiso (OR) | Ámbito | Anón. | Est. | Edu. | Adm. | Auditoría |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP-29 | `POST /files` | permiso | `files:document:create` | global | 401 | 403 | 201 | 201 | `archivo.subido` |
| OP-30 | `GET /files/{id}/download` | permiso | `files:document:read` **o** `files:document:read_own` | mixed | 401 | 200 (propio) / 404 (ajeno) | 200 (propio) † / 404 (ajeno) | 200 (cualquiera) | `archivo.descargado` |
| OP-31 | `GET /notifications` | permiso | `notifications:notification:read_own` | own | 401 | 200 | 200 | 200 | — |
| OP-32 | `PATCH /notifications/{id}` | permiso | `notifications:notification:update_own` † | own | 401 | 200 | 200 | 200 | — |
| OP-33 | `GET /notifications/preferences` | permiso | `notifications:preference:read_own` † | own | 401 | 200 | 200 | 200 | — |
| OP-34 | `PUT /notifications/preferences` | permiso | `notifications:preference:update_own` | own | 401 | 200 | 200 † | 200 † | `preferencia.actualizada` |
| OP-35 | `GET /audit/events` | permiso | `audit:event:read` | global | 401 | 403 | 403 | 200 | `auditoria.consultada` |

Notas:

- OP-30: † el educador no tiene hoy permiso de lectura de archivos (solo `create`), por lo que no podría descargar el material que sube. Se propone R-029 (`files:document:read_own` para educador); sin ratificación, la celda es **403**. El estudiante conserva `read_own` inerte en v1.0 (B-07).
- OP-32/33: † dependen de R-020 (permisos nuevos `notification:update_own` y `preference:read_own`); sin R-020 la operación no es autorizable correctamente y la matriz no se firma.
- OP-34: † educador y administrador reciben `preference:update_own` en R-020; el estudiante ya lo tenía.
- OP-35: la consulta de auditoría se audita a sí misma (meta-auditoría) con los filtros aplicados y sin PII de terceros.

## 5. Matriz de operaciones propuestas (13) — pendientes de ratificación C0

> Todas las filas de esta sección son **propuestas** (R-018, R-019, R-021, R-024 y R-026). No existen en el OpenAPI vigente; se incorporan a la matriz para que C0 decida con el contrato completo a la vista. R-029 no añade rutas: corrige la autorización de OP-30.

### 5.1 Lecturas académicas (R-018, R-019)

| OP | Operación | Acceso | Permiso (OR) | Ámbito | Anón. | Est. | Edu. | Adm. | Auditoría |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP-36 | `GET /academic/enrollments` | permiso | `academic:enrollment:read` | group | 401 | 403 | 200 (filtrado) | 200 (todos) | — |
| OP-37 | `GET /academic/groups/{id}/sessions` | permiso | `academic:group:manage` **o** `academic:group:read_own` | mixed | 401 | 403 | 200 (propio) / 404 (ajeno) | 200 | — |
| OP-38 | `GET /academic/sessions/{id}` | permiso | `academic:group:manage` **o** `academic:group:read_own` | mixed | 401 | 403 | 200 (propio) / 404 (ajeno) | 200 | — |
| OP-39 | `GET /academic/sessions/{id}/attendance` | permiso | `academic:attendance:read` | group | 401 | 403 | 200 (propio) / 404 (ajeno) | 200 | — |
| OP-40 | `GET /academic/evaluations` | permiso | `academic:evaluation:read` | group | 401 | 403 | 200 (filtrado) | 200 (todos) | — |
| OP-41 | `PATCH /academic/evaluations/{id}` | permiso | `academic:evaluation:update` | group | 401 | 403 | 200 (propio) / 404 (ajeno) | 200 | `evaluacion.actualizada` |

Notas:

- OP-36: respuesta minimizada (`id`, `estado`, `periodo`, `grupoId`, `estudiante { id, nombres, apellidos }`); sin documento, contacto ni dirección. El educador solo ve matrículas de sus grupos.
- OP-37/38: se usa `academic:group:read_own` (no un permiso nuevo) para el educador; el administrador lo satisface por `manage`.
- OP-39: lectura de asistencia; el estudiante consulta la suya por `/me`, no por esta ruta (403).
- OP-40: colección filtrada por grupo/periodo; el estudiante usa `/me/evaluations`.

### 5.2 Autenticación ampliada (R-021)

| OP | Operación | Acceso | Permiso (OR) | Ámbito | Anón. | Est. | Edu. | Adm. | Auditoría |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP-42 | `POST /auth/mfa/enroll` | parcial o sesión (`mfa_enroll`) | — | — | 401 | 200 | 200 | 200 | — |
| OP-43 | `POST /auth/mfa/enroll/confirm` | parcial o sesión (`mfa_enroll`) | — | — | 401 | 200 | 200 | 200 | `usuario.mfa_inscrita` |
| OP-44 | `POST /auth/mfa/recovery-codes` | autenticado | — | own | 401 | 200 | 200 | 200 | `usuario.mfa_recovery_regenerada` |
| OP-45 | `POST /auth/password` | parcial o sesión (`pwd_change`) | — | own | 401 | 200/204 | 200/204 | 200/204 | `usuario.password_cambiada` |

Notas:

- OP-42: `409 AUTH_MFA_ALREADY_ENABLED` si el usuario ya tiene MFA; el estudiante puede inscribirse voluntariamente **con su sesión completa**, sin pasar por un token parcial. El token parcial `mfa_enroll` se usa cuando el login quedó en `mfa_enrollment_required`.
- OP-43: devuelve tokens completos y los 10 códigos de recuperación una sola vez.
- OP-44: exige TOTP o código de recuperación válido (que se consume) y CSRF; `409 AUTH_MFA_NOT_ENABLED` si no tiene MFA.
- OP-45: con sesión completa responde 204 (conserva la familia actual); con token parcial `pwd_change` responde 200 con el siguiente estado (`mfa_required`, `mfa_enrollment_required` o `authenticated`).

### 5.3 Horarios y vínculo estudiante–usuario (R-024, R-026)

| OP | Operación | Acceso | Permiso (OR) | Ámbito | Anón. | Est. | Edu. | Adm. | Auditoría |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP-46 | `GET /academic/groups/{id}/schedule` | permiso | `academic:group:manage` **o** `academic:schedule:read` **o** `academic:schedule:read_own` | mixed | 401 | 200 (matriculado) / 404 (no) | 200 (propio) / 404 (ajeno) | 200 | — |
| OP-47 | `PUT /academic/groups/{id}/schedule` | permiso | `academic:group:manage` | global | 401 | 403 | 403 | 200 | `horario.modificado` |
| OP-48 | `PATCH /academic/students/{id}` | permiso | `academic:student:manage` | global | 401 | 403 | 403 | 200 | `estudiante.actualizado` |

Notas:

- OP-46 se implementa en C4 (PA-013); el estudiante solo accede al horario de grupos donde tiene matrícula vigente.
- OP-47 valida solapamiento por educador y salón; notifica `horario.modificado`.
- OP-48 permite vincular `usuarioId` (R-026) y editar datos; el cambio de documento exige recalcular el índice ciego.

## 6. Casos de ámbito (denegación 404)

Cada fila es un caso negativo obligatorio del fixture de C2: el permiso existe, pero el recurso está fuera de ámbito y la respuesta debe ser **404 `RESOURCE_NOT_FOUND`** (nunca 403, para no revelar existencia).

| # | Operación | Sujeto | Recurso | Esperado |
| --- | --- | --- | --- | --- |
| A-01 | OP-19 `GET /me/student` | Estudiante sin `usuario_id` vinculado | — | 404 |
| A-02 | OP-24 `POST /academic/sessions` | Educador A | Grupo de educador B | 404 |
| A-03 | OP-25 `POST …/sessions/{id}/transitions` | Educador A | Sesión de grupo de B | 404 |
| A-04 | OP-26 `PUT …/sessions/{id}/attendance` | Educador A | Sesión de grupo de B | 404 |
| A-05 | OP-27 `POST /academic/evaluations` | Educador A | Matrícula de grupo de B | 404 |
| A-06 | OP-30 `GET /files/{id}/download` | Estudiante / Educador (con R-029) | Archivo subido por otro | 404 |
| A-07 | OP-32 `PATCH /notifications/{id}` | Cualquier perfil | Notificación de otro usuario | 404 |
| A-08 | OP-37 `GET …/groups/{id}/sessions` | Educador A | Grupo de B | 404 |
| A-09 | OP-38 `GET /academic/sessions/{id}` | Educador A | Sesión de grupo de B | 404 |
| A-10 | OP-39 `GET …/sessions/{id}/attendance` | Educador A | Sesión de grupo de B | 404 |
| A-11 | OP-41 `PATCH /academic/evaluations/{id}` | Educador A | Evaluación de grupo de B | 404 |
| A-12 | OP-46 `GET …/groups/{id}/schedule` | Estudiante no matriculado | Horario del grupo | 404 |
| A-13 | OP-46 `GET …/groups/{id}/schedule` | Educador A | Grupo de B | 404 |
| A-14 | OP-05/19/22/23/28 (`/me/*`) | Administrador | Recurso personal inexistente | 404 en rutas de elemento; 200 vacío en colecciones |

> A-06 presupone R-029 ratificada; sin ella, el educador recibe **403** (no tiene permiso de lectura), no 404.

Casos de **colección filtrada** (200, nunca 404): OP-14, OP-22, OP-23, OP-28, OP-31, OP-36, OP-40. La respuesta no revela el total de elementos ajenos.

## 7. Cobertura y criterios de verificación (C0)

| Verificación | Resultado |
| --- | --- |
| Operaciones en el contrato vigente | 35 |
| Operaciones propuestas incluidas | 13 |
| Operaciones en la matriz | **48** |
| Operaciones sin acceso declarado | **0** |
| Operaciones con permiso sin operación | 0 bloqueantes (los reservados están en R-022 con compuerta) |
| Operaciones `own`/`group`/`mixed` sin caso de ámbito | **0** |
| Filas dependientes de resoluciones sin ratificar | 5 (`OP-22`, `OP-30`, `OP-32`, `OP-33`, `OP-34`, marcadas †); las 13 operaciones propuestas dependen íntegramente de R-018/R-019/R-021/R-024/R-026 |
| Perfiles cubiertos | Estudiante, Educador, Administrador (+ anónimo) |

Criterios de aceptación de la matriz:

1. Toda fila tiene acceso, permiso (o `—` justificado), ámbito y los cuatro resultados por perfil.
2. Toda fila `own`/`group`/`mixed` tiene al menos un caso 404 en §6 o una nota de colección filtrada.
3. Las celdas † se resuelven en C0; si una resolución cae, la matriz se recalcula antes de firmar.
4. En C2, el fixture (§9) se genera desde las extensiones `x-*` del OpenAPI y se compara con esta matriz; cualquier divergencia rompe CI.
5. La prueba de denegación por defecto recorre el OpenAPI y falla si una operación no declara `x-access`.

## 8. Hallazgos al construir la matriz

| ID | Hallazgo | Impacto | Resolución propuesta |
| --- | --- | --- | --- |
| H-01 | El educador puede subir archivos pero no descargarlos: no tiene `files:document:read` ni `read_own`. | Alto (funcional: material didáctico inaccesible) | **R-029**: asignar `files:document:read_own` al educador (propio = `archivo.subido_por`). Sin ratificar, OP-30 es 403 para educador. |
| H-02 | `manage ⇒ read ⇒ read_own` hace que el administrador satisfaga todos los permisos `*_own`. | Bajo (sin fuga: `/me/*` devuelve lo propio o 404/vacío) | Se acepta y se documenta (E4); no se añade excepción al motor de permisos. |
| H-03 | El OpenAPI declara 401 en `POST /auth/logout`, pero la idempotencia exige 204 sin token. | Medio (contrato inconsistente; el cliente trataría como error un caso normal) | R-021: corregir a 204 en el OpenAPI. |
| H-04 | `files:document:read_own` del estudiante es inerte en v1.0 (no puede subir y no hay vínculo documental). | Bajo (permiso sin efecto) | Se mantiene reservado; vínculo documental en C3/C6 (B-07). |
| H-05 | El educador no tiene `academic:enrollment:read_own` hasta que se ratifique R-018; la matriz depende de ello para OP-22. | Medio (dependencia de ratificación) | Ratificar R-018 en C0; si no, recalcular OP-22 a 403. |
| H-06 | `GET /academic/groups` mezcla ámbitos (`manage` global y `read_own` propio) en una sola operación. | Bajo (legible con `x-scope: mixed`) | Declarar `mixed` y probar ambas ramas (OP-14). |
| H-07 | Colisión de nombres: `sesion.*` se usaba para la sesión de autenticación y para la sesión de clase. | Medio (eventos de auditoría ambiguos) | Las sesiones de clase usan `clase.*` y `recurso = clase`; se corrigen inventario y matriz. Ver `modelo-auditoria-v1` §3. |

## 9. Fixture ejecutable para C2

Formato mínimo por fila (una fila = un caso):

```yaml
- id: A-02
  operationId: createSession
  profile: educador
  activeProfile: educador
  scope: group
  request:
    method: POST
    path: /academic/sessions
    body: { groupId: "<grupo-de-otro-educador>", ... }
    headers: { Authorization: "Bearer <token-educador-A>" }
  expect: { status: 404, code: RESOURCE_NOT_FOUND }
  audit: { event: null }
- id: OP-24-ok
  operationId: createSession
  profile: educador
  activeProfile: educador
  scope: group
  request:
    method: POST
    path: /academic/sessions
    body: { groupId: "<grupo-propio>", ... }
    headers: { Authorization: "Bearer <token-educador-A>", "Idempotency-Key": "<uuid>" }
  expect: { status: 201 }
  audit: { event: clase.creada }
```

Reglas del fixture:

1. Se genera desde `x-access`, `x-permission`, `x-scope` y `x-audit-event`; la matriz documental es la referencia humana, no la fuente.
2. Cada operación tiene **al menos** un caso permitido y uno denegado por perfil aplicable.
3. Los casos de §6 se incluyen con identificadores estables (A-01…A-14).
4. Los datos semilla son deterministas (Testcontainers + fixtures versionados).
5. La prueba verifica también el **código** de error, no solo el estado HTTP.

## 10. Qué no se hizo

- No se modificó el OpenAPI ni el catálogo: la matriz es documental y las rutas propuestas siguen pendientes de ratificación C0.
- No se implementaron guards, pruebas ni fixtures (C2).
- No se fijó el catálogo definitivo de eventos de auditoría (tarea 4).
- No se cubrieron respuestas de validación, idempotencia ni límites de tasa, salvo donde afectan a la autorización.
