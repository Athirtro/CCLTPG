# Plan de trabajo — Iteración 4 (Rol B)

- **Fecha:** 21 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Iteración objetivo:** **C4 — Académico A: programas, grupos, estudiantes y matrícula** (Release 1.0)
- **Estado:** **Ejecutada con límites de evidencia** (21 de noviembre de 2026). Las tareas RB1-28…RB1-36 están implementadas y verificadas en local; siguen pendientes la ratificación formal de C3/D59–D68/R-018/R-034/R-035/R-036, el ajuste del frontend por Rol C y los bloqueos externos heredados de C3.
- **Plan predecesor:** `docs/tasks/rol-b/rol-b-it3-plan.md` (bloques RB1-20–RB1-27).
- **Registro de ejecución:** `docs/tasks/rol-b/rol-b-it4-registro.md`.
- **Paquete de revisión:** `docs/reviews/c4/rol-b.md`.
- **Paquete de revisión previo:** `docs/reviews/c3/rol-b.md`.
- **Requisitos:** `docs/requirements/seguridad.md` (AC-SEC-18/24/25/30, AC-AUD-03/04; compuerta C4 en §6).
- **Controles:** `docs/contratos/controles-seguridad-v1.md` (C-16, C-21/C-22, C-27, C-38).
- **Diseño:** `docs/diseno-arquitectonico.md` (§7.3, §8.2, §9, §18.2, §19).
- **Datos:** `docs/diccionario-datos.md` (§3, §4).
- **Contrato:** `packages/contracts/openapi.json` (contrato canónico code-first; la propuesta YAML C0 fue retirada), `docs/contratos/matriz-autorizacion-v1.md` (OP-11–OP-23, OP-36, OP-46–OP-48).

## 1. Objetivo de la iteración

Entregar el **primer dominio de negocio** sobre el patrón de módulo ya validado en C1–C3:

1. **Programas formativos:** alta, listado y máquina de estados `borrador → publicado → archivado`.
2. **Grupos y horarios:** alta, listado, cierre y horario como subrecurso (`GET`/`PUT /academic/groups/{id}/schedule`) con validación de solapamiento por educador y salón.
3. **Estudiantes:** alta y consulta con PII cifrada, índice ciego de documento, consentimiento y vínculo opcional a `public.usuario`.
4. **Matrícula:** creación y transiciones con validación transaccional de cupo, duplicados y periodo.
5. **Vistas propias:** `/me/student`, `/me/enrollments` y `/me/schedule` con ámbito `own`.
6. **Notificaciones académicas:** `matricula.*` y `horario.modificado` emitidos por outbox dentro de la misma transacción.
7. **Contrato concreto y matriz ejecutable** de las operaciones académicas, alineado con Rol C.

La iteración **no implementa** asistencia ni evaluación cualitativa (C5), reportes/KPIs (C6) ni envío real de correo (C5/C8). La vista de educador de C4 se limita a sus grupos y al roster de matrículas; las pantallas de asistencia/evaluación quedan para C5.

## 2. Criterios de salida y Compuerta 4

Según `docs/requirements/seguridad.md` §6 y el diseño §18.2:

