# Paquete de revisión — Compuerta 4 (Rol B)

- **Rol:** B — Seguridad, identidad y operación
- **Compuerta:** C4 — Académico A: programas, grupos, estudiantes y matrícula
- **Estado:** **Ejecutada con límites de evidencia.** RB1-28…RB1-36 están implementados y verificados localmente; quedan pendientes la ratificación formal, el ajuste del frontend por Rol C y los bloqueos externos heredados de C3 (CI en GitHub, Docker/MinIO y acta C0/C1).
- **Fecha de verificación:** 21 de noviembre de 2026
- **Plan asociado:** `docs/tasks/rol-b/rol-b-it4-plan.md`
- **Registro de ejecución:** `docs/tasks/rol-b/rol-b-it4-registro.md`
- **Paquete previo:** `docs/reviews/c3/rol-b.md`
- **Regla:** no se marca ningún criterio como cumplido sin evidencia enlazada.

## 1. Alcance entregado frente al planificado

| Tarea | Entregable | Estado | Evidencia |
| --- | --- | --- | --- |
| RB1-28 | Fundaciones: esquema `academic`, migraciones `0007`/`0008`, tipos Kysely y puertos `PiiCipher`/`UserDirectory` | **Cumplido** | `up → down → up` contra PostgreSQL 16 real en `apps/api/test/integration/migrator.spec.ts`: 5 tablas, 4 índices, predicado del índice parcial y 18 plantillas tras `public/0007` |
| RB1-29 | Programas: alta, listado paginado y transiciones | **Cumplido** | `programs.controller.ts`, `program.service.ts`; integración: `borrador → publicado → archivado`, transición inválida 409, idempotencia y auditoría |
| RB1-30 | Grupos y horarios: alta, cierre y subrecurso atómico | **Cumplido** | `groups.controller.ts`, `group.service.ts`; integración: sustitución de franjas, rango inválido, solapamiento interno y por grupo, `horario.modificado` por outbox |
| RB1-31 | Estudiantes: alta, ficha, listado y actualización con PII cifrada | **Cumplido con límite HTTP** | Integración: ciphertext e HMAC en BD, documento duplicado 409, vista propia, listado sin PII y `estudiante.listado` auditado; sin prueba HTTP de roles |
| RB1-32 | Matrícula: alta, transiciones, vistas propias y roster | **Cumplido** | Integración: cupo concurrente con `Promise.allSettled` (1 édito / 1 `GROUP_CAPACITY_EXCEEDED`), duplicado vigente 409, cadena `confirmada → activa → finalizada`, eventos por outbox |
| RB1-33 | Contrato, permisos y matriz | **Cumplido con ratificación pendiente** | `pnpm contracts:generate` y `contracts:validate`: 41 operaciones, 4 públicas, 62 eventos; matriz de 41 `operationId` (17 nuevos) con los 3 perfiles |
| RB1-34 | Notificaciones académicas | **Cumplido con límite de entrega** | 12 plantillas nuevas (6 códigos × `app`/`email`), prefijos críticos `horario.`/`evaluacion.` y eventos transaccionales; entrega real sigue detrás del stub de C3 |
| RB1-35 | Reconciliación con Rol C | **Preparada, no aplicada en UI** | Contrato canónico publicado en `packages/contracts/openapi.json` y diferencias documentadas en `docs/tasks/rol-b/rol-b-it4-plan.md` §6.1; Rol C ajustará pantallas y `apps/web/src/api/client.ts` |
| RB1-36 | Pruebas de compuerta y evidencia | **Cumplido con límites** | 341 unitarias API + 13 web + 40 de integración + 3 de arquitectura + 11 de contrato + 6 de seguridad; `docs/reviews/c4/rol-b.md` y este registro |

**No se modificaron** `docs/diseno-arquitectonico.md`, `docs/vision-alcance.md` ni el diccionario de Rol A. El único cambio en un contrato documental fue añadir `estudiante.listado` a `docs/contratos/modelo-auditoria-v1.md`, registrado como R-035 para ratificación.

## 2. Decisiones y cambios aplicados

### 2.1 Decisiones D59…D68 aplicadas

El usuario aprobó ejecutar la iteración; la firma formal del equipo sigue pendiente (§9).

