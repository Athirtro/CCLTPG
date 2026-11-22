# Plan de trabajo — Iteración 5 (Rol B)

- **Fecha:** 21 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Iteración objetivo:** **C5 — Académico B y Release 1.0** (endurecimiento, carga y recuperación)
- **Estado:** **Propuesta, no ejecutada.** Requiere firma de C4 (D59–D68, R-018/R-034/R-035/R-036), ratificación de D69–D79, cierre de la deuda de Rol C y disponibilidad de entorno para carga/TLS/respaldo antes de abrir código.
- **Plan predecesor:** `docs/tasks/rol-b/rol-b-it4-plan.md` (bloques RB1-28–RB1-36).
- **Registro predecesor:** `docs/tasks/rol-b/rol-b-it4-registro.md`.
- **Paquete de revisión previo:** `docs/reviews/c4/rol-b.md`.
- **Paquete de revisión a producir:** `docs/reviews/c5/rol-b.md`.
- **Requisitos:** `docs/requirements/seguridad.md` (AC-SEC-23/28/31/32/33, AC-AUD-15; C5 en §5), `docs/vision-alcance.md` (CAR-03, CAR-06, CAR-08).
- **Controles:** `docs/contratos/controles-seguridad-v1.md` (C-11, C-20, C-24, C-25, C-26, C-42, C-43, C-45, C-46; mapa en §8).
- **Diseño:** `docs/diseno-arquitectonico.md` (§7.3, §7.4, §9, §10.3, §14, §18.2).
- **Datos:** `docs/diccionario-datos.md` (§3.6–§3.9, §4).
- **Contrato:** `packages/contracts/openapi.json` y `packages/contracts/events.json` (canónicos, generados desde código); `docs/contratos/matriz-autorizacion-v1.md` (OP-24–OP-28, OP-37–OP-41).
- **Resoluciones aplicables:** `docs/contratos/reconciliacion-c0.md` (R-008, R-010, R-011, R-021), adenda `docs/contratos/reconciliacion-c0-rol-b.md`, `docs/open-questions.md` (PA-009, PA-011, PA-016), `docs/assumptions.md` (SUP-004, SUP-005, SUP-008).

## 1. Objetivo de la iteración

Cerrar el Release 1.0 con tres frentes separados pero demostrables en la misma compuerta:

1. **Académico B (CAR-03):** sesiones de clase, asistencia e indicadores/evaluación cualitativa sobre el patrón de módulo aprobado en C4.
2. **Endurecimiento (CAR-07/CAR-12):** TLS/HSTS, secretos con rotación `kid`, escaneos, logs y alertas, purga de tablas operativas, runbooks probados.
3. **Operación y evidencia (CAR-06/CAR-08):** prueba de carga a 200 usuarios concurrentes con p95 < 4 s, simulacro de respaldo/restauración con RPO ≤ 15 min y RTO ≤ 4 h, regresión y recorridos de extremo a extremo.

La iteración **no implementa** reportes/KPIs (C6), accesibilidad (C7), retención y anonimización definitivas (C8), correo SMTP real ni antimalware real (C5/C8 según disponibilidad), ni pagos/contabilidad. **No congela** la API ni el esquema académico hasta que la compuerta esté firmada.

### 1.1 Condición previa

C4 quedó ejecutada con límites: sin firma formal, con frontend aún basado en mocks y con CI/Docker pendientes (`docs/reviews/c4/rol-b.md` §7 y §9). Rol B no abrirá código de C5 hasta que:

- se firme C4 y D59–D68, o el equipo acepte explícitamente continuar con esa deuda registrada;
- Rol C confirme el ajuste de `apps/web/src/api/client.ts` y de las pantallas al contrato canónico;
- se confirme qué evidencia externa (GitHub Actions, Docker, TLS, PostgreSQL de preproducción) se puede producir en esta iteración. Esta confirmación decide si los criterios C5 se marcan como **verificados** o como **pendientes de entorno**.

