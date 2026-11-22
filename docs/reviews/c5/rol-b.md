# Paquete de revisión — Compuerta 5 (Rol B)

- **Rol:** B — Seguridad, identidad y operación
- **Compuerta:** C5 — Académico B y Release 1.0
- **Estado:** **Académico B ejecutado y verificado localmente; Release 1.0 pendiente de entorno y de firma.** No se propone congelamiento ni etiqueta `release-1.0-rc`.
- **Fecha de verificación:** 22 de noviembre de 2026
- **Plan asociado:** `docs/tasks/rol-b/rol-b-it5-plan.md`
- **Registro de ejecución:** `docs/tasks/rol-b/rol-b-it5-registro.md`
- **Paquete previo:** `docs/reviews/c4/rol-b.md`
- **Regla aplicada:** un criterio sin evidencia enlazada se marca como **pendiente**, nunca como verificado.

## 1. Alcance entregado

| Tarea | Entregable | Estado | Evidencia |
| --- | --- | --- | --- |
| RB1-37 | Migraciones `academic/0009` y `0010`, tipos Kysely, puertos y reglas de dominio | **Cumplido** | `up → down → up` en `migrator.spec.ts`: 4 tablas, 7 índices/unicidades y escala cerrada de 4 valores |
| RB1-38 | Sesiones de clase (OP-24/25/37/38) | **Cumplido con límite HTTP** | `SessionService`, repositorio Kysely, 2 controladores; integración: idempotencia, 404 al ajeno, transición inválida 409 y `clase.*` |
| RB1-39 | Asistencia (OP-26/39) | **Cumplido con límite HTTP** | Idempotencia por estado resultante (D72/R-010), unicidad en BD, validación de matrículas, `asistencia.registrada` auditado dos veces (alta y corrección) |
| RB1-40 | Indicadores y escala | **Cumplido (D73)** | Catálogo sembrado por migración; sin CRUD ni ruta propia; se conservan 51 operaciones |
| RB1-41 | Evaluación cualitativa (OP-27/28/40/41) | **Cumplido con límite HTTP** | Unicidad, escala, periodo, vista propia y observación redactada en auditoría; errores `EVALUATION_SCALE_INVALID` y `EVALUATION_DUPLICATE` |
| RB1-42 | Contrato, permisos y matriz | **Cumplido con ratificación pendiente** | `contracts:generate` + `contracts:validate`: 51/4/62; matriz ejecutable 51 × 3 perfiles (244 pruebas) |
| RB1-43 | Cierre de deuda HTTP de C4 | **Pendiente** | Sin cliente HTTP de integración: los 404 por ámbito y cabeceras siguen verificados en servicios/matriz, no con petición real |
| RB1-44 | TLS y cabeceras de transporte | **Pendiente de entorno** | No hay preproducción; no se sustituye por configuración local |
| RB1-45 | Secretos, rotación y cadena de suministro | **Parcial** | `security:secrets` y SCA local verdes; acta de rotación con doble `kid` y pipeline de GitHub pendientes |
| RB1-46 | Respaldo, restauración y retención | **Pendiente de entorno** | Sin simulacro ni tiempos RPO/RTO medidos; sin runbook nuevo sin prueba asociada |
| RB1-47 | Observabilidad, alertas y límites de tasa | **Pendiente** | Sin simulacro de alerta ni informe de carga que justifique ajustar `RATE_LIMITS` |
| RB1-48 | Prueba de carga k6 | **Pendiente de entorno** | No se ejecutó; no hay informe de p50/p95/p99 ni evidencia de 200 VUs |
| RB1-49 | Regresión y extremo a extremo | **Parcial** | Regresión local verde (API, web, integración, arquitectura, contrato, seguridad); demo con cliente real y frontend regenerado pendientes de Rol C |
| RB1-50 | Paquete de revisión y cierre | **Parcial** | Este documento y el registro de ejecución; sin acta de firma ni propuesta de etiqueta |

No se modificaron documentos congelados. El único cambio en el validador de
contrato fue la plantilla `clase.<estado>` (`contract-validation.mjs`), cuyas
dos expansiones ya existían en el catálogo de 62 eventos.

## 2. Decisiones D69–D79 aplicadas

La orden «empieza la iteración 5» se registró como ratificación de las
decisiones y aceptación de la deuda de C4; el acta formal sigue pendiente.