| Decisión | Elección aplicada | Reversibilidad | Consecuencia |
| --- | --- | --- | --- |
| D59 — Patrón de módulo | Un contexto `academic` con capas `api`/`application`/`domain`/`infrastructure`; identidad por `UserDirectory`, notificaciones solo por outbox | Media | `pnpm arch:check`: 242 módulos y 830 dependencias sin violaciones |
| D60 — Esquema y migraciones | Tablas en `academic`, sin FK cruzadas a `public`; `0007`/`0008` reversibles; la API no ejecuta DDL | Barata | Historial `public`/`academic` separado probado en integración |
| D61 — PII | AES-256-GCM con AAD `estudiante:<id>:<campo>` e HMAC-SHA256 con clave separada | Costosa tras datos reales | `PII_ENCRYPTION_KEY` y `PII_HMAC_KEY` en `.env.example` y `env.ts`; ciphertext y hash verificados en BD |
| D62 — Cupo | `grupo.cupo_maximo` validado al confirmar con `SELECT … FOR UPDATE` y `confirmada + activa` | Media | Prueba concurrente: solo una confirmación entra en el grupo de cupo 1 |
| D63 — Unicidad | Índice parcial `(estudiante_id, grupo_id, periodo)` para estados vigentes | Media | Predicado `preinscrita/confirmada/activa` verificado en `pg_index` |
| D64 — Máquinas de estado | Programa, grupo y matrícula con transiciones del diseño §9; destino actual es idempotente | Costosa por contrato | Integración cubre transiciones válidas e inválidas de los tres agregados |
| D65 — Idempotencia | Clave obligatoria en los cuatro POST de creación; reutiliza el almacén de C3 | Media | Integración: clave ausente 400, repetición exacta devuelve el mismo `id`, cuerpo distinto 409 |
| D66 — Horarios | `PUT` atómico, ISO 1–7, `hora_fin > hora_inicio`, bloqueo por periodo/educador/salón y evento `horario.modificado` | Media | Integración cubre reemplazo, solapamiento por salón y rango inválido |
| D67 — Notificaciones | Plantillas por migración, `matricula.*` y `horario.*` críticas; destinatario = `usuario_id` vinculado | Barata | 18 plantillas en total; `CRITICAL_EVENT_PREFIXES` ampliado; sin vínculo no se encola destinatario |
| D68 — Contrato y eventos | Esquemas concretos generados desde código; `estudiante.listado` (61 → 62); sin permisos nuevos | Costosa tras congelar | `pnpm contracts:validate`: 41/4/62; catálogo de permisos sigue en 37 |

### 2.2 Cambios de contrato y catálogo

1. **17 operaciones académicas nuevas** (24 de C2/C3 + 17 = 41): `createProgram`, `listPrograms`, `transitionProgram`, `createGroup`, `listGroups`, `transitionGroup`, `getGroupSchedule`, `replaceGroupSchedule`, `createStudent`, `listStudents`, `updateStudent`, `getMyStudent`, `createEnrollment`, `listEnrollments`, `transitionEnrollment`, `getMyEnrollments` y `getMySchedule`.
2. **4 rutas públicas** sin cambios; las 37 operaciones restantes exigen permiso y aparecen en la matriz con casos permitidos y denegados.
3. **Evento nuevo:** `estudiante.listado` en `packages/contracts/events.json` y en `docs/contratos/modelo-auditoria-v1.md`; total 62.
4. **Permisos:** catálogo de 37 sin cambios. R-018 asigna `academic:enrollment:read` al perfil `educador`. Se corrigió la expansión de `manage` en `apps/api/src/modules/identity/domain/perfiles.ts` para que `academic:*:manage` materialice también `create`/`read`/`update`.
5. **Fuente canónica:** `pnpm contracts:generate` produce `packages/contracts/openapi.json`; La propuesta OpenAPI C0 quedó superada; el contrato canónico es `packages/contracts/openapi.json`. `ScheduleResponseDto.items` usa `ScheduleItemDto` (vista completa), regenerado y validado.
6. **Plantillas:** `public/0007` siembra 12 filas nuevas, 6 códigos × `app`/`email`: `matricula.creada`, `matricula.activada`, `matricula.finalizada`, `matricula.cancelada`, `matricula.retirada` y `horario.modificado`. `matricula.confirmada` ya existía desde C3; total 18 tras C4.

### 2.3 Propuestas registradas para ratificación

| ID | Propuesta | Estado |
| --- | --- | --- |
| R-018 | `academic:enrollment:read` para `educador` (junto con la corrección de `manage`) | Aplicada; firma pendiente |
| R-034 | `grupo.cupo_maximo` e índice parcial de matrícula | Aplicada; firma pendiente |
| R-035 | Evento `estudiante.listado` | Aplicada; firma pendiente |
| R-036 | Contrato canónico code-first; el YAML de C0 queda superado | Aplicada; Rol C debe alinearse |