## 2. Criterios de salida y Compuerta 5

| Condición | Criterio verificable |
| --- | --- |
| **C5 completo en seguridad** | AC-SEC-23 (TLS 1.2+, redirección y HSTS), AC-SEC-28 (secretos y rotación con `kid`), AC-SEC-31 (DDL solo del migrador, `up/down/up`), AC-SEC-32 (SCA y secretos sin críticas abiertas) y AC-SEC-33 (runbooks probados) tienen evidencia enlazada. |
| **Auditoría** | AC-AUD-15: retención ≥ 5 años documentada, sin borrado desde la aplicación y restauración conforme al procedimiento de excepción; las consultas de PII académicas siguen auditadas antes de responder. |
| **Académico B** | Sesión `programada → realizada/cancelada`; asistencia idempotente por estado resultante con unicidad por sesión y matrícula; evaluación única por matrícula/indicador/periodo y validada contra escala; ámbito de educador y estudiante verificado en servidor (404 al ajeno). |
| **Compuerta 5 — demostración** | Recorrido completo: programa → grupo → matrícula → sesión → asistencia → evaluación → notificación/auditoría, con dominio, aplicación, infraestructura y API separados y `arch:check` sin violaciones. |
| **Compuerta 5 — carga** | Escenario k6 de 200 usuarios concurrentes sobre operaciones críticas (login, `/me`, matrícula, asistencia, evaluación); p95 < 4 s y 0 errores 5xx; informe adjunto con percentiles y configuración. |
| **Compuerta 5 — restauración** | Simulacro documentado con tiempos medidos: RPO ≤ 15 min, RTO ≤ 4 h, respaldo cifrado y verificación de integridad de `evento_auditoria` tras la restauración. |
| **Congelamiento** | Solo tras firma: rutas y esquemas académicos, códigos de error y eventos `clase.*`, `asistencia.*`, `evaluacion.*`, `indicador.*`; etiqueta `release-1.0-rc`. |

Regla de bloqueo: un criterio sin evidencia enlazada no se marca como cumplido. Si el entorno no permite TLS, GitHub Actions, Docker o respaldos reales, se registra como **pendiente de entorno** en el paquete de revisión; no se sustituye por un stub ni por una suposición.

## 3. Alcance propuesto (tareas)

Se continúa la numeración `RB1-nn` del Rol B. Estado inicial de todas: **propuestas**.

