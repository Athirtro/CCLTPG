# Registro de ejecución — Iteración 4 (Rol B)

- **Fecha:** 21 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Alcance:** RB1-28 a RB1-36 (fases 1 a 6 del plan de C4)
- **Plan:** `docs/tasks/rol-b/rol-b-it4-plan.md`
- **Paquete de revisión:** `docs/reviews/c4/rol-b.md`
- **Predecesor:** `docs/tasks/rol-b/rol-b-it3-registro.md`

> Este registro documenta la ejecución real, los comandos y los límites de la evidencia. El usuario autorizó iniciar la iteración tras confirmar que Rol C ajustaría el frontend una vez terminada la parte de Rol B.

## 1. Entorno verificado

| Herramienta | Versión | Nota |
| --- | --- | --- |
| Node.js | 22.19.0 | D39 |
| pnpm | 9.15.4 | Instalación global vía npm |
| TypeScript | 5.9.3 | `NodeNext`, ESM |
| Vitest | 5.1.0 | Unitarias, integración, contrato y arquitectura |
| NestJS | 12.5.1 | ESM; `tsx` no emite `emitDecoratorMetadata`, por eso se usó `@Inject(Token)` explícito |
| PostgreSQL | 16 embebido | Puerto 55432, `DATABASE_MIGRATOR_URL`; sustituye a Compose |
| Docker / MinIO | no ejecutables | Bloqueos de entorno heredados de C3 |

## 2. Ejecución por tarea

### RB1-28 — Fundaciones académicas

**Hecho**

- `academic/0007_create_academic_core.ts`: enums `programa_area`, `programa_estado`, `grupo_estado` y `matricula_estado`; tablas `programa_formativo`, `grupo`, `horario_grupo`, `estudiante` y `matricula`; checks de periodo, cupo, rango horario y formato de hash.
- `academic/0008_academic_indexes.ts`: unicidad parcial de matrícula e índices de grupo/estado, estudiante/periodo, horario/grupo y educador/periodo.
- `public/0007_create_academic_notifications.ts`: 12 plantillas nuevas (6 códigos × `app`/`email`); total 18 con C3.
- Tipos Kysely `academic.*` en `apps/api/src/database/schema.ts`; puertos `PiiCipher`, `UserDirectory`, repositorios y `AcademicUnitOfWork`.
- Claves `PII_ENCRYPTION_KEY` y `PII_HMAC_KEY` en `env.ts` y `.env.example`; `shared/security/pii.ts` con AAD por campo e HMAC con clave separada.

**Evidencia**

```text
migrator.spec.ts (C4): 5 tablas, 4 índices, predicado con 'preinscrita', up → down → up
migrator.spec.ts (C3): total de plantillas 6 → 18; 12 códigos académicos
requireMigratorDatabaseUrl(): integración omitida si no hay DATABASE_MIGRATOR_URL
```

**Límite:** la API no ejecuta DDL; los esquemas `academic` y `public` los crea `00-roles.sql` y los aplica `ccltpg_migrator`.

### RB1-29 — Programas formativos

**Hecho**

- `ProgramService` con alta idempotente, listado paginado y transiciones `borrador → publicado → archivado`.
- Auditoría `programa.creado`, `programa.publicado` y `programa.archivado` dentro de la transacción.
- `ProgramDetailsFilter` conserva `AppError.code` en los Problem Details.

**Evidencia**

```text
academic-flow.spec.ts: alta en borrador, archivado inválido → INVALID_STATE_TRANSITION,
                       publicado → archivado, idempotencia y auditoría
programs.controller.ts: operationIds createProgram, listPrograms, transitionProgram
```

### RB1-30 — Grupos y horarios

**Hecho**

- `GroupService` valida periodo `YYYY-P`, existencia del programa y educador activo por `UserDirectory`.
- Cierre `abierto → cerrado` con auditoría `grupo.cerrado`.
- `replaceSchedule` sustituye todas las franjas en una transacción: máximo 20, ISO 1–7, `hora_fin > hora_inicio`, solapamiento interno, bloqueos asesoría por periodo/educador y periodo/salón, y evento `horario.modificado` por outbox.
- `getSchedule` aplica ámbito: gestión global, educador dueño o estudiante matriculado; ajeno → 404.