| Condición | Criterio verificable |
| --- | --- |
| **C4 se considera completa** cuando | AC-SEC-18, AC-SEC-24, AC-SEC-25 y AC-SEC-30 tienen evidencia; AC-AUD-03 y AC-AUD-04 (listado de estudiantes) tienen evidencia; el patrón de módulo académico queda aprobado. |
| **Compuerta 4 — patrón de módulo** | Un caso de uso completo (programa → grupo → horario → estudiante → matrícula → confirmación) se demuestra de extremo a extremo; dominio, aplicación, infraestructura y API están separados; no hay importaciones cruzadas entre agregados ni acceso directo a repositorios ajenos. |
| **Compuerta 4 — reglas de negocio** | Se demuestran cupo agotado, matrícula duplicada, documento duplicado, transición inválida, grupo cerrado, horario solapado por educador y por salón, y periodo inválido. |
| **Compuerta 4 — PII** | `numero_documento`, `direccion` y `telefono` se guardan cifrados; el documento solo se busca por hash HMAC; el listado de estudiantes se audita antes de responder; ni auditoría, logs ni errores contienen documento, dirección o teléfono en claro. |
| **Compuerta 4 — ámbito** | Un educador solo ve sus grupos y sus matrículas; un estudiante solo ve lo propio; el acceso ajeno responde 404 `RESOURCE_NOT_FOUND`; las colecciones se filtran sin revelar totales ajenos. |
| **Compuerta 4 — idempotencia** | Repetir una creación con la misma `Idempotency-Key` y el mismo cuerpo devuelve la respuesta original sin duplicar; cuerpo distinto responde 409. |
| **Congelamiento** | Se congelan las rutas y esquemas académicos, los códigos de error y los eventos `programa.*`, `grupo.*`, `estudiante.*`, `matricula.*`, `horario.modificado`. |

Regla de bloqueo: sin evidencia enlazada, la compuerta no se aprueba aunque el código funcione.

## 3. Alcance propuesto (tareas)

Se continúa la numeración `RB1-nn` del Rol B.

| ID | Tarea | Entregable | Criterios que impulsa | Depende de | Resultado (evidencia) |
| --- | --- | --- | --- | --- | --- |
| RB1-28 | Fundaciones académicas | Migraciones `0007` (programas, grupos, horarios, estudiantes, matrículas) y `0008` (índices y restricciones); tipos Kysely del esquema `academic`; puertos `PiiCipher` y `UserDirectory`; pruebas `up/down/up` | AC-SEC-24/25/31 | C3 aceptada; R-025/R-026 ratificadas | **Hecho**: `up/down/up` real, 5 tablas, 4 índices y 18 plantillas; `docs/tasks/rol-b/rol-b-it4-registro.md` §RB1-28 |
| RB1-29 | Programas formativos | `GET`/`POST /academic/programs` y `POST /academic/programs/{id}/transitions`; paginación; idempotencia; auditoría `programa.*` | CAR-01, AC-AUD-03 | RB1-28 | **Hecho**: estados, idempotencia y auditoría en integración |
| RB1-30 | Grupos y horarios | `GET`/`POST /academic/groups`, transición, `GET`/`PUT /academic/groups/{id}/schedule`; solapamiento por educador y salón; idempotencia; auditoría y evento de horario | CAR-01/02, R-024 | RB1-28, RB1-29 | **Hecho**: reemplazo atómico, solapamiento por salón y `horario.modificado`; sin prueba HTTP de ajeno → 404 |
| RB1-31 | Estudiantes | `GET`/`POST /academic/students`, `PATCH /academic/students/{id}`, `GET /me/student`; cifrado y hash de documento; consentimiento; vínculo opcional a usuario; auditoría de alta, cambio y listado | AC-SEC-24/25, AC-AUD-03/04, R-026 | RB1-28 | **Hecho**: ciphertext/HMAC en BD, duplicado 409, ficha propia y listado auditado; sin búsqueda parcial probada |
| RB1-32 | Matrícula | `POST /academic/enrollments`, transiciones, `GET /me/enrollments` y `GET /academic/enrollments`; cupo transaccional, duplicados y ámbito de grupo; idempotencia; auditoría `matricula.*` | CAR-01/02, AC-SEC-18/30 | RB1-29, RB1-31 | **Hecho**: cupo concurrente, duplicados, estados y outbox; sin caso de re-matriculación ni grupo cerrado en integración |
| RB1-33 | Contrato, permisos y matriz | 17 operaciones con `x-access`, `x-permission`, `x-scope`, `x-audit-event` y `x-error-codes`; esquemas concretos; asignación R-018; eventos `estudiante.listado` y plantillas; matriz ejecutable | AC-SEC-16/17/20, AC-AUD-13, C-15/C-27 | RB1-29–RB1-32 | **Hecho, firma pendiente**: 41 operaciones, 4 públicas, 62 eventos, 37 permisos |
| RB1-34 | Notificaciones académicas | Plantillas `matricula.creada`, `matricula.cancelada` y `horario.modificado`; críticas ampliadas; publicación por outbox en la misma transacción | CAR-09, R-020 | RB1-32 | **Hecho con límite**: 12 plantillas y eventos en outbox; entrega real sigue con stub de C3 |
| RB1-35 | Reconciliación con Rol C | Contrato canónico publicado; tabla de diferencias con `apps/web/src/api/client.ts` y pantallas; ajuste de tipos y mocks del frontend; prueba de contrato compartida | AC-SEC-21, PA-005 | RB1-33 | **Preparada**: contrato y §6.1 publicados; Rol C ajustará UI/cliente; Rol B no implementó mocks |
| RB1-36 | Pruebas de compuerta, CI y runbooks | Suite de cupos, duplicados, solapamiento, PII, ámbito, idempotencia e integración PostgreSQL 16; demo de extremo a extremo; `docs/reviews/c4/rol-b.md`; registro y runbook académico | Compuerta 4 completa | RB1-28–RB1-35 | **Hecho con límites**: 341+13 unitarias, 40 integración, 3 arquitectura, 11 contrato, 6 seguridad; paquete y registro enlazados |