| ID | Tarea | Entregable | Criterios que impulsa | Depende de |
| --- | --- | --- | --- | --- |
| RB1-37 | Fundaciones de Académico B | Migraciones `academic/0009` (`sesion_clase`, `asistencia`, `indicador_evaluacion`, `evaluacion_cualitativa`) y `0010` (checks, índices y unicidades); tipos Kysely y puertos; pruebas `up/down/up` | AC-SEC-31, C-42 | C4 firmada o deuda aceptada; D69/D70 |
| RB1-38 | Sesiones de clase | `POST /academic/sessions`, transición `programada → realizada/cancelada`, `GET` por grupo y detalle (OP-24/25/37/38); idempotencia en alta; auditoría `clase.*` | CAR-03, AC-AUD-03, C-16 | RB1-37, D71 |
| RB1-39 | Asistencia | `PUT /academic/sessions/{id}/attendance` idempotente por estado resultante (R-010), `GET /academic/sessions/{id}/attendance` (OP-26/39); validación de matrículas del grupo y unicidad; auditoría `asistencia.registrada` | CAR-03, AC-SEC-30, AC-AUD-03 | RB1-38, D72 |
| RB1-40 | Indicadores y escala | Catálogo de indicadores sembrado por migración; escala cerrada y validable; sin CRUD mientras no se ratifiquen nuevas operaciones | CAR-03, C-33 | RB1-37, D73 |
| RB1-41 | Evaluación cualitativa | `POST /academic/evaluations`, `GET /academic/evaluations`, `GET /me/evaluations`, `PATCH /academic/evaluations/{id}` (OP-27/28/40/41); unicidad, escala, redacción de observación y auditoría `evaluacion.*` | CAR-03, AC-AUD-08/03, C-16 | RB1-40, D74 |
| RB1-42 | Contrato, permisos y matriz | 10 `operationId` nuevos con `x-access`, `x-permission`, `x-scope`, `x-audit-event` y `x-error-codes`; esquemas concretos; matriz 51 × 3 perfiles; validación bidireccional de eventos | AC-SEC-16/17/18/20, AC-AUD-13 | RB1-38–RB1-41, D76 |
| RB1-43 | Cierre de deuda de C4 | Casos HTTP de ámbito ajeno → 404 y cabeceras, re-matriculación, grupo cerrado, periodo inválido, notificación sin vínculo y purga de `idempotency`/outbox | Compuerta 4/5, C-16/C-38 | C4 ejecutada; RB1-42 |
| RB1-44 | TLS y cabeceras de transporte | Configuración de TLS 1.2+, redirección 308 y HSTS en el despliegue de preproducción; informe de escaneo | AC-SEC-23, C-20 | Entorno de preproducción, D77 |
| RB1-45 | Secretos, rotación y cadena de suministro | Inventario con `kid`, procedimiento de rotación de JWT/PII/base con prueba de doble clave; `security:secrets`, SCA de dependencias e imágenes; verificación de privilegios DDL | AC-SEC-28/31/32, C-24/C-43/C-44 | D77 |
| RB1-46 | Respaldo, restauración y retención | Respaldos cifrados y archivado de WAL, simulacro con tiempos medidos, acta y runbook `docs/runbook/respaldo-restauracion.md`; política de retención ≥ 5 años para auditoría | AC-SEC-33, AC-AUD-15, C-25/C-26/C-46 | Entorno con PostgreSQL, SUP-004/005, D78 |
| RB1-47 | Observabilidad, alertas y límites de tasa | Reglas de alerta para errores de autenticación, auditoría, latencia y readiness; simulacro de alerta; revisión de `RATE_LIMITS` (PA-009) tras la carga; logs sin PII | C-11/C-40/C-45 | RB1-44–RB1-46, RB1-48 |
| RB1-48 | Prueba de carga | Escenarios y umbrales k6 a 200 usuarios concurrentes sobre operaciones críticas; informe con p50/p95/p99 y errores | CAR-06, PA-009 | RB1-42, entorno de preproducción, D78 |
| RB1-49 | Regresión y extremo a extremo | Suite de regresión de C1–C5 y recorridos de extremo a extremo con cliente real; verificación de que Rol C consume el contrato canónico | Compuerta 5 — demostración, C-19 | RB1-42–RB1-48, Rol C |
| RB1-50 | Paquete de revisión y cierre | `docs/reviews/c5/rol-b.md`, `docs/tasks/rol-b/rol-b-it5-registro.md`, demo guiada, tabla de firmas y propuesta de etiqueta `release-1.0-rc` | Compuerta 5 completa | RB1-37–RB1-49 |

**Delegación a Rol C:** ajustar `apps/web/src/api/client.ts` y las pantallas de sesiones, asistencia y evaluación al contrato generado; retirar mocks; verificar que la navegación se deriva de `/me` y que las llamadas directas se deniegan en backend (C-19). Rol B no implementa UI.

**Fuera de alcance de Rol B en C5:** reportes/KPIs (C6), WCAG (C7), retención/supresión aplicada a datos reales (C8), proveedor SMTP y antivirus reales si no hay infraestructura, y cualquier permiso no previsto en el catálogo de 37.

## 4. Decisiones propuestas para C5 (D69–D79)

Requieren ratificación antes de ejecutar. Se registran aquí para no modificar artefactos congelados.

