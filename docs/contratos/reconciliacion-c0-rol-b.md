# Adenda de reconciliación C0 — Seguridad, identidad y contratos (Rol B)

- **Estado:** Propuesta de Rol B para **ratificación en Compuerta 0**. Complementa `docs/contratos/reconciliacion-c0.md` (R-001…R-017) sin reemplazarlo.
- **Fecha:** 2026-11-16
- **Fuentes:** `docs/contratos/auth-v1.md`, ADR-0001/0002/0003, `docs/tasks/rol-b/rol-b-it0-inventario.md`, `docs/tasks/rol-b/rol-b-it0-revision-permisos.md`, `docs/contratos/api-v1.openapi.yaml`, `docs/diseno-arquitectonico.md` (caps. 8–13), `docs/diccionario-datos.md`.
- **Regla:** no se modifican artefactos congelados ni documentos de otros roles; las resoluciones se aplican cuando el equipo las ratifique y Rol C/A formalicen los artefactos de su propiedad.

## 1. Resoluciones propuestas

| ID | Tema | Hallazgo / fuente | Decisión propuesta | Artefactos impactados | Formalización |
| --- | --- | --- | --- | --- | --- |
| R-018 | Roster y matrículas del educador | B-01, G-02 | Asignar `academic:enrollment:read` al perfil **Educador** con ámbito de grupo. Añadir `GET /academic/enrollments` con filtros `groupId`, `periodo`, `estado`, paginación; el administrador lo obtiene por `academic:*:manage`. Respuesta mínima: `id`, `estado`, `periodo`, `grupoId`, `estudiante { id, nombres, apellidos }`; sin documento, contacto ni dirección. Colecciones filtradas por grupos propios. | Catálogo (asignación), OpenAPI, matriz | C0 |
| R-019 | Rutas de lectura académica | B-04, G-01/G-03/G-04 | Añadir: `GET /academic/groups/{id}/sessions` (`academic:group:read_own` o `manage`, ámbito grupo); `GET /academic/sessions/{id}` (mismo permiso); `GET /academic/sessions/{id}/attendance` (`academic:attendance:read`); `GET /academic/evaluations` (`academic:evaluation:read`, filtros grupo/matrícula/periodo); `PATCH /academic/evaluations/{id}` (`academic:evaluation:update`). Indicadores: CRUD en C4 con `academic:indicator:manage`. Sin permisos nuevos; se activan los existentes. | OpenAPI, matriz | C0 (rutas) / C4–C5 (implementación) |
| R-020 | Semántica y asignación de notificaciones | B-02/B-03, G-06, D13 | Añadir al catálogo `notifications:notification:update_own` y `notifications:preference:read_own`. Asignar a **Estudiante, Educador y Administrador**: `notifications:notification:read_own`, `notifications:notification:update_own`, `notifications:preference:read_own` y `notifications:preference:update_own` (el estudiante ya tenía esta última). `PATCH /notifications/{id}` usa `notification:update_own`; `GET /notifications/preferences` usa `preference:read_own`; `PUT` usa `preference:update_own`. Eventos críticos no silenciables: `matricula.creada`, `matricula.confirmada`, `matricula.cancelada`, `horario.modificado`, `evaluacion.publicada`; el servidor fuerza `habilitado=true` y devuelve el valor efectivo. | Catálogo, asignaciones, OpenAPI, matriz, catálogo de notificaciones | C0 |
| R-021 | Contrato de autenticación v1.0 | B-05, G-05/G-14/G-15 | Adoptar `docs/contratos/auth-v1.md`: estados de login (`authenticated`, `password_change_required`, `mfa_required`, `mfa_enrollment_required`); rutas `POST /auth/mfa/enroll`, `/auth/mfa/enroll/confirm`, `/auth/mfa/recovery-codes`, `/auth/password`; `/me` con permisos expandidos y flags; access JWT 15 min + denylist; refresh opaco rotativo 7 días; CSRF de doble envío; logout idempotente 204; límites y bloqueo; 22 códigos de error estables (16 de autenticación + 6 comunes). | OpenAPI, matriz, C2 | C0 |
| R-022 | Alcance de implicaciones y permisos reservados | B-06, G-07 | `manage` implica solo acciones **definidas para ese recurso**; `export` solo donde exista operación de exportación (ninguna en v1.0). Todo permiso sin operación debe declararse **reservado** con compuerta de activación o retirarse: `identity:profile:read/update` (C2), `identity:temporary-identity:manage` (sin asignar hasta PA-004), `academic:schedule:read` (C4), `academic:enrollment:delete` (reservado; cancelación/retiro por transición), `academic:attendance:update` (C4), `academic:indicator:manage` (C4), `exports`/`analytics` (C6). | Catálogo (semántica), trazabilidad | C0 |
| R-023 | Resolución de propiedad y ámbito | B-07, G-08 | Tabla vinculante (ver §2). `actor_perfil` = perfil que otorgó el permiso; `X-Perfil-Activo` opcional solo desambigua (prioridad administrador > educador > estudiante). Permiso ausente → 403 `PERMISSION_DENIED`; recurso fuera de ámbito → 404 `RESOURCE_NOT_FOUND`; colecciones → filtradas en silencio. | Matriz, `auth-v1`, guard (C2), módulos (C4) | C0 (criterio) / C2–C4 |
| R-024 | Horarios como subrecurso de grupo | G-09, PA-013 | `horario_grupo` se gestiona como subrecurso de `grupo`: `GET`/`PUT /academic/groups/{id}/schedule` con `academic:group:manage`; lecturas con `academic:schedule:read` (admin) o `read_own` (educador/estudiante). Endpoints e implementación en C4; validación de solapamiento por educador y salón; notificación `horario.modificado`. | OpenAPI, modelo, C4 | C0 (decisión) / C4 |
| R-025 | Cifrado de documento e índice ciego | G-10, ADR-0003 | `academic.estudiante.numero_documento` pasa a ciphertext AES-256-GCM (`v1:<kid>:…`) y se añade `numero_documento_hash` (HMAC-SHA256, único) para igualdad y duplicados; `direccion` y `telefono` cifrados; `email` en claro por ser login, tratado como PII con controles compensatorios (excepción documentada a “contacto”; si el equipo no la acepta, se cifra con `email_hash` antes de C2). Sin búsqueda parcial ni ordenamiento por documento. | Diccionario, migraciones, OpenAPI, matriz | C0 (modelo) / C2–C4 |
| R-026 | Vínculo estudiante–usuario | G-11 | `estudiante.usuario_id` nulo permitido y único cuando existe (índice parcial). `POST /academic/students` acepta `usuarioId` opcional; `GET /me/student` responde 404 `RESOURCE_NOT_FOUND` si no hay vínculo; el vínculo se gestiona con `PATCH /academic/students/{id}` (`academic:student:manage`) en C4. No se crea cuenta automáticamente. | Diccionario, OpenAPI, C4 | C0 (modelo) / C4 |
| R-027 | Modelo de identidad para MFA y contraseña | B-05, G-05 | Añadir `usuario.debe_cambiar_password` (bool, default false) y `usuario.password_actualizado_en` (timestamptz); crear `public.codigo_recuperacion_mfa` (`id`, `usuario_id`, `codigo_hash`, `usado_en`, `creado_en`, índice `(usuario_id, usado_en)`). Los códigos se almacenan con Argon2id, son de un solo uso y se regeneran en bloque. | Diccionario, migraciones, C2 | C0 (modelo) / C2 |
| R-028 | Contrato legible por máquina | B-08, G-13/G-16 | Añadir a cada operación `x-access` (valores `public`, `partial`, `partial_or_session`, `authenticated`, `permission`), `x-partial-scope` (scopes parciales aceptados: `mfa_verify`, `mfa_enroll`, `pwd_change`), `x-permission` (arreglo, OR), `x-scope` (valores `global`, `own`, `group`, `mixed`) y `x-audit-event`; `x-error-codes` en respuestas de error. `x-access: partial_or_session` cubre las operaciones que aceptan token parcial o sesión completa (inscripción MFA voluntaria y cambio de contraseña). `x-scope` es un valor único; `mixed` exige detallar las ramas en la matriz. CI verifica que toda operación declare acceso y permiso y que la matriz se genere desde el mismo origen. | OpenAPI, CI (C1), matriz | C0 (extensión) / C1 (verificación) |
| R-029 | Descarga de archivos por el educador | H-01 (matriz), B-07 | Asignar `files:document:read_own` al perfil **Educador**, con propiedad `archivo.subido_por = sub` en v1.0. Sin este permiso el educador puede subir material pero no descargarlo. Al estudiante se le mantiene el permiso, inerte hasta que exista vínculo documental (C3/C6); el administrador conserva `files:*:read`. | Catálogo (asignación), OpenAPI, matriz | C0 |
| R-030 | Modelo de auditoría consultable por recurso | `modelo-auditoria-v1` §2, ADR-0004, H-07 | `recurso` pasa a ser el **tipo** de recurso; se añade `recurso_id` (uuid, nulo en colecciones) e índices `(recurso, recurso_id, ocurrido_en)`, `(accion, ocurrido_en)` y `(request_id)`. Se documenta `actor_perfil` como perfil que otorgó el permiso. Las sesiones de clase usan `clase.*` y `recurso = clase` para no colisionar con `sesion.*` de autenticación. Sin otras columnas (sin cadena de hashes; PA-016). | Diccionario, migraciones (C2), OpenAPI, matriz | C0 (modelo) / C2 |
| R-031 | Catálogo de eventos como contrato | `modelo-auditoria-v1` §3, AC-AUD-13 | El catálogo de eventos de auditoría es la fuente única: `x-audit-event` debe existir en el catálogo y todo evento obligatorio debe estar referenciado por al menos una operación. CI valida ambos sentidos (C1/C2). Un evento nuevo exige actualizar el catálogo y la matriz. | OpenAPI, catálogo, CI | C0 (contrato) / C1 (verificación) |