**Delegación a Rol C:** ajustar pantallas y cliente a los esquemas canónicos de §6.1, retirar datos simulados de las pantallas académicas y consumir las rutas propias `/me/*`. Rol B no implementa la UI.

## 4. Decisiones de C4 (D59–D68) — aplicadas, firma pendiente

Las decisiones siguientes se aplicaron en la ejecución; la aprobación formal del equipo sigue registrada en `docs/reviews/c4/rol-b.md` §9.

| Decisión | Propuesta | Recomendación | Reversibilidad |
| --- | --- | --- | --- |
| D59 — Patrón de módulo | **Un solo contexto `academic`** con carpetas por agregado (`programs`, `groups`, `students`, `enrollments`) y capas `api`/`application`/`domain`/`infrastructure`; los agregados se comunican por puertos de aplicación, no por repositorios ajenos; identidad se consulta por puerto `UserDirectory`; notificaciones solo por outbox | **A — un contexto, agregados separados** | Media; es la compuerta de patrón |
| D60 — Esquema y migraciones | Las tablas viven en `academic`; sin FK cruzadas a `public`; migraciones reversibles `0007`/`0008`; el rol de aplicación no ejecuta DDL | **A — fijado** | Barata |
| D61 — PII de estudiante | AES-256-GCM con AAD por campo (`estudiante:<id>:<campo>`); `numero_documento_hash` HMAC-SHA256 único; claves separadas `PII_ENCRYPTION_KEY` y `PII_HMAC_KEY`; sin búsqueda parcial ni orden por documento; documento, dirección y teléfono nunca salen en listados ni auditoría | **A — fijado** | Costosa tras datos reales |
| D62 — Cupo | El cupo que se valida al confirmar es **`grupo.cupo_maximo`**; `programa.cupo_maximo` queda como límite de oferta. Requiere añadir la columna al modelo (R-034) y contar `confirmada` + `activa` dentro de una transacción con bloqueo del grupo | **A — cupo por grupo** | Media |
| D63 — Unicidad de matrícula | Índice único parcial por (`estudiante_id`, `grupo_id`, `periodo`) **solo para estados vigentes** (`preinscrita`, `confirmada`, `activa`); permite re-matricular tras `cancelada`/`retirada` conservando historial. Requiere ratificación (R-034) | **A — único parcial** | Media |
| D64 — Máquinas de estado | Programa `borrador→publicado→archivado`; grupo `abierto→cerrado`; matrícula `preinscrita→confirmada→activa→finalizada`, con `cancelada`/`retirada` según diseño §9. Transición inválida → 409 `INVALID_STATE_TRANSITION`; grupo cerrado → 409 `GROUP_CLOSED` | **A — fijado** | Costosa por contrato |
| D65 — Idempotencia académica | `Idempotency-Key` obligatoria en **todos los POST de creación** académicos (programa, grupo, estudiante, matrícula), como declara el contrato canónico `packages/contracts/openapi.json`; reutiliza el almacén de C3 con TTL 24 h | **A — fijado** | Media |
| D66 — Horarios | `PUT` reemplaza el horario completo del grupo de forma atómica; franjas con `dia_semana` ISO 1–7 y `hora_fin > hora_inicio`; solapamiento por educador y por salón dentro del mismo periodo; bloqueo por asesoría (`pg_advisory_xact_lock`) por periodo/día/educador y periodo/día/salón; evento `horario.modificado` | **A — subrecurso atómico** | Media |
| D67 — Notificaciones académicas | Plantillas versionadas por migración para `matricula.creada`, `matricula.confirmada`, `matricula.cancelada` y `horario.modificado`; `matricula.*` y `horario.modificado` son críticas (no silenciables); destinatario = estudiante vinculado a `usuario_id`; sin vínculo no se envía y se registra el motivo | **A — fijado** | Barata |
| D68 — Contrato y eventos | Concretar los esquemas `TODO` del contrato académico; añadir `estudiante.listado` al catálogo de auditoría (61 → 62); sin permisos nuevos: R-018 solo asigna `academic:enrollment:read` al educador | **A — ratificar antes de congelar** | Costosa tras congelar |