| Decisión | Propuesta | Recomendación | Reversibilidad |
| --- | --- | --- | --- |
| D69 — Alcance | Académico B + endurecimiento + carga + restauración; C6/C7/C8 quedan fuera; correo y antimalware siguen detrás de puertos hasta que exista proveedor | **A — fijar alcance** | Media |
| D70 — Esquema y migraciones | Cuatro tablas nuevas en `academic` (`0009`) e índices/checks en `0010`; sin FK cruzadas a `public`; DDL solo por `ccltpg_migrador`; `up/down/up` real | **A — fijado** | Barata |
| D71 — Sesiones | `programada → realizada` y `programada → cancelada`; solo `realizada` habilita registro de asistencia; `cancelada` lo bloquea; transición inválida → 409 `INVALID_STATE_TRANSITION`; actor = educador dueño del grupo, administrador global | **A — según diseño §9** | Costosa por contrato |
| D72 — Asistencia | `PUT` reemplaza el conjunto completo de la sesión y es idempotente por **estado resultante** (R-010); `Idempotency-Key` recomendada pero no obligatoria; única por (`sesion_id`, `matricula_id`); solo matrículas del grupo en estados vigentes/finalizadas; correcciones = nuevo `PUT` con el mismo evento `asistencia.registrada`. `asistencia.corregida` y `attendance:update` quedan **reservados y documentados**, sin operación que los use | **A — sin permisos ni eventos nuevos** | Media |
| D73 — Indicadores | Catálogo sembrado por migración, con `programa_id` y escala cerrada `excelente`, `bueno`, `regular`, `deficiente`; **sin CRUD** en v1.0; eventos `indicador.*` quedan reservados y se documenta la decisión. Alternativa: CRUD administrativo con 3 OP nuevos y permisos existentes, previa ratificación | **A — sembrar por migración** (evita ampliar superficie sin criterio aprobado) | Media |
| D74 — Evaluación | Única por (`matricula_id`, `indicador_id`, `periodo`); `valor` validado contra la escala de D73; `observacion` se redacta en auditoría como `{"cambiado": true}` (AC-AUD-08); `POST` crea, `PATCH` corrige con `evaluacion.actualizada`, `GET /me/evaluations` solo lo propio | **A — fijado** | Media |
| D75 — Ámbito | Educador solo sobre grupos donde `grupo.educador_id = sub`; estudiante solo sobre sus matrículas; ajeno → 404 `RESOURCE_NOT_FOUND`; colecciones filtradas sin totales ajenos (R-011, PA-002) | **A — guard + refuerzo en dominio** | Costosa tras congelar |
| D76 — Contrato | 10 operaciones nuevas (41 → 51), **4 públicas sin cambios**, **62 eventos sin cambios** y **37 permisos sin cambios**; `docs/contratos/api-v1.openapi.yaml` queda como referencia histórica | **A — contrato canónico code-first** | Costosa tras congelar |
| D77 — Endurecimiento | TLS/HSTS se verifica en preproducción, no en el host; rotación con doble `kid` probada sobre JWT y claves PII; purga programada de idempotencia y outbox se implementa con prueba; SCA y escaneo de secretos sin críticas abiertas | **A — con declaración explícita de límites de entorno** | Media |
| D78 — Carga y recuperación | k6 a 200 usuarios, p95 < 4 s y sin 5xx; RPO ≤ 15 min, RTO ≤ 4 h (SUP-005); el simulacro se ejecuta contra PostgreSQL real y mide tiempos; si no hay entorno, el criterio queda pendiente, no aprobado | **A — medir, no estimar** | Media |
| D79 — Congelamiento | Etiqueta `release-1.0-rc` solo después de firmar compuerta y de que Rol C haya regenerado el cliente; C6 puede abrirse con el contrato congelado | **A — firmar antes de congelar** | Costosa tras etiquetar |

## 5. Operaciones, permisos y auditoría

Operaciones nuevas previstas (todas ya declaradas en la matriz de C0; **no se propone ningún permiso nuevo**):