**No se añadieron dependencias.** Se reutilizan cifrado/HMAC, idempotencia, outbox, auditoría y almacenamiento de C2/C3. Las dos claves PII son configuración, no dependencias.

### 2.4 Defectos detectados y corregidos durante la ejecución

1. **Códigos de evento fuera del catálogo:** el servicio publicaba `matricula.preinscrita` y `matricula.activa`; se añadió `matriculaEventCode()` en `academic-states.ts` para publicar `matricula.creada` y `matricula.activada`, que sí existen en `events.json` y tienen plantilla. La integración comprueba los cuatro códigos emitidos en la cadena de estados.
2. **Aislamiento de pruebas de integración:** `test:integration` pasó a `--no-file-parallelism` y el migrador reinicia su esquema por archivo; antes había deadlocks e historiales corruptos al compartir base.
3. **DTO de horario:** `ScheduleResponseDto.items` documentaba solo franjas; se cambió a `ScheduleItemDto` y se regeneró el contrato.

## 3. Preguntas abiertas y límites de la evidencia

- **Ratificación formal de C3, D49…D58, D59…D68 y R-018/R-034/R-035/R-036.**
- **Acta de C0/C1:** sigue sin existir; sin ella no se puede declarar C4 cerrada formalmente.
- **CI en GitHub:** el workflow valida localmente, pero no se ejecutó en la plataforma.
- **Docker/MinIO:** bloqueos de entorno heredados de C3; la evidencia usa PostgreSQL 16 embebido.
- **Frontend:** Rol C ajustará `apps/web/src/api/client.ts` y las pantallas académicas; Rol B no implementó mocks ni formularios del frontend.
- **Entrega de notificaciones:** el adaptador de correo sigue siendo stub; se verifica el evento en outbox, no el mensaje recibido.
- **Sin prueba HTTP de extremo a extremo:** la matriz comprueba guardas y permisos sobre el OpenAPI real; los rechazos de ámbito y las cabeceras se verifican en servicios/controladores, no con un cliente HTTP que consiga 404.
- **Casos no ejecutados en integración:** re-matriculación tras cancelación, búsqueda parcial de documento, expiración/TTL de idempotencia en C4, fallo de auditoría con rollback y notificación sin vínculo de usuario. Están implementados o heredados, pero no se marcan como evidenciados.
- **Consentimiento y acudiente:** se almacena el consentimiento con versión; PA-004 sigue abierto y `acudiente` no se expone en C4.

## 4. Informe de pruebas y matriz

### 4.1 Comandos ejecutados (21 de noviembre de 2026)

| Prueba | Comando | Resultado |
| --- | --- | --- |
| Formato | `pnpm format` | Sin cambios pendientes |
| Tipos | `pnpm typecheck` | `@ccltpg/api` y `@ccltpg/web` sin errores |
| Lint | `pnpm lint` | Ambos paquetes sin errores ni advertencias |
| Unitarias API | `pnpm --filter @ccltpg/api test` | **29 archivos / 341 pruebas** verdes |
| Unitarias web | `pnpm --filter @ccltpg/web test` | **2 archivos / 13 pruebas** verdes |
| Build | `pnpm build` | API y web compilados |
| Arquitectura | `pnpm arch:check` | Sin violaciones (242 módulos, 830 dependencias) |
| Arquitectura (prueba) | `pnpm test:architecture` | **3 pruebas** verdes |
| Integración | `pnpm test:integration` + PostgreSQL 16 real (puerto 55432) | **4 archivos / 40 pruebas** verdes |
| Contrato | `pnpm contracts:generate` y `pnpm contracts:validate` | 41 operaciones, 4 públicas, 62 eventos |
| Validador | `pnpm test:contracts` | **11 pruebas** verdes |
| Secretos | `pnpm security:secrets` | Sin hallazgos |
| Escáner (pruebas) | `pnpm test:security` | **6 pruebas** verdes (0 fallos) |
| CI | validación YAML | Workflow válido; **no ejecutado en GitHub** |
| Compose | `docker compose ps` | **No ejecutado**: Docker/MinIO con bloqueos de entorno |

### 4.2 Integración C4 (`apps/api/test/integration/academic-flow.spec.ts`)