## 5. Operaciones, permisos y auditoría

| OP | Operación | Acceso | Permiso | Ámbito | Auditoría |
| --- | --- | --- | --- | --- | --- |
| OP-11 | `GET /academic/programs` | permiso | `academic:program:manage` | global | — |
| OP-12 | `POST /academic/programs` | permiso | `academic:program:manage` | global | `programa.creado` |
| OP-13 | `POST /academic/programs/{id}/transitions` | permiso | `academic:program:manage` | global | `programa.publicado` / `programa.archivado` |
| OP-14 | `GET /academic/groups` | permiso | `academic:group:manage` **o** `academic:group:read_own` | mixed | — |
| OP-15 | `POST /academic/groups` | permiso | `academic:group:manage` | global | `grupo.creado` |
| OP-16 | `POST /academic/groups/{id}/transitions` | permiso | `academic:group:manage` | global | `grupo.cerrado` |
| OP-17 | `GET /academic/students` | permiso | `academic:student:manage` | global | `estudiante.listado` (R-035) |
| OP-18 | `POST /academic/students` | permiso | `academic:student:manage` | global | `estudiante.creado` |
| OP-19 | `GET /me/student` | permiso | `academic:student:read_own` | own | — |
| OP-20 | `POST /academic/enrollments` | permiso | `academic:enrollment:create` | global | `matricula.creada` |
| OP-21 | `POST /academic/enrollments/{id}/transitions` | permiso | `academic:enrollment:update` | global | `matricula.<estado>` |
| OP-22 | `GET /me/enrollments` | permiso | `academic:enrollment:read_own` | own | — |
| OP-23 | `GET /me/schedule` | permiso | `academic:schedule:read_own` | own | — |
| OP-36 | `GET /academic/enrollments` | permiso | `academic:enrollment:read` (R-018) | group | — |
| OP-46 | `GET /academic/groups/{id}/schedule` | permiso | `academic:group:manage` **o** `academic:schedule:read` **o** `academic:schedule:read_own` | mixed | — |
| OP-47 | `PUT /academic/groups/{id}/schedule` | permiso | `academic:group:manage` | global | `horario.modificado` |
| OP-48 | `PATCH /academic/students/{id}` | permiso | `academic:student:manage` | global | `estudiante.actualizado` |