| OP | Operación | Permiso | Ámbito | Auditoría |
| --- | --- | --- | --- | --- |
| OP-24 | `POST /academic/sessions` | `academic:session:create` | group | `clase.creada` |
| OP-25 | `POST /academic/sessions/{id}/transitions` | `academic:session:update` | group | `clase.<estado>` |
| OP-26 | `PUT /academic/sessions/{id}/attendance` | `academic:attendance:create` | group | `asistencia.registrada` |
| OP-27 | `POST /academic/evaluations` | `academic:evaluation:create` | group | `evaluacion.registrada` |
| OP-28 | `GET /me/evaluations` | `academic:evaluation:read_own` | own | — |
| OP-37 | `GET /academic/groups/{id}/sessions` | `academic:group:manage` **o** `academic:group:read_own` | mixed | — |
| OP-38 | `GET /academic/sessions/{id}` | `academic:group:manage` **o** `academic:group:read_own` | mixed | — |
| OP-39 | `GET /academic/sessions/{id}/attendance` | `academic:attendance:read` | group | — |
| OP-40 | `GET /academic/evaluations` | `academic:evaluation:read` | group | — |
| OP-41 | `PATCH /academic/evaluations/{id}` | `academic:evaluation:update` | group | `evaluacion.actualizada` |

- **Totales esperados:** 41 + 10 = **51 operaciones**, **4 públicas**, **62 eventos**, **37 permisos**. El generador y `contracts:validate` deben confirmar estos números; cualquier desviación se documenta antes de firmar.
- **Eventos ya en el catálogo:** `clase.creada`, `clase.realizada`, `clase.cancelada`, `asistencia.registrada`, `asistencia.corregida`, `evaluacion.registrada`, `evaluacion.actualizada`, `indicador.creado`, `indicador.actualizado`. No se añaden códigos.
- **Reservados:** `asistencia.corregida`, `indicador.creado`, `indicador.actualizado` (D72/D73). El validador debe seguir aceptando el catálogo sin exigir eventos huérfanos nuevos.
- **Sin plantillas nuevas:** `evaluacion.publicada` y `recordatorio.fechas` (diseño §10.3) no están en el catálogo de 62 eventos ni tienen criterio aprobado; quedan para C6/C8. Las mutaciones C5 auditan y, cuando aplique, publican por outbox al catálogo vigente.
- **Errores estables reutilizables:** `RESOURCE_NOT_FOUND`, `VALIDATION_FAILED`, `INVALID_STATE_TRANSITION`, `SESSION_CANCELLED` (si se aprueba; si no, `INVALID_STATE_TRANSITION`), `ATTENDANCE_INVALID_ENROLLMENT`, `EVALUATION_SCALE_INVALID`, `EVALUATION_DUPLICATE`, `IDEMPOTENCY_KEY_REUSED`. Los códigos nuevos requieren D76 y prueba de contrato antes de congelar.
- **`manage`:** se mantiene la corrección de C4 (expansión concreta, sin `*`); `evaluation:read` implica `read_own`, verificado en `permissions.spec.ts`.

## 6. Contrato y reconciliación con Rol C

La fuente canónica es `packages/contracts/openapi.json`, generada NestJS → Swagger → `contracts:generate`. El YAML `docs/contratos/api-v1.openapi.yaml` sigue siendo referencia histórica y **no se edita**.

| Elemento | Estado al cierre de C4 | Acción en C5 |
| --- | --- | --- |
| Programas, grupos, estudiantes, matrículas y horarios | 17 `operationId` canónicos; `client.ts` y pantallas pendientes | Rol C debe consumir los esquemas generados antes de la demo C5 |
| Sesiones, asistencia y evaluación | Operaciones OP-24/25/26/27/28/37/38/39/40/41 solo en la matriz C0 | RB1-42 publica esquemas concretos; Rol C ajusta pantallas y elimina mocks |
| Indicadores | Tabla y eventos previstos, sin rutas | `GET` implícito en la evaluación; sin CRUD (D73) |
| Códigos de error | `x-error-codes` por operación | RB1-42 los concreta; la matriz de autorización se extiende a 51 filas |
| Clientes | `apps/web/src/api/client.ts` escrito a mano | Regenerar/alinear en la compuerta de congelamiento (PA-005) |

