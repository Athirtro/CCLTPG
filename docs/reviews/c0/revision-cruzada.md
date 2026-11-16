# Revisión cruzada C0 — Seguridad ↔ modelo de datos ↔ contratos

- **Estado:** Observaciones de Rol B para **Rol A** (modelo y diccionario) y **Rol C** (catálogo y OpenAPI); requiere respuesta de cada rol y cierre en Compuerta 0.
- **Fecha:** 2026-11-16
- **Revisor:** Rol B (seguridad, identidad y operación)
- **Artefactos revisados:** `docs/diccionario-datos.md`; `docs/contratos/api-v1.openapi.yaml`; `docs/contratos/gramatica-y-catalogo-permisos-v1.md`; `docs/tasks/rol-a/rol-a-it0-revision-modelo.md`; `docs/contratos/reconciliacion-c0.md`; `docs/contratos/reconciliacion-c0-rol-b.md`; `docs/contratos/auth-v1.md`; `docs/contratos/matriz-autorizacion-v1.md`; `docs/contratos/modelo-auditoria-v1.md`; ADR-0001…ADR-0004.
- **Regla:** esta revisión no modifica los artefactos de otros roles. Cada hallazgo tiene un dueño, una corrección concreta y un criterio de aceptación; se cierra cuando el dueño aplica el cambio o responde con una objeción fundamentada que el equipo ratifique.

## 1. Resumen

| Resultado | Cantidad |
| --- | --- |
| Hallazgos bloqueantes para congelar C0 | 8 (4 de Rol A, 4 de Rol C) |
| Hallazgos no bloqueantes (mejora o aclaración) | 7 |
| Contradicciones entre documentos vigentes | 5 |
| Objeciones a decisiones de Rol B | 0 (no se recibieron todavía) |

**Veredicto de Rol B:** el modelo y los contratos **no se pueden congelar** en su estado actual. Las resoluciones R-018…R-031 están completas y son internamente consistentes, pero todavía no están reflejadas en el diccionario (Rol A) ni en el catálogo/OpenAPI (Rol C). Los hallazgos RC-A-01/02/03/04 y RC-C-01/02/03/04 son condición de firma.

## 2. Hallazgos para Rol A (diccionario y modelo)

### 2.1 Bloqueantes

| ID | Hallazgo | Fuente | Corrección solicitada | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| **RC-A-01** | `academic.estudiante.numero_documento` figura como `text` **único**; contradice el cifrado AES-256-GCM (un ciphertext con nonce distinto no permite unicidad ni igualdad). | R-025, ADR-0003, `controles-seguridad-v1` C-21/C-22 | Cambiar a `ciphertext` (`v1:<kid>:…`), quitar la restricción única directa y añadir `numero_documento_hash` (HMAC-SHA256, único, normalizado). Reemplazar el índice `estudiante(numero_documento)` por `estudiante(numero_documento_hash)`. | Tabla e índice actualizados; el diccionario declara que no hay búsqueda parcial ni ordenamiento por documento. |
| **RC-A-02** | `public.evento_auditoria` no tiene `recurso_id`; `recurso` sigue descrito como texto libre y los índices no permiten consultar el historial de un registro. | R-030, ADR-0004 §2 | Añadir `recurso_id` (uuid, nulo en colecciones), documentar `recurso` como **tipo** y `actor_perfil` como perfil que otorgó el permiso; añadir índices `(recurso, recurso_id, ocurrido_en)`, `(accion, ocurrido_en)` y `(request_id)`. | Tabla e índices del §4 actualizados; el catálogo de eventos (R-031) queda enlazado como fuente de valores de `recurso`/`accion`. |
| **RC-A-03** | Faltan columnas y tabla del modelo de identidad: `usuario.debe_cambiar_password`, `usuario.password_actualizado_en` y `public.codigo_recuperacion_mfa`. | R-021/R-027, `auth-v1` §2 | Añadir las dos columnas a `public.usuario` y la tabla `public.codigo_recuperacion_mfa` (`id`, `usuario_id`, `codigo_hash`, `usado_en`, `creado_en`) con índice `(usuario_id, usado_en)`. Declarar que los códigos se almacenan con Argon2id y son de un solo uso. | Diccionario actualizado; sin FK a `usuario` se documenta como referencia lógica si se mantiene la convención del esquema. |
| **RC-A-04** | `academic.estudiante.usuario_id` está como “Sí/No” sin regla; no se puede implementar el vínculo único opcional ni el 404 de `/me/student`. | R-026 | Declarar **nulo permitido** y **único cuando existe** (índice parcial), con referencia lógica a `public.usuario`. | Regla explícita en la fila y en el §4 de índices. |