- **Total del contrato:** 24 operaciones de C2/C3 + **17 académicas = 41**; se mantienen **4 rutas públicas**.
- **Catálogo de permisos:** **37 sin cambios**; R-018 solo asigna `academic:enrollment:read` al educador.
- **Catálogo de eventos:** 61 + `estudiante.listado` = **62**, si se aprueba R-035.
- **No se exponen** borrado de estudiantes, borrado de matrícula, CRUD de indicadores ni sesiones/asistencia/evaluación en C4: pertenecen a C5 o no tienen criterio aprobado.

## 6. Contrato y reconciliación con Rol C

### 6.1 Diferencias detectadas (bloqueantes para la compuerta)

Rol C ya entregó pantallas académicas en `apps/web` contra datos simulados y un `client.ts` escrito a mano. No coinciden con el contrato/diccionario:

| Elemento | Contrato/diccionario (canónico) | `apps/web/src/api/client.ts` (actual) | Resolución propuesta |
| --- | --- | --- | --- |
| Programa | `nombre`, `descripcion`, `area`, `cupoMaximo`, `estado` (`borrador/publicado/archivado`), `inscritos` | `cupo`, `estado` incluye `cerrado` | Adoptar el canónico; Rol C ajusta `Programas.tsx` |
| Grupo | `programaId`, `codigo`, `educadorId`, `salon`, `periodo`, `estado`; horario como subrecurso | `nombre`, `horario` (texto), `cupo` | Adoptar el canónico; el horario deja de ser texto libre |
| Estudiante | `tipoDocumento`, `numeroDocumento`, `nombres`, `apellidos`, `fechaNacimiento`, `municipio`, `barrio`, `direccion`, `telefono`, `acudiente`, `consentimientoDatos`, `usuarioId?` | `nombre`, `email`, `programaId`, `estado` | Adoptar el canónico; el email pertenece a `usuario` y solo se muestra si hay vínculo |
| Matrícula | `estudianteId`, `grupoId`, `periodo`, `estado` (6 estados), `fechaMatricula` | 3 estados (`pendiente/confirmada/cancelada`) sin periodo | Adoptar el canónico; Rol C ajusta `Matriculas.tsx` |
| Listados | Paginados `{page, pageSize, total, data}` | Arreglos simples | Adoptar paginación del contrato |
| Errores | Problem Details con `code` estable | Mezcla de mensajes libres | Usar `code` y `requestId` |

**Decisión aplicada, pendiente de ratificación formal:** R-036 (contrato académico canónico ya generado en `packages/contracts/openapi.json`) y asignación a Rol C del ajuste de pantallas y `client.ts`. Implementar las formas del mock en el backend dejaría el modelo de datos y la matriz inconsistentes.

### 6.2 Esquemas a concretar

Los esquemas `Program`, `ProgramCreateRequest`, `Group`, `GroupCreateRequest`, `Student`, `StudentCreateRequest`, `Enrollment`, `EnrollmentCreateRequest`, `ScheduleResponse` (con `ScheduleItemDto`), `Paginated*` y `StateTransitionRequest`, que en C0 eran `TODO` o `additionalProperties: true`, se publicaron desde código en C4 con campos, nulabilidad, enums y códigos de error. Pendientes de congelamiento formal.

## 7. Modelo de datos y reglas

### 7.1 Migración `0007` — núcleo académico

- `academic.programa_formativo`: `id`, `nombre`, `descripcion`, `area` (`danza|musica|teatro|artes_plasticas`), `cupo_maximo`, `estado` (`borrador|publicado|archivado`), `creado_en`.
- `academic.grupo`: `id`, `programa_id`, `codigo`, `educador_id` (referencia lógica), `salon`, `periodo` (`YYYY-P`), `cupo_maximo` (R-034), `estado` (`abierto|cerrado`), `creado_en`.
- `academic.horario_grupo`: `id`, `grupo_id`, `dia_semana` (1–7), `hora_inicio`, `hora_fin`; `CHECK hora_fin > hora_inicio`.
- `academic.estudiante`: `id`, `usuario_id` (nulo, único parcial), `tipo_documento`, `numero_documento` (ciphertext), `numero_documento_hash` (HMAC, único), `nombres`, `apellidos`, `fecha_nacimiento`, `municipio`, `barrio`, `direccion` (ciphertext), `telefono` (ciphertext), `acudiente` (jsonb, sin exposición en C4), `consentimiento_datos` (jsonb), `creado_en`.
- `academic.matricula`: `id`, `estudiante_id`, `grupo_id`, `estado`, `fecha_matricula`, `periodo`, `creado_en`.