## 2. Tabla de propiedad y ámbito (R-023)

| Permiso / caso | Condición de servidor |
| --- | --- |
| `academic:student:read_own` | `estudiante.usuario_id = sub` |
| `academic:enrollment:read_own` | `matricula.estudiante_id → estudiante.usuario_id = sub` |
| `academic:evaluation:read_own` | `evaluacion.matricula_id → matricula.estudiante_id → estudiante.usuario_id = sub` |
| `academic:schedule:read_own` (estudiante) | `horario.grupo_id` de un grupo con matrícula `confirmada` o `activa` del estudiante |
| `academic:group:read_own` | `grupo.educador_id = sub` |
| `academic:schedule:read_own` (educador) | `horario.grupo_id → grupo.educador_id = sub` |
| `academic:session:create/update`, `attendance:create/read/update`, `evaluation:create/read/update` | `sesion.grupo_id → grupo.educador_id = sub` o `matricula.grupo_id → grupo.educador_id = sub` |
| `academic:enrollment:read` (educador, R-018) | `matricula.grupo_id → grupo.educador_id = sub` |
| `notifications:notification:*_own`, `preference:*_own` | `usuario_id = sub` |
| `files:document:read_own` | `archivo.subido_por = sub` en v1.0; el vínculo documental se define en C3/C6 |
| `identity:*` | Ámbito global; solo administrador (MFA obligatorio) |
| Perfil sin permiso aplicable | 403 `PERMISSION_DENIED` |
| Recurso de otro usuario/grupo | 404 `RESOURCE_NOT_FOUND` |
| Colección con elementos ajenos | Se filtran; no se revela el total ajeno |