**Evidencia**

```text
academic-flow.spec.ts: reemplazo atómico, solapamiento por salón, rango invertido,
                       franjas solapadas y evento horario.modificado en outbox
groups.controller.ts: getGroupSchedule / replaceGroupSchedule en la matriz
```

**Límite:** el solapamiento por educador usa la misma consulta que por salón, pero la integración lo ejecuta con dos grupos del mismo salón; no hay caso HTTP de ajeno → 404.

### RB1-31 — Estudiantes

**Hecho**

- `StudentService` exige consentimiento con versión de aviso; cifra documento, dirección y teléfono con AES-256-GCM y AAD por campo; calcula HMAC del documento con clave separada.
- Duplicado por hash → `STUDENT_DUPLICATE`; `PATCH` vuelve a cifrar y recalcular el hash; `usuario_id` es opcional y único parcial.
- Vistas: resumen sin PII para listados y ficha descifrada solo para la propia o la consulta autorizada.
- `estudiante.listado` se audita antes de responder, con página, tamaño y total.

**Evidencia**

```text
academic-flow.spec.ts: ciphertext en BD, hash /^[a-f0-9]{64}$/, dirección y teléfono cifrados,
                       ficha con documento, duplicado 409, /me/student propio y 404 sin vínculo,
                       listado sin numeroDocumento y auditoría estudiante.listado
pii.ts / shared-pii-cipher.ts: AAD estudiante:<id>:<campo> y HMAC con PII_HMAC_KEY
```

**Límite:** no hay prueba HTTP de roles ni de búsqueda parcial; `acudiente` se almacena como `null` y no se expone (PA-004).

### RB1-32 — Matrícula

**Hecho**

- `create` valida periodo del grupo, grupo abierto y duplicado vigente; `Idempotency-Key` obligatoria.
- `transition` bloquea el grupo con `SELECT … FOR UPDATE`, cuenta `confirmada + activa` contra `grupo.cupo_maximo` y publica el evento correspondiente por outbox en la misma transacción.
- `matriculaEventCode()` traduce los estados a los códigos del catálogo (`preinscrita → matricula.creada`, `activa → matricula.activada`).
- Vistas propias y roster del educador filtrado por `grupo.educador_id`.

**Evidencia**

```text
academic-flow.spec.ts: preinscrita, duplicado → ENROLLMENT_DUPLICATE, cupo 1 con dos
                       confirmaciones concurrentes (Promise.allSettled) → 1 édito / 1 GROUP_CAPACITY_EXCEEDED,
                       cadena confirmada → activa → finalizada y 4 eventos en evento_outbox
```

**Límite:** re-matriculación tras cancelación, grupo cerrado y periodo inválido no tienen caso de integración propio.

### RB1-33 — Contrato, permisos y matriz

**Hecho**

- 17 `operationId` académicos con `x-access`, `x-permission`, `x-scope`, `x-audit-event` y `x-error-codes`; esquemas concretos generados desde NestJS/Swagger.
- `ScheduleResponseDto.items` documentado con `ScheduleItemDto`.
- R-018 en `perfiles.ts` y corrección de `manage` para materializar `create`/`read`/`update` del contexto.
- `estudiante.listado` en `events.json` y en el modelo de auditoría; total 62 eventos.
- Plantillas de transición `programa.<estado>`, `grupo.<estado>` y `matricula.<estado>` en el validador de contrato.

**Evidencia**

```text
pnpm contracts:generate → packages/contracts/openapi.json
pnpm contracts:validate → 41 operaciones, 4 públicas, 62 eventos
pnpm test:contracts      → 11 pruebas
authorization-matrix.spec.ts → 41 operationId, 17 nuevos, 3 perfiles
```

### RB1-34 — Notificaciones académicas