Regla: si una Pantalla necesita una forma distinta a la del contrato, se registra como solicitud de cambio; Rol B **no** implementa las formas del mock en el backend.

## 7. Endurecimiento y operación

| Tarea | Evidencia mínima | Límite conocido |
| --- | --- | --- |
| RB1-44 TLS/HSTS | Configuración del proxy desplegado + escaneo con resultado; `Strict-Transport-Security: max-age=31536000; includeSubDomains` | No hay entorno de preproducción en el host; C7 revisará cabeceras de aplicación |
| RB1-45 Secretos | `pnpm security:secrets`, inventario de `kid`, acta de rotación con ambas claves válidas y retiro de la anterior; `pnpm arch:check` y privilegios de roles | Los secretos reales viven fuera del repositorio; no se pegan valores en evidencia |
| RB1-46 Respaldo | Acta de simulacro con hora de inicio/fin, `pg_dump`/WAL, cifrado verificado, restauración en base separada y comparación de conteos/hash de auditoría | RPO/RTO dependen de infraestructura (SUP-004/005); sin infra, el criterio queda pendiente |
| RB1-47 Alertas y límites | Reglas de alerta y acta de simulacro; revisión de `RATE_LIMITS` contra el informe de carga; `pnpm test:security` y grep de logs | `/metrics` debe quedar restringido en producción (runbook `operacion.md` §2) |
| RB1-43 Purga | Prueba de purga de filas expiradas de idempotencia/outbox sin afectar eventos pendientes; deuda C3/C4 cerrada | Reintentos de entrega y correo real siguen fuera de alcance |

Runbooks a completar/verificar: `docs/runbook/rotacion-secretos.md` (actualizar inventario con `PII_ENCRYPTION_KEY`/`PII_HMAC_KEY` y `kid`), `docs/runbook/operacion.md` (alertas), `docs/runbook/respaldo-restauracion.md` (nuevo), y los existentes de incidente y break-glass. No se modifica ningún runbook sin su prueba asociada.

## 8. Prueba de carga, regresión y demo

**Carga (RB1-48).** Escenarios sobre PostgreSQL real: login + MFA, `/me`, alta de matrícula, `PUT` de asistencia, alta de evaluación y consultas propias. 200 VUs, duración y *ramp-up* registrados en el informe. Umbral: p95 < 4 s y 0 respuestas 5xx. Si se supera, se ajustan índices/pool o límites (PA-009) y se repite; no se baja el objetivo.

**Regresión y E2E (RB1-49).** Debe incluir: C1 arquitectura y migraciones; C2 auth/RBAC/auditoría; C3 archivos/notificaciones; C4 académico A; C5 académico B; y verificación de que el frontend regenerado llama al contrato canónico. Las pruebas que hoy son de servicio (404 por ámbito, cabeceras, notificación sin vínculo) se elevan a HTTP en RB1-43.

**Demo de compuerta (RB1-50).** Secuencia: crear programa y grupo → matricular estudiante → confirmar/activar → crear sesión → `realizada` → `PUT` de asistencia (repetir con la misma clave para demostrar idempotencia) → alta y corrección de evaluación → consulta `/me/evaluations` → inspección de `evento_auditoria` y `evento_outbox` → consulta de métricas y respuesta a una alerta simulada → restauración de respaldo en base separada. Cada paso enlaza a una prueba o acta.

## 9. Riesgos, bloqueos y preguntas abiertas