### 2.2 No bloqueantes

| ID | Hallazgo | Corrección sugerida |
| --- | --- | --- |
| RC-A-05 | `public.usuario.email` no declara su tratamiento como PII ni la excepción de `email` en claro. | Añadir nota: identificador de login, PII con controles compensatorios (ADR-0003/R-025); si el equipo rechaza la excepción, `email_hash` antes de C2. |
| RC-A-06 | `public.archivo.subido_por` existe y soporta R-029, pero el diccionario no lo relaciona con la regla de propiedad. | Añadir nota “propiedad de `files:document:read_own` en v1.0 (R-029)”. |
| RC-A-07 | `public.preferencia_notificacion` no fija la unicidad ni la regla de no silenciabilidad. | Aplicar R-009/R-020: única por `(usuario_id, evento, canal)`; `habilitado=true` forzado para eventos críticos. |
| RC-A-08 | Las referencias cruzadas (`grupo.educador_id`, `estudiante.usuario_id`, `archivo.subido_por`) no tienen tipo ni nulabilidad homogéneos. | Documentar tipo `uuid` y nulabilidad en cada referencia lógica. |

## 3. Hallazgos para Rol C (catálogo y OpenAPI)

### 3.1 Bloqueantes

| ID | Hallazgo | Fuente | Corrección solicitada | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| **RC-C-01** | El catálogo no incluye `notifications:notification:update_own` ni `notifications:preference:read_own`, y no asigna los permisos corregidos al Educador/Administrador. | R-020 | Añadir los dos permisos y las asignaciones de R-020 a Estudiante, Educador y Administrador; documentar los eventos críticos no silenciables. | Catálogo actualizado; matriz y OpenAPI pueden referenciar los permisos sin excepciones. |
| **RC-C-02** | El catálogo no asigna `academic:enrollment:read` al Educador ni `files:document:read_own` (el Educador solo tiene `files:document:create`). | R-018, R-029 | Asignar `academic:enrollment:read` (ámbito grupo) y `files:document:read_own` (propiedad `subido_por`) al Educador. | Asignaciones visibles en la tabla por perfil; sin permisos nuevos fuera de R-018/R-020/R-029. |
| **RC-C-03** | El OpenAPI no declara `x-access`, `x-permission`, `x-scope`, `x-audit-event` ni `x-error-codes`; las 35 operaciones siguen con permisos en prosa y `security: []`/`bearerAuth` sin semántica de ámbito. | R-028, R-031, `auth-v1` §12 | Añadir las extensiones a las 35 operaciones vigentes y a las nuevas; declarar `x-scope` único (`global`, `own`, `group`, `mixed`) y detallar las ramas `mixed` en la matriz. | Un script puede recorrer el OpenAPI y obtener acceso, permiso, ámbito y evento de cada operación; CI falla si falta uno. |
| **RC-C-04** | Faltan las rutas del contrato de auth y de lectura académica: `POST /auth/mfa/enroll`, `/auth/mfa/enroll/confirm`, `/auth/mfa/recovery-codes`, `/auth/password`; `GET /academic/enrollments`, `/academic/groups/{id}/sessions`, `/academic/sessions/{id}`, `/academic/sessions/{id}/attendance`, `GET`/`PATCH /academic/evaluations`, `GET`/`PUT /academic/groups/{id}/schedule`. | R-019, R-021, R-024 | Incorporar las rutas con sus esquemas, códigos de error y extensiones `x-*`; declarar `partial`/`partial_or_session` donde corresponda. | Las 48 operaciones de la matriz existen en el OpenAPI y viceversa (cobertura bidireccional). |

### 3.2 No bloqueantes

| ID | Hallazgo | Corrección sugerida |
| --- | --- | --- |
| RC-C-05 | No hay `cookieAuth` (refresh/CSRF) ni respuestas `429`/`503` declaradas. | Añadir el esquema de cookie para `refresh`, `429` con `Retry-After` y `503` para auditoría/Redis no disponibles (`auth-v1` §7, §9). |
| RC-C-06 | `/me` no documenta `permissions` expandidos, `mfaEnabled`, `mustChangePassword` ni el 404 de `/me/student`. | Completar el esquema de `/me` y las respuestas de `/me/*` según `auth-v1` §6 y R-026. |
| RC-C-07 | `x-audit-event` no existe; los eventos de sesiones de clase aparecen con nombres ambiguos. | Usar el catálogo de `modelo-auditoria-v1` §3: `clase.*` para sesiones de clase y `sesion.*` solo para autenticación (H-07). |