**Hecho**

- `public/0007` siembra 12 plantillas nuevas; `CRITICAL_EVENT_PREFIXES` incluye `horario.` y `evaluacion.`.
- Los eventos de matrícula y horario se escriben en `evento_outbox` dentro de la transacción de negocio.
- Si el estudiante no tiene `usuario_id`, no se registra destinatario; la política de críticas impide silenciar `matricula.*` y `horario.*`.

**Evidencia**

```text
academic-flow.spec.ts: 4 códigos matricula.* y horario.modificado presentes en evento_outbox
notification-policy.ts y sus pruebas: prefijos críticos ampliados
```

**Límite:** el adaptador de correo de C3 es stub; no se verifica entrega real.

### RB1-35 — Reconciliación con Rol C

**Hecho**

- Contrato canónico code-first publicado; `docs/contratos/api-v1.openapi.yaml` queda superado para las operaciones académicas.
- Diferencias con `apps/web/src/api/client.ts` y las pantallas documentadas en `docs/tasks/rol-b/rol-b-it4-plan.md` §6.1.
- Rol C confirmó que ajustará pantallas y cliente cuando Rol B termine; no se implementaron las formas del mock en la API.

**Evidencia:** `packages/contracts/openapi.json` y la matriz §6.1 del plan. **Límite:** el frontend aún no se ha modificado.

### RB1-36 — Pruebas de compuerta y evidencia

**Hecho**

- `apps/api/test/integration/academic-flow.spec.ts` con 8 pruebas de PII, cupo, duplicados, estados, horarios, vistas, idempotencia y outbox.
- `apps/api/test/integration/migrator.spec.ts` ampliado a 18 plantillas y al bloque C4; `test:integration` pasó a ejecución serial de archivos para evitar deadlocks e historiales corruptos.
- `docs/reviews/c4/rol-b.md` y este registro.

**Evidencia**

```text
pnpm test:integration  → 4 archivos / 40 pruebas verdes (PostgreSQL 16 real)
pnpm --filter @ccltpg/api test → 29 archivos / 341 pruebas
pnpm --filter @ccltpg/web test → 2 archivos / 13 pruebas
pnpm test:architecture  → 3 pruebas
pnpm test:contracts     → 11 pruebas
pnpm test:security      → 6 pruebas, 0 fallos
pnpm arch:check         → 242 módulos, 830 dependencias, 0 violaciones
pnpm typecheck / lint / format / build → verdes
```

## 3. Incidencias corregidas

1. Los eventos `matricula.preinscrita` y `matricula.activa` no existían en el catálogo: se añadió `matriculaEventCode()` para publicar `matricula.creada` y `matricula.activada`. La integración detectó el fallo al comparar los códigos de `evento_outbox`.
2. La primera ejecución de integración falló por deadlock entre archivos que compartían base; `test:integration` usa `--no-file-parallelism` y el migrador limpia su esquema por archivo.
3. La expectativa de plantillas seguía en 6 tras `public/0007`: se actualizó a 18 y se añadió una comprobación explícita de los 12 códigos académicos.
4. `ScheduleResponseDto.items` documentaba solo franjas: se cambió a `ScheduleItemDto` y se regeneró el contrato.
5. `EnrollmentService` recibe 6 dependencias, no 7: se corrigió el harness de integración y se retiraron aserciones de tipo innecesarias detectadas por lint.

## 4. Estado final y próximos pasos

- Código y contrato: **verdes** en local. Sin `git push`: `main` local contiene C3, el merge de `origin/main` y C4.
- Documentación: plan, registro y paquete de revisión actualizados; queda la firma formal.
- Rol C: ajustar pantallas y `apps/web/src/api/client.ts` al contrato canónico.
- Equipo: ratificar C3, D49…D68 y R-018/R-034/R-035/R-036; abrir acta C0/C1; ejecutar CI en GitHub.
- C5: correo y antimalware reales, purga programada, reintentos de entrega y casos HTTP de extremo a extremo.