Ocho pruebas contra PostgreSQL 16 real, con repositorios Kysely, UoW, `SharedPiiCipher`, `KyselyUserDirectory`, `KyselyIdempotencyStore` y `KyselyAuditWriter`:

1. **PII en reposo:** `numero_documento`, `direccion` y `telefono` no aparecen en claro en `academic.estudiante`; el hash HMAC es de 64 hexadecimales; la ficha sí devuelve el documento descifrado.
2. **Duplicado de documento:** segunda alta con el mismo número → `STUDENT_DUPLICATE`.
3. **Máquinas de estado:** programa `borrador → publicado → archivado`, transición inválida → `INVALID_STATE_TRANSITION`, grupo `abierto → cerrado`.
4. **Cupo y duplicados:** matrícula vigente repetida → `ENROLLMENT_DUPLICATE`; dos confirmaciones concurrentes con cupo 1 → una `fulfilled` y una `GROUP_CAPACITY_EXCEEDED`.
5. **Matrícula y outbox:** transición inválida rechazada; cadena `confirmada → activa → finalizada` con los cuatro eventos (`matricula.creada`, `.confirmada`, `.activada`, `.finalizada`) en `evento_outbox`.
6. **Horario:** sustitución atómica, solapamiento con otro grupo del mismo salón → `SCHEDULE_OVERLAP`, rango invertido → `SCHEDULE_INVALID_RANGE`, franjas internas solapadas rechazadas y `horario.modificado` publicado.
7. **Vistas y auditoría:** `/me/student` propio devuelve la ficha; usuario sin vínculo → `RESOURCE_NOT_FOUND`; el listado no incluye `numeroDocumento` y registra `estudiante.listado`.
8. **Idempotencia:** clave ausente → `IDEMPOTENCY_KEY_REQUIRED`; repetición exacta devuelve el mismo `id`; cuerpo distinto con la misma clave → `IDEMPOTENCY_KEY_REUSED`.

La suite `migrator.spec.ts` amplía la comprobación a las 5 tablas académicas, 4 índices, el predicado del índice parcial, `up → down → up` y el total de 18 plantillas (12 académicas).

### 4.3 Matriz de autorización

`apps/api/test/api/authorization-matrix.spec.ts` lee el OpenAPI generado y ejecuta el guard real con los tres perfiles de la semilla:

- **41 operaciones** cubiertas exactamente; una operación nueva sin caso permitido/denegado hace fallar la prueba.
- Las **17 operaciones de C4** tienen al menos un caso permitido y uno denegado.
- **37 permisos** en el catálogo; la expansión de `manage` y `*` se valida antes de guardar y de devolver en `/me`.
- Denegación por defecto y **4 rutas públicas** sin cambios.

### 4.4 Criterios AC-SEC

| Criterio | Estado | Evidencia / límite |
| --- | --- | --- |
| AC-SEC-18 (ámbito) | **Cumple con límite HTTP** | Servicios filtran por educador/usuario y responden 404 al ajeno; la matriz valida permisos, pero no hay prueba HTTP de ajeno → 404 |
| AC-SEC-24 (datos académicos) | **Cumple** | Esquema `academic` propio, migraciones reversibles y modelo validado en BD |
| AC-SEC-25 (PII) | **Cumple** | AES-256-GCM + HMAC con claves separadas; ciphertext y hash verificados en PostgreSQL; listado sin PII |
| AC-SEC-30 (idempotencia) | **Cumple** | Cuatro POST con clave obligatoria; repetición, conflicto y clave ausente probados en integración |
| AC-SEC-31 | **Cumple** | Migraciones ejecutadas por `ccltpg_migrator`; la API no ejecuta DDL |
| AC-SEC-14/19/21 | **Sin cambios en C4** | Siguen como en C2/C3; C4 solo publica el contrato canónico para Rol C |

### 4.5 Criterios AC-AUD

| Criterio | Estado | Evidencia / límite |
| --- | --- | --- |
| AC-AUD-03 (académico) | **Cumple** | `programa.creado/publicado/archivado`, `grupo.creado/cerrado`, `estudiante.creado/actualizado` y `matricula.*` auditados dentro de la transacción |
| AC-AUD-03 (horario) | **Cumple** | `horario.modificado` se escribe en la misma transacción que la sustitución de franjas |
| AC-AUD-04 (listado) | **Cumple** | `estudiante.listado` se registra antes de responder, con página, tamaño y total; sin documento, dirección ni teléfono en el payload |
| AC-AUD-04 (descargas) | **Sin regresión** | Sigue como en C3 |
| AC-AUD-05/06/10/13 | **Cumple con límite** | El contrato exige `x-audit-event`; el validador amplía las plantillas de transición `programa.*`, `grupo.*` y `matricula.*`; la auditoría de Roles no se reabre aquí |
| AC-AUD-08/09 (redacción) | **Cumple por construcción** | Las auditorías académicas guardan iniciales, banderas y estados; se verificó el payload del listado y del alta, no un grep global de logs |