### 7.2 Migración `0008` — índices y restricciones

- Único (`estudiante_id`, `grupo_id`, `periodo`) **parcial** para estados vigentes (D63).
- Índices `matricula(grupo_id, estado)`, `matricula(estudiante_id, periodo)`, `estudiante(numero_documento_hash)`, `horario_grupo(grupo_id, dia_semana)`.
- Checks de enums, periodo `YYYY-P`, cupo `> 0` y rango horario.

### 7.3 Reglas de negocio

1. **Cupo:** al confirmar, bloquear el grupo (`SELECT ... FOR UPDATE`) y contar `confirmada` + `activa`; si `>= cupo_maximo`, 409 `GROUP_CAPACITY_EXCEEDED`; nunca confiar en un conteo previo del cliente.
2. **Duplicados:** documento duplicado → 409 `STUDENT_DUPLICATE` sin revelar el valor; matrícula vigente duplicada → 409 `ENROLLMENT_DUPLICATE`.
3. **Grupo cerrado:** no admite nuevas matrículas ni confirmaciones; 409 `GROUP_CLOSED`.
4. **Periodo:** la matrícula debe coincidir con `grupo.periodo`; formato inválido → 400.
5. **Horario:** solapamiento por educador y por salón en el mismo periodo → 409 `SCHEDULE_OVERLAP`; rango inválido → 400 `SCHEDULE_INVALID_RANGE`.
6. **Transiciones:** solo las del diseño §9; idempotente si el estado destino ya es el actual; si no, 409 `INVALID_STATE_TRANSITION`.
7. **PII:** cifrar antes de persistir; hash calculado con clave separada; el listado devuelve solo datos mínimos (sin documento, dirección ni teléfono) y se audita antes de responder.
8. **Ámbito:** educador por `grupo.educador_id = sub`; estudiante por `estudiante.usuario_id = sub`; ajeno → 404.
9. **Notificaciones:** el evento de outbox se escribe en la misma transacción que la matrícula/horario; si no hay vínculo de usuario, no se envía y se registra el motivo.

## 8. Matriz de pruebas de compuerta

| Área | Casos mínimos |
| --- | --- |
| Programas | Alta válida; `area` inválida → 400; `borrador→publicado`; `publicado→archivado`; transición inválida → 409; listado paginado; idempotencia |
| Grupos | Alta con periodo `YYYY-P`; periodo inválido → 400; educador inexistente → 400/404 según contrato; cierre; matrícula en grupo cerrado → 409 |
| Horarios | `PUT` atómico; solapamiento por educador → 409; por salón → 409; mismo grupo no se auto-solapa; `hora_fin <= hora_inicio` → 400; `GET` para admin, educador dueño y estudiante matriculado; ajeno → 404 |
| Estudiantes | Alta con consentimiento; sin consentimiento → 400; documento duplicado → 409; documento cifrado en BD y hash único; búsqueda parcial → 400; `PATCH` recalcula hash; listado auditado antes de responder; `GET /me/student` propio; sin vínculo → 404 |
| Matrícula | Alta `preinscrita`; confirmación con cupo; cupo agotado → 409; duplicado vigente → 409; re-matrícula tras cancelada (si D63 se aprueba); transiciones válidas e inválidas; periodo distinto → 400 |
| Ámbito | Educador ve solo sus grupos y matrículas; estudiante solo lo propio; admin global; ajeno → 404; colecciones filtradas sin total ajeno |
| Idempotencia | Misma clave + mismo cuerpo → misma respuesta sin duplicado; cuerpo distinto → 409; clave ausente → 400; TTL |
| Notificaciones | `matricula.creada/confirmada/cancelada` y `horario.modificado` llegan al estudiante; críticas no silenciables; outbox en la misma transacción; fallo no deja matrícula huérfana |
| Auditoría | `programa.*`, `grupo.*`, `estudiante.creado/actualizado/listado`, `matricula.*`, `horario.modificado`; payload sin PII; fallo de auditoría → 503 y rollback |
| Contrato | 41 operaciones con `x-*`; 62 eventos; 4 públicas; matriz permitido/denegado por perfil |
| Arquitectura | Contexto `academic` aislado; sin importaciones de repositorios entre agregados; sin dependencia de `exports`/`notifications` desde el dominio |
| Integración | Migraciones `up/down/up`; cupo concurrente; índices únicos; cifrado y hash contra PostgreSQL 16 real |