## 4. Contradicciones detectadas entre documentos

| # | Documento A | Documento B | Conflicto | Resolución |
| --- | --- | --- | --- | --- |
| X-01 | `diccionario-datos.md` §3.4 (`numero_documento` único) | ADR-0003 / R-025 (ciphertext + hash) | Unicidad imposible sobre ciphertext | RC-A-01 |
| X-02 | `diccionario-datos.md` §2.7 (`recurso` texto libre, sin `recurso_id`) | ADR-0004 / R-030 | No se puede consultar el historial por registro | RC-A-02 |
| X-03 | `gramatica-y-catalogo-permisos-v1.md` (sin `update_own` de notificaciones ni `enrollment:read` del educador) | R-018/R-020/R-029 | La matriz referencia permisos que el catálogo no contiene | RC-C-01/02 |
| X-04 | `api-v1.openapi.yaml` (30 paths, permisos en prosa) | `matriz-autorizacion-v1.md` (48 operaciones, `x-*`) | No hay origen común ni cobertura bidireccional | RC-C-03/04 |
| X-05 | `auth-v1.md` §12 (rutas y estados nuevos) | `api-v1.openapi.yaml` (solo 4 rutas de auth) | El contrato de auth no está reflejado | RC-C-04 |

> **Nota:** las inconsistencias INC-001…INC-014 de Rol A siguen abiertas como registro histórico, pero R-001…R-031 ya proponen su resolución. No se pide reescribir el documento de revisión de Rol A; se pide reflejar las resoluciones en el diccionario.

## 5. Puntos que Rol B acepta revisar si hay objeción

| Tema | Postura de Rol B | Qué haría cambiar la decisión |
| --- | --- | --- |
| `email` en claro (D21) | Excepción documentada por ser identificador de login; HMAC en logs/auditoría. | Si el equipo considera que “datos de contacto” incluye el email, se cifra con `email_hash` antes de C2. |
| Auditoría sin cadena de hashes (D23) | Privilegios + disparador + WAL + resumen firmado; PA-016 en C8. | Si se exige evidencia ante terceros o auditoría externa en v1.0. |
| Un solo perfil administrador (PA-014) | MFA obligatorio y auditoría inmutable como compensación. | Si el centro exige separación de funciones desde el día uno. |
| Educador con `files:document:read_own` (R-029) | Propiedad = `subido_por` en v1.0. | Si C3 define un vínculo documental distinto (grupo/material); se ajusta la condición, no el permiso. |
| Grupo como ámbito en guard (D3) | Guard para visibilidad + dominio para agregados. | Si la prueba de C4 demuestra fugas por consultas agregadas. |

## 6. Checklist de cierre de la revisión cruzada

| # | Acción | Dueño | Estado |
| --- | --- | --- | --- |
| 1 | Aplicar RC-A-01…RC-A-04 en el diccionario | Rol A | Pendiente |
| 2 | Aplicar RC-C-01…RC-C-04 en catálogo y OpenAPI | Rol C | Pendiente |
| 3 | Responder por escrito a los hallazgos no bloqueantes (aceptar o diferir con justificación) | Rol A / Rol C | Pendiente |
| 4 | Confirmar que la matriz y el OpenAPI describen el mismo conjunto de 48 operaciones | Rol B / Rol C | Pendiente |
| 5 | Verificar el catálogo de 59 eventos contra `x-audit-event` (R-031) | Rol C | Pendiente (CI en C1) |
| 6 | Registrar el cierre en el acta de C0 | Equipo | Pendiente |

**Regla de cierre:** si un hallazgo bloqueante no se aplica ni se objeta con una alternativa aprobada, Rol B no firma C0. Los no bloqueantes pueden diferirse a C1/C2 con dueño y fecha, pero deben quedar registrados en el acta.

## 7. Qué no cubre esta revisión

- No valida la implementación (C1/C2): solo la coherencia documental y contractual.
- No revisa accesibilidad, rendimiento ni diseño visual.
- No sustituye la revisión de Rol A sobre el modelo académico ni la de Rol C sobre la calidad del OpenAPI; es la verificación de que las decisiones de seguridad quedaron reflejadas.