## 3. Cambios de catálogo solicitados (resumen)

| Cambio | Permiso | Perfil(es) | Fuente |
| --- | --- | --- | --- |
| Asignación | `academic:enrollment:read` | Educador (ámbito grupo) | R-018 |
| Nuevo | `notifications:notification:update_own` | Estudiante, Educador, Administrador | R-020 |
| Nuevo | `notifications:preference:read_own` | Estudiante, Educador, Administrador | R-020 |
| Asignación | `notifications:preference:update_own` | Educador, Administrador | R-020 |
| Asignación | `files:document:read_own` | Educador (propio = `subido_por`) | R-029 |
| Reservado | `identity:temporary-identity:manage` | Sin asignación hasta PA-004 | R-022 |
| Reservado | `academic:enrollment:delete` | Sin operación; cancelación por transición | R-022 |

## 4. Impacto en artefactos

| Artefacto | Cambio requerido | Responsable |
| --- | --- | --- |
| `docs/contratos/gramatica-y-catalogo-permisos-v1.md` | Añadir dos permisos y asignaciones; nota de reservados | Rol C |
| `docs/contratos/api-v1.openapi.yaml` | Rutas nuevas, esquemas de auth, `x-*`, `429`/`503`, `cookieAuth`, CSRF | Rol C |
| `docs/diccionario-datos.md` | Documento cifrado + hash, `debe_cambiar_password`, `password_actualizado_en`, `codigo_recuperacion_mfa`, índices; `recurso_id` e índices de auditoría (R-030) | Rol A |
| `docs/contratos/matriz-autorizacion-v1.md` | Construida: 48 operaciones (35 vigentes + 13 propuestas), con ámbitos y casos 404 | Rol B (hecho) |
| `docs/contratos/modelo-auditoria-v1.md` | Construido: modelo, catálogo de 59 eventos (58 obligatorios + 1 opcional), redacción, inmutabilidad y consulta | Rol B (hecho) |
| `docs/contratos/controles-seguridad-v1.md` | Construido: 46 controles con verificación y compuerta | Rol B (hecho) |
| `docs/requirements/seguridad.md` | Construido: 33 criterios CAR-07 y 15 de CAR-12 | Rol B (hecho) |
| `docs/open-questions.md` | PA-009…PA-016 | Rol B |
| `docs/assumptions.md` | SUP-012/SUP-013 | Rol B |
| CI (C1) | Validación de `x-*`, catálogo de eventos (R-031), matriz generada, pruebas permitido/denegado | Rol B |

## 5. Pendientes que siguen bloqueando C0

- Ratificación explícita de R-018, R-019, R-020, R-021, R-028, R-029, R-030 y R-031 (cambios de catálogo, rutas, contrato y modelo de auditoría).
- Aceptación de R-022…R-027 y actualización del diccionario por Rol A antes de congelar el modelo v1.
- **Matriz v0.1:** publicada en `docs/contratos/matriz-autorizacion-v1.md`; 5 celdas marcadas † dependen de las ratificaciones anteriores. Si R-018, R-020 o R-029 caen, la matriz se recalcula antes de firmar.
- **Auditoría:** `modelo-auditoria-v1.md` y ADR-0004 listos; requieren la actualización del diccionario (R-030) y la ratificación del catálogo de eventos (R-031).
- PA-004 (acudiente) sigue bloqueante antes de C2; no se asigna `identity:temporary-identity:manage`.
- PA-014 (separación de funciones), PA-015 (gracia de refresh) y PA-016 (sellado de auditoría) con valor por defecto; no bloquean C0.