### 4.6 Compuerta 4 (diseño §18.2)

| Condición | Resultado |
| --- | --- |
| Caso completo programa → grupo → horario → estudiante → matrícula → confirmación | **Cumple** en integración de servicios; falta demo HTTP con cliente real |
| Separación de capas y sin importaciones cruzadas entre agregados | **Cumple**: `arch:check` sin violaciones y módulos detrás de puertos |
| Cupo agotado, duplicado de matrícula y de documento | **Cumple** en integración con PostgreSQL real |
| Transición inválida, grupo cerrado y periodo inválido | **Cumple en código**; la integración cubre transición inválida; grupo cerrado y periodo inválido tienen validación dedicada sin prueba de integración |
| Horario solapado por educador y por salón | **Cumple por salón y dentro del grupo** en integración; por educador está implementado con la misma consulta y bloqueo |
| PII cifrada, hash ciego y listado auditado | **Cumple** en integración |
| Ámbito de educador/estudiante, ajeno → 404 | **Implementado** en servicios y controladores; sin prueba HTTP |
| Idempotencia con clave repetida y cuerpo distinto | **Cumple** en integración |
| Contrato concreto y congelable | **Generado y validado**; pendiente de ratificación formal y del ajuste de Rol C |

## 5. Guion de demostración reproducible