## 9. Demo de extremo a extremo (Compuerta 4)

1. Administrador crea un programa, lo publica y crea un grupo con horario.
2. Crea un estudiante con consentimiento y documento; el sistema guarda ciphertext y hash.
3. Crea una matrícula `preinscrita` con `Idempotency-Key`; repite la solicitud y obtiene la misma respuesta.
4. Confirma la matrícula: se valida el cupo, se emite `matricula.confirmada` por outbox y queda la notificación.
5. El estudiante consulta `/me/student`, `/me/enrollments` y `/me/schedule`.
6. El educador dueño consulta sus grupos y el roster; intenta un grupo ajeno y recibe 404.
7. Se demuestran los rechazos: cupo agotado, documento duplicado, matrícula duplicada, transición inválida, grupo cerrado y solapamiento de horario.
8. Se inspecciona la base: documento/dirección/teléfono cifrados; auditoría sin PII; evento de listado registrado antes de la respuesta.

## 10. Dependencias nuevas

**Ninguna prevista.** Se reutilizan cifrado/HMAC, idempotencia, outbox, auditoría y almacenamiento de C2/C3. Si aparece una necesidad real, se fija versión exacta y se ratifica antes de instalar, igual que en C2/C3.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Contrato del frontend construido sobre mocks | R-036 y RB1-35 antes de congelar; contrato canónico primero; pruebas compartidas |
| Modelo sin cupo por grupo | R-034 explícita; si no se aprueba, el cupo se valida a nivel de programa y se documenta la limitación |
| Condiciones de carrera en cupo | Bloqueo del grupo en la misma transacción; prueba concurrente en integración |
| PII en logs, auditoría o listados | Campos mínimos por respuesta; redacción; pruebas de grep; auditoría de listado |
| Duplicados por documento | Índice ciego único y prueba de alta duplicada; sin búsqueda parcial |
| Solapamiento de horarios difícil de acotar | Bloqueo por asesoría y prueba por educador, salón y periodo |
| Patrón de módulo replicado con errores | Compuerta 4 revisa un caso completo y prohíbe importaciones cruzadas; se corrige aquí y no en C5 |
| Re-matrícula bloqueada por un único global | Índice parcial D63 con ratificación; si se rechaza, se documenta la regla estricta |

## 12. Preguntas abiertas para decidir antes de ejecutar