| Riesgo / bloqueo | Impacto | Mitigación / decisión |
| --- | --- | --- |
| C4 sin firma y frontend con mocks | La demo C5 no es creíble ni se puede congelar | §1.1: firmar C4 y confirmar ajuste de Rol C antes de abrir código |
| CI de GitHub no ejecutado como pipeline; Docker/MinIO no disponibles | AC-SEC-32 y parte de AC-SEC-33/AC-SEC-31 sin evidencia | Ejecutar los mismos comandos en local y marcar el pipeline como pendiente de entorno; no declarar verde |
| Sin preproducción con TLS ni respaldos | AC-SEC-23, AC-SEC-33 y AC-AUD-15 no verificables | Solicitar entorno; mientras tanto, revisar configuración y dejar el criterio como pendiente |
| Escala de evaluación no definida en el diccionario | `valor` queda ambiguo y bloquea el congelamiento | D73 propone escala cerrada; ratificar con Rol A antes de RB1-41 |
| `asistencia.corregida` e `indicador.*` sin operación | Posible incumplimiento de AC-AUD-13 (eventos obligatorios referenciados) | D72/D73 los declaran reservados y el validador documenta el tratamiento; si el equipo exige referencia, abrir solicitud de cambio |
| Límites de tasa ajustados tras carga (PA-009) | Cambio de comportamiento sobre contrato congelado | Congelar `RATE_LIMITS` solo tras RB1-48 y registrar el valor aprobado |
| Purga de outbox con reintentos de entrega | Pérdida de notificaciones | RB1-43 purga solo filas terminales con retención explícita; reintentos reales quedan para C8 |
| SUP-008 (antimalware stub) y correo stub | Falsa sensación de protección/entrega | Mantener declarados en el paquete y no marcar como verificados |

Preguntas que C5 debe resolver o dejar registradas: PA-009 (límites definitivos), PA-011 (retención), PA-016 (integridad criptográfica de auditoría), SUP-004/SUP-005 (RPO/RTO reales) y SUP-008 (proveedor de antimalware).

## 10. Verificación final y evidencia

Antes de proponer la firma se ejecutan, con resultado adjunto en `docs/reviews/c5/rol-b.md`:

```text
pnpm format && pnpm format:check
pnpm typecheck && pnpm lint && pnpm build
pnpm test                         (API + web)
pnpm test:integration             (PostgreSQL 16 real, ejecución serial)
pnpm test:architecture
pnpm arch:check
pnpm test:contracts && pnpm contracts:validate
pnpm test:security && pnpm security:secrets
pnpm contracts:generate           (51 operaciones / 4 públicas / 62 eventos esperados)
k6 run ...                        (informe de carga adjunto)
acta de simulacro de restauración y de alerta
```

## 11. Próximos pasos

1. Leer y ratificar este plan, D69–D79 y la condición previa de §1.1.
2. Firmar C4 o aceptar explícitamente su deuda; confirmar el ajuste de Rol C.
3. Confirmar entorno disponible para k6, TLS y simulacro de restauración.
4. Solo entonces abrir la Fase 1 (RB1-37) con `ccltpg_migrador` y TDD, registrando cada tarea en `docs/tasks/rol-b/rol-b-it5-registro.md`.
5. **Sin publicación automática:** no se hará `git commit` ni `git push` sin autorización expresa; `main` local sigue con C3 + merge + C4 sin publicar.

## 12. Fuentes

- `docs/diseno-arquitectonico.md` §7.3/§7.4/§9/§10.3/§14/§18.2.
- `docs/requirements/seguridad.md` §3.3/§3.4/§4/§5.
- `docs/contratos/controles-seguridad-v1.md` §2/§4/§7/§8.
- `docs/contratos/matriz-autorizacion-v1.md` §4.3/§4.4/§5.1.
- `docs/contratos/modelo-auditoria-v1.md` (catálogo de eventos), `docs/contratos/reconciliacion-c0.md` (R-008/R-010/R-011).
- `docs/diccionario-datos.md` §3.6–§3.9/§4.
- `docs/reviews/c3/rol-b.md` §7, `docs/reviews/c4/rol-b.md` §7/§9.
- `docs/open-questions.md`, `docs/assumptions.md`, `docs/iteraciones.md`.
- `packages/contracts/openapi.json`, `packages/contracts/events.json`.
