# Registro de ejecución — Iteración 5 (Rol B)

- **Fecha:** 22 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Alcance:** RB1-37 a RB1-50 (plan `docs/tasks/rol-b/rol-b-it5-plan.md`)
- **Paquete de revisión:** `docs/reviews/c5/rol-b.md`
- **Predecesor:** `docs/tasks/rol-b/rol-b-it4-registro.md`

> La orden «empieza la iteración 5» se registra como ratificación de D69–D79 y
> aceptación explícita de la deuda de C4, publicada en `a5444c8`. La orden
> «continuemos subiendo la iteración 5» autoriza la publicación de C5 en el
> commit `iteracion 5 b`. Los criterios TLS, carga y restauración quedan
> pendientes de entorno hasta que exista infraestructura.

## 1. Entorno verificado

| Herramienta | Versión | Nota |
| --- | --- | --- |
| Node.js | 22 | Igual que C4 |
| pnpm | 9.15.4 | Lockfile congelado |
| PostgreSQL | 16 embebido | Harness local en el puerto 55432 |
| Docker / MinIO | no ejecutables | Deuda heredada; no bloquea RB1-37 |

## 2. Ejecución por tarea

### RB1-37 — Fundaciones de Académico B

**Hecho**

- `academic/0009_create_academic_b.ts`: enums `sesion_estado`, `asistencia_estado` y
  `evaluacion_valor`; tablas `sesion_clase`, `asistencia`, `indicador_evaluacion` y
  `evaluacion_cualitativa` según `docs/diccionario-datos.md` §3.6–3.9. Referencias a
  usuarios lógicas, sin FK cruzadas a `public` (D70).
- `academic/0010_academic_b_indexes.ts`: unicidad de asistencia por
  (`sesion_id`, `matricula_id`), unicidad de evaluación por
  (`matricula_id`, `indicador_id`, `periodo`), índices de consulta y checks de
  periodo, escala cerrada y texto no vacío.
- Tipos Kysely nuevos en `apps/api/src/database/schema.ts`; reglas puras en
  `domain/academic-states.ts` (`canTransitionSesion`, `sesionAdmiteAsistencia`,
  `sesionEventCode`, `isValidEvaluacionValor`, `INDICADOR_ESCALA`).
- Tipos de aplicación y puertos `SessionRepository`, `AttendanceRepository`,
  `IndicatorRepository` y `EvaluationRepository`.
- Prueba de migraciones extendida en `test/integration/migrator.spec.ts` con
  `up → down → up`, 7 índices/unicidades y los 4 valores de la escala D73.

**Evidencia**

```text
migrator.spec.ts (C5): 4 tablas nuevas, 7 índices/unicidades, escala de 4 valores, up → down → up
Comando: node C:/Users/davin/AppData/Local/Temp/opencode/pgtest/run.mjs
Resultado inicial: 4 archivos / 41 pruebas verdes (la suite pasó de 40 a 41 con el caso C5)
```

**Límite:** la API sigue sin ejecutar DDL; todo cambio de esquema pasa por
`ccltpg_migrador`.

### RB1-38 — Sesiones de clase

- Puertos e implementación Kysely de `SessionRepository`; `SessionService` con
  idempotencia en alta, máquina `programada → realizada|cancelada`, bitácora
  `clase.*` y guard de ámbito: educador dueño o administrador; ajeno → 404.
- Controladores `SessionsController` (OP-24/25/38) y `GroupSessionsController`
  (OP-37), con `x-*` del contrato canónico.
- Fecha civil tratada como `date` local (mismo criterio que `fecha_nacimiento`
  en C4); evita el desplazamiento UTC del driver `pg`.

### RB1-39 — Asistencia

- `AttendanceRepository.replace` borra y reinserta dentro de la transacción;
  `AttendanceService` valida sesión `realizada`, matrículas del grupo en estados
  vigentes/finalizada y duplicados en la solicitud.
- Idempotencia por **estado resultante** (D72/R-010): un `PUT` repetido sin
  cambios no reescribe ni audita; una corrección sí genera `asistencia.registrada`.
- `AttendanceController` (OP-26/39), error `ATTENDANCE_INVALID_ENROLLMENT`.

### RB1-40 — Indicadores y escala

- Catálogo sembrado por `0010` con cuatro indicadores globales (`programa_id`
  nulo) y escala `excelente,bueno,regular,deficiente`; `IndicatorRepository`
  resuelve globales más propios del programa.
- Sin CRUD ni ruta propia (D73): se conservan los 10 `operationId` previstos y
  el total de 51 operaciones. Eventos `indicador.*` siguen reservados.

### RB1-41 — Evaluación cualitativa

- `EvaluationService`: única por matrícula/indicador/periodo, validación contra
  la escala del indicador, periodo del grupo, ámbito del educador y redacción de
  la observación en auditoría (`{"cambiado": true}`, AC-AUD-08).
- `EvaluationsController` (OP-27/40/41) y `GET /me/evaluations` (OP-28) con
  datos de grupo y programa derivados de la sesión autenticada.
- Errores estables nuevos: `EVALUATION_SCALE_INVALID`, `EVALUATION_DUPLICATE`.
- Plantilla `clase.<estado>` añadida al validador de contrato; sus dos
  expansiones (`clase.realizada`, `clase.cancelada`) ya estaban en el catálogo.

```text
migrator.spec.ts + academic-b-flow.spec.ts: 5 archivos / 44 pruebas verdes
Comando: node C:/Users/davin/AppData/Local/Temp/opencode/pgtest/run.mjs
```

## 3. Verificación local (RB1-37 a RB1-41)

| Comando | Resultado |
| --- | --- |
| `pnpm format:check` | verde |
| `pnpm typecheck` | verde |
| `pnpm lint` | verde |
| `pnpm build` | verde |
| `pnpm test` | API 391/391; web 13/13 |
| `pnpm test:integration` (PostgreSQL 16) | 44/44 |
| `pnpm test:architecture` | 3/3 |
| `pnpm arch:check` | 0 violaciones (259 módulos) |
| `pnpm test:contracts` | 12/12 |
| `pnpm contracts:validate` | 51 operaciones, 4 públicas, 62 eventos |
| `pnpm test:security` | 6/6 |
| `pnpm security:secrets` | sin hallazgos |

La matriz de autorización ejecutable se amplió a los 10 `operationId` nuevos
(244 pruebas); los perfiles de la semilla ya contenían los permisos C5.

## 4. Deuda y decisiones registradas

- D69–D79 ratificadas por la orden de inicio; firma formal pendiente.
- C4: D59–D68 y R-018/R-034/R-035/R-036 con firma pendiente; código publicado.
- Rol C debe ajustar `apps/web/src/api/client.ts` y las pantallas al contrato
  canónico antes de la demo de compuerta.
- Sin evidencia externa de GitHub Actions, Docker, TLS ni respaldos; no se marca
  ningún criterio dependiente de esos entornos como verificado.