1. **C3:** ¿se acepta formalmente C3 con sus límites (MinIO local, stubs, CI pendiente) para abrir C4?
2. **R-018/R-024/R-025/R-026:** ¿se ratifican tal como están?
3. **PA-004 (acudiente):** ¿se omite el acudiente en C4 o se define ya su estructura y acceso? Propuesta: almacenar solo si se aprueba; no exponer.
4. **Cupo:** ¿se añade `grupo.cupo_maximo` (R-034) o el cupo se valida solo por programa?
5. **Re-matrícula:** ¿se permite tras `cancelada`/`retirada` con índice parcial (D63) o se mantiene la unicidad estricta del diccionario?
6. **Contrato con Rol C:** ¿se aprueba R-036 y Rol C ajusta pantallas al contrato canónico?
7. **Evento `estudiante.listado`:** ¿se añade al catálogo (R-035, 62 eventos) o se reutiliza `usuario.listado`?
8. **Consentimiento:** ¿qué texto/versión de aviso se usa y quién lo aprueba?
9. **Periodo y día:** ¿se confirman `YYYY-P` e ISO 1–7 (R-008) para congelarlos?
10. **Estudiante sin usuario:** ¿se permite matrícula y notificación solo si hay vínculo, o se exige `usuario_id` en C4?

## 13. Plan de fases propuesto

1. **Fase 1 — Fundaciones:** migraciones `0007`/`0008`, tipos, puertos de PII y directorio de usuarios, `up/down/up`.
2. **Fase 2 — Programas y grupos:** estado, cupo, cierre, listados e idempotencia.
3. **Fase 3 — Horarios:** subrecurso, validación de solapamiento y evento.
4. **Fase 4 — Estudiantes:** cifrado, hash, consentimiento, vínculo y auditoría de listado.
5. **Fase 5 — Matrícula:** cupo transaccional, duplicados, transiciones, vistas propias y roster del educador.
6. **Fase 6 — Contrato, notificaciones y compuerta:** OpenAPI concreto, matriz, plantillas, pruebas, demo, runbook y paquete `docs/reviews/c4/rol-b.md`.

## 14. Estado de ejecución y próximos pasos

Las fases 1 a 6 se ejecutaron el 21 de noviembre de 2026. El detalle por tarea, los comandos, las incidencias corregidas y los límites están en `docs/tasks/rol-b/rol-b-it4-registro.md`; la evidencia de compuerta está en `docs/reviews/c4/rol-b.md`. El contrato canónico ya está publicado en `packages/contracts/openapi.json`.

Pendiente:

1. Revisar y ratificar formalmente D59–D68, R-018/R-034/R-035/R-036 y este plan.
2. Aceptar formalmente C3 o registrar sus condiciones; abrir el acta C0/C1.
3. Rol C: ajustar `apps/web/src/api/client.ts` y las pantallas académicas al contrato canónico.
4. Completar la evidencia HTTP de extremo a extremo (ámbito ajeno → 404 y cabeceras), los casos de re-matriculación, grupo cerrado y periodo inválido, y la ejecución del CI en GitHub.
5. **No se hizo `git push`**: `main` local contiene C3, el merge de `origin/main` y C4; se requiere autorización antes de publicar.

## 15. Fuentes

- `docs/requirements/seguridad.md` (AC-SEC-18/24/25/30, AC-AUD-03/04, §6).
- `docs/contratos/controles-seguridad-v1.md` (C-16, C-21/C-22, C-27, C-38).
- `docs/contratos/matriz-autorizacion-v1.md` (OP-11–OP-23, OP-36, OP-46–OP-48, A-01–A-14).
- `docs/contratos/modelo-auditoria-v1.md` (`programa.*`, `grupo.*`, `estudiante.*`, `matricula.*`, `horario.modificado`).
- `docs/contratos/gramatica-y-catalogo-permisos-v1.md` (catálogo académico y asignaciones).
- `docs/contratos/reconciliacion-c0-rol-b.md` (R-018, R-024, R-025, R-026).
- `packages/contracts/openapi.json` (operaciones y esquemas académicos).
- `docs/diccionario-datos.md` (§3, §4, §6).
- `docs/diseno-arquitectonico.md` (§7.3, §8.2, §9, §18.2, §19).
- `docs/tasks/rol-b/rol-b-it3-plan.md`, `docs/reviews/c3/rol-b.md`.
- `docs/open-questions.md` (PA-004, PA-005, PA-013), `docs/assumptions.md`.