1. `pnpm install --frozen-lockfile` con Node 22.19+ y pnpm 9.15.4.
2. Copiar `.env.example` a `.env`; definir `DATABASE_URL`, `DATABASE_MIGRATOR_URL`, `JWT_SECRET_CURRENT`, `MFA_ENCRYPTION_KEY`, `EMAIL_HMAC_KEY`, `PII_ENCRYPTION_KEY` y `PII_HMAC_KEY` (≥ 32 caracteres).
3. `pnpm migrate:status` y `pnpm migrate:up` con el rol `ccltpg_migrator`.
4. `SEED_PASSWORD='<clave fuerte>' pnpm --filter @ccltpg/api db:seed`.
5. `pnpm dev` y completar login, cambio de contraseña y MFA.
6. `POST /api/v1/academic/programs` con `Idempotency-Key`; publicar con `POST /academic/programs/{id}/transitions`.
7. `POST /academic/groups` y `PUT /academic/groups/{id}/schedule` con `franjas` ISO 1–7; repetir en otro grupo del mismo salón para ver `SCHEDULE_OVERLAP`.
8. `POST /academic/students` con consentimiento; verificar en BD que documento, dirección y teléfono están cifrados.
9. `POST /academic/enrollments` con `Idempotency-Key`; repetir la misma petición y comprobar el mismo `id`.
10. `POST /academic/enrollments/{id}/transitions` con `confirmada`; agotar el cupo y comprobar `GROUP_CAPACITY_EXCEEDED`.
11. Consultar `/me/student`, `/me/enrollments` y `/me/schedule`; inspeccionar `estudiante.listado` en la auditoría.
12. `pnpm format && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
13. `pnpm arch:check`, `pnpm test:architecture`, `pnpm contracts:validate`, `pnpm test:contracts`, `pnpm test:security` y `pnpm security:secrets`.
14. Con PostgreSQL 16 real: `pnpm test:integration` (40 pruebas, ejecución serial de archivos).

## 6. Diferencias (tablas, rutas, permisos, migraciones, dependencias)

- **Tablas nuevas:** `academic.programa_formativo`, `academic.grupo`, `academic.horario_grupo`, `academic.estudiante` y `academic.matricula`.
- **Rutas:** 17 operaciones académicas nuevas; se mantienen 4 públicas. El YAML de C0 queda superado por `packages/contracts/openapi.json`.
- **Permisos:** catálogo de 37 sin cambios; R-018 asigna `academic:enrollment:read` al educador y se corrige `manage`.
- **Migraciones:** `academic/0007_create_academic_core`, `academic/0008_academic_indexes` y `public/0007_create_academic_notifications`; `up/down/up` probado.
- **Dependencias añadidas:** **ninguna**. Solo configuración nueva: `PII_ENCRYPTION_KEY` y `PII_HMAC_KEY`.
- **Frontend:** sin cambios; Rol C ajustará pantallas y `apps/web/src/api/client.ts` al contrato canónico.

## 7. Deuda técnica

| Deuda | Impacto | Destino |
| --- | --- | --- |
| Frontend académico basado en mocks | Alto: las pantallas no consumen el contrato canónico | Rol C, inmediatamente tras esta entrega |
| Sin prueba HTTP de extremo a extremo de ámbito y cabeceras | Medio: la compuerta pide 404 al ajeno | C4/e2e con cliente real |
| Re-matriculación tras cancelación no ejecutada en integración | Medio: depende del índice parcial D63 | Añadir caso a `academic-flow.spec.ts` |
| Grupo cerrado y periodo inválido sin prueba de integración | Medio: validación implementada | Añadir casos en C5 o cierre de C4 |
| Notificación sin vínculo de usuario no probada de extremo a extremo | Medio: D67 exige registrar el motivo | Prueba de servicio con estudiante sin `usuario_id` |
| Correo y antimalware siguen siendo stubs | Heredado de C3 | C5/C8 |
| Purga programada de idempotencia/outbox ausente | Heredado de C3 | C5 |
| `acudiente` almacenado pero no expuesto | Bajo: PA-004 abierto | Definir estructura y acceso con Rol A |
| CI no ejecutado en GitHub y acta C0/C1 ausente | Medio: bloquea cierre formal | Publicar rama y firmar acta |

## 8. Autoevaluación anti-deriva (diseño §19.2)

1. **¿Código accedió a esquemas o agregados ajenos?** No. `academic` depende de puertos; identidad se consulta por `UserDirectory`; outbox y auditoría por sus puertos. `arch:check` sin violaciones.
2. **¿Toda ruta nueva está protegida y probada permitida/denegada?** Sí en la matriz (41 operaciones). El 404 por ámbito se verifica en servicios, no HTTP.
3. **¿Toda mutación emite auditoría?** Sí: programas, grupos, estudiantes, matrículas y horarios; las consultas propias están exentas con justificación en el contrato.
4. **¿Todo estado nuevo tiene máquina y transiciones probadas?** Sí para las tres máquinas; se corrigió el mapeo de códigos de evento para que coincida con el catálogo.
5. **¿Las migraciones pasan `up/down/up` en un solo esquema?** Sí, contra PostgreSQL 16 real, con historiales `public`/`academic` separados.
6. **¿Se modificó algún artefacto congelado?** No se editaron diseño ni visión. Solo se amplió el catálogo de auditoría con `estudiante.listado` (R-035).
7. **¿Se agregaron dependencias fuera de lo registrado?** No.
8. **¿Existe lógica de pagos o contabilidad?** No.
9. **¿Hay reglas sin trazabilidad?** Cada tarea se enlaza a AC-SEC/AC-AUD, compuerta 4 o a D59…D68.
10. **¿Las garantías están en la base y no solo en el código?** Sí: enums, checks, unicidad parcial de matrícula, índice ciego de documento y constraints de periodo/cupo.
11. **¿Alguna prueba se omitió o simuló ocultando comportamiento real?** No. La integración se omite sin `DATABASE_MIGRATOR_URL` y se ejecutó 40/40 contra PostgreSQL real; los límites (HTTP, correo, MinIO) están declarados en §3.
12. **¿Documentación, OpenAPI y diccionario coinciden con el código?** OpenAPI y eventos se generan y validan desde código. El diccionario aún no recoge R-034/R-035: queda registrado para Rol A.

## 9. Solicitud de firma

| Firmante | Qué aprueba | Estado |
| --- | --- | --- |
| Rol B | Programas, grupos, horarios, estudiantes, matrícula, vistas propias y evidencia C4 | Pendiente |
| Equipo | D59…D68, aprobadas por el usuario para ejecutar | Aprobadas; firma formal pendiente |
| Rol A / equipo | R-018, R-034, R-035 y R-036 | Pendiente |
| Rol C | Ajuste de pantallas y `client.ts` al contrato canónico | Pendiente; confirmado por el rol |
| Equipo | Compuerta 4, con HTTP e2e, CI en GitHub y acta C0/C1 pendientes | Pendiente |