| Decisión | Aplicación | Límite |
| --- | --- | --- |
| D69 — Alcance | Solo Académico B + endurecimiento local; C6/C7/C8 fuera; correo y antimalware siguen detrás de puertos | — |
| D70 — Esquema | Cuatro tablas en `academic`, sin FK cruzadas a `public`; DDL solo del migrador | — |
| D71 — Sesiones | `programada → realizada|cancelada`; solo `realizada` admite asistencia | 404 por ámbito verificado en servicio, no HTTP |
| D72 — Asistencia | `PUT` reemplaza el conjunto; idempotente por estado resultante; `asistencia.corregida` y `attendance:update` reservados | Idempotencia verificada en integración de servicio |
| D73 — Indicadores | Catálogo sembrado con `programa_id` nulo y escala cerrada; sin CRUD; `indicador.*` reservado | — |
| D74 — Evaluación | Unicidad y escala verificadas; observación redactada como `{"cambiado": true}` | Redacción comprobada en `evento_auditoria` |
| D75 — Ámbito | Guard de servidor: educador dueño / administrador / matrícula propia; ajeno → 404 | Sin prueba HTTP |
| D76 — Contrato | 10 `operationId` nuevos; 41 → 51; 4 públicas, 62 eventos, 37 permisos sin cambios | Firma pendiente |
| D77 — Endurecimiento | Controles locales verdes | TLS real, rotación con doble `kid`, CI y purga programada pendientes |
| D78 — Carga y recuperación | Sin estimaciones | k6 y simulacro de restauración no ejecutados |
| D79 — Congelamiento | No se etiqueta | Requiere firma y cliente regenerado |

## 3. Contrato y autorización

- **51 operaciones** (41 de C4 + 10 de C5), **4 públicas**, **62 eventos**, **37 permisos**.
- Nuevos `operationId`: `createSession`, `transitionSession`, `getSession`,
  `listGroupSessions`, `replaceAttendance`, `getSessionAttendance`,
  `createEvaluation`, `listEvaluations`, `updateEvaluation`, `getMyEvaluations`.
- Códigos de error estables nuevos: `ATTENDANCE_INVALID_ENROLLMENT`,
  `EVALUATION_SCALE_INVALID`, `EVALUATION_DUPLICATE`. `SESSION_CANCELLED` no se
  introdujo: se reutiliza `INVALID_STATE_TRANSITION` (D71).
- La matriz ejecutable amplía la cobertura a 51 `operationId` × 3 perfiles con
  caso permitido y denegado (244 pruebas verdes).
- `docs/contratos/api-v1.openapi.yaml` permanece como referencia histórica;
  Rol C debe alinearse a `packages/contracts/openapi.json`.

## 4. Evidencia de pruebas

| Comando | Resultado |
| --- | --- |
| `pnpm format:check` | verde |
| `pnpm typecheck` | verde |
| `pnpm lint` | verde |
| `pnpm build` | verde |
| `pnpm test` | API 391/391; web 13/13 |
| `pnpm test:integration` + PostgreSQL 16 real | 5 archivos / 44 pruebas verdes |
| `pnpm test:architecture` | 3/3 |
| `pnpm arch:check` | 0 violaciones (259 módulos, 930 dependencias) |
| `pnpm test:contracts` | 12/12 |
| `pnpm contracts:validate` | 51 operaciones, 4 públicas, 62 eventos |
| `pnpm test:security` | 6/6 |
| `pnpm security:secrets` | sin hallazgos |

`apps/api/test/integration/academic-b-flow.spec.ts` cubre: idempotencia de alta
de sesión, ocultamiento de ámbito ajeno, transición inválida, rechazo de
asistencia en sesión no realizada, idempotencia y corrección de asistencia,
matrícula ajena rechazada, catálogo de indicadores, duplicado y escala inválida
de evaluación, vista propia y redacción de la observación en auditoría.

## 5. Criterios de compuerta

| Condición | Resultado |
| --- | --- |
| C5 completo en seguridad (AC-SEC-23/28/31/32/33) | **Pendiente**: solo AC-SEC-31 tiene evidencia local; 23 y 33 requieren entorno, 28 requiere acta de rotación, 32 requiere pipeline de GitHub |
| Auditoría (AC-AUD-15) | **Pendiente**: retención documentada sin simulacro de restauración |
| Académico B | **Cumple con límite HTTP** en servicios e integración |
| Demo completa | **Pendiente**: falta cliente HTTP y frontend regenerado por Rol C |
| Carga (200 VUs, p95 < 4 s, 0 5xx) | **Pendiente de entorno** |
| Restauración (RPO ≤ 15 min, RTO ≤ 4 h) | **Pendiente de entorno** |
| Congelamiento y etiqueta | **No aplicado** |

## 6. Deuda y próximos pasos

1. Firma formal de C0/C1, C3, C4 y D49–D79, incluidas R-018/R-034/R-035/R-036.
2. Rol C: regenerar `apps/web/src/api/client.ts` y pantallas de sesión,
   asistencia y evaluación; retirar mocks antes de la demo.
3. RB1-43: elevar a HTTP los 404 por ámbito, idempotencia, cabeceras y purga.
4. RB1-44–RB1-48: entorno con TLS, CI, Docker y PostgreSQL de preproducción
   para producir actas de rotación, alerta, carga y restauración.
5. Solo con esas actas y la demo se propone `release-1.0-rc` (D79).

**Publicación:** la orden «continuemos subiendo la iteración 5» autorizó el
`git commit` y `git push` de C5 a `origin/main` con mensaje `iteracion 5 b`. C4
quedó publicada en `a5444c8` (`iteracion 4 b`). La firma formal de la compuerta
y la etiqueta `release-1.0-rc` siguen pendientes (D79); cualquier publicación
posterior requiere autorización expresa.
