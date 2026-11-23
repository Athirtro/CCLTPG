# Plan de trabajo — Iteración 6 (Rol B)

- **Fecha:** 22 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Iteración objetivo:** **C6 — Reportes, dashboards y notificaciones (Release 2.0)**
- **Estado:** **Ejecutada y publicada en `iteracion 6 b`; compuerta no firmada.** RB1-51…RB1-60 ejecutados con la deuda registrada en `docs/reviews/c6/rol-b.md`. La orden «empieza entonces la iteración» ratificó D80–D89 en sus opciones recomendadas (A), por analogía con el inicio de C5. D85 se implementó como ampliación controlada del catálogo a 64 eventos sin editar el documento congelado. C5 quedó publicada en `c91009d` con la deuda de RB1-43 a RB1-48 registrada (D89).
- **Predecesor:** C5 publicada en el commit `iteracion 5 b` (Académico B verificado; deuda de entorno y firma pendiente).
- **Registro predecesor:** `docs/tasks/rol-b/rol-b-it5-registro.md`.
- **Paquete de revisión anterior:** `docs/reviews/c5/rol-b.md`.
- **Paquete de revisión a producir:** `docs/reviews/c6/rol-b.md`.
- **Requisitos:** `docs/vision-alcance.md` (CAR-04, CAR-05, CAR-09; ON-2, ON-3), `docs/requirements/seguridad.md`, R-003 y R-009/R-020 de `docs/contratos/reconciliacion-c0.md`, PA-017 de `docs/open-questions.md`.
- **Controles:** `docs/contratos/controles-seguridad-v1.md` (C-14, C-16, C-19, C-27, C-28, C-31, C-36) y `docs/contratos/modelo-auditoria-v1.md` (catálogo cerrado).
- **Diseño:** `docs/diseno-arquitectonico.md` (§4, §6, §10.3, §12, §14, §18, §19).
- **Contrato:** `packages/contracts/openapi.json` y `packages/contracts/events.json` (canónicos, code-first); `packages/contracts/public-routes.json`.
- **Permisos:** `docs/contratos/gramatica-y-catalogo-permisos-v1.md` (catálogo cerrado de 37; `exports:report:create`, `exports:report:export`, `analytics:kpi:read` ya declarados pero sin asignar).

## 1. Objetivo de la iteración

Cerrar el Release 2.0 sobre los datos ya producidos por C1–C5:

1. **Reportes (CAR-04):** catálogo de reportes automáticos de asistencia, desempeño, matrícula y deserción, exportables en XLSX/PDF/CSV mediante el servicio de exportaciones de C3.
2. **Dashboards (CAR-05):** seis KPIs con definición auditable, consulta única parametrizada por periodo/programa/grupo y ámbito de educador resuelto en servidor.
3. **Notificaciones académicas (CAR-09):** plantillas de `evaluacion.publicada` y `recordatorio.fechas`, preferencias y entrega por el outbox de C3, sin proveedor SMTP real.
4. **Verificación (compuerta):** comparación manual de **tres reportes y tres KPIs** contra consultas directas sobre PostgreSQL, con acta enlazada. Sin esa acta la compuerta no se aprueba.

**Fuera de alcance:** C7 (accesibilidad/responsividad), C8 (retención y anonimización definitivas, integridad criptográfica de auditoría), pagos/contabilidad, correo SMTP real y antimalware real. Rol B no implementa UI: las pantallas de dashboards son competencia de Rol C.

### 1.1 Condición previa

C5 quedó **publicada pero no firmada**. Se mantiene la deuda registrada (RB1-43 a RB1-48, firma de C0/C1/C3/C4/C5 y ajuste del cliente por Rol C). Antes de abrir código de C6 se requiere:

- ratificación explícita de D80–D89 y del estado de la deuda C5;
- que Rol C confirme la regeneración de `apps/web/src/api/client.ts` al contrato de 51 operaciones;
- decisión sobre el catálogo de eventos: ampliarlo a 64 (D85) o dejar CAR-09 diferido;
- confirmación de qué evidencia externa (CI, TLS, k6, PostgreSQL de preproducción) estará disponible. Los criterios sin evidencia se marcan **pendientes de entorno**, nunca verificados.

## 2. Criterios de salida y Compuerta 6

| Condición | Criterio verificable |
| --- | --- |
| Reportes | Cuatro reportes generables en los tres formatos; tres de ellos verificados contra datos crudos, con la misma autorización y auditoría `reporte.generado` que cualquier exportación. |
| KPIs |Seis KPIs con fórmula documentada y consulta reproducible; tres verificados contra SQL directo; ámbito de educador filtrado en servidor y ajeno → 404; sin PII individual en la respuesta. |
| Notificaciones |Dos plantillas académicas publicadas por outbox con preferencias respetadas; críticas no silenciables; registro `notificacion.enviada`/`notificacion.fallida`. Requiere D85 ratificada. |
| Seguridad y auditoría |Sin permisos nuevos (37); asignaciones revisadas; denegación por defecto verificada en la matriz 54 × 3 perfiles; ningún agregado expone PII de grupos pequeños. |
| Contrato canónico |54 operaciones (51 + 3), 4 públicas sin cambios, 64 eventos si D85 es ratificada (62 en caso contrario), 37 permisos; `contracts:generate`/`contracts:validate` en verde. |
| Regresión y demo |C1–C6 en verde (API, web, integración PostgreSQL, arquitectura, contratos, seguridad); recorrido reporte → exportación → KPI → notificación → auditoría con cliente real. |
| Congelamiento |Solo tras firma: rutas, esquemas, códigos de error y catálogo de reportes/KPIs; etiqueta `release-2.0-rc`. |

Regla de bloqueo: un criterio sin evidencia enlazada en `docs/reviews/c6/rol-b.md` no se marca como cumplido. La publicación de C5 **no** implica aprobación de la compuerta C5.

## 3. Alcance propuesto (tareas)

Estado inicial de todas: **propuestas**. Numeración continua desde RB1-50.

| ID | Tarea | Entregable | Criterios que impulsa | Depende de |
| --- | --- | --- | --- | --- |
| RB1-51 | Fundaciones de analítica | Definiciones de reportes y KPIs en código (sin DDL), tipos de aplicación y puertos de consulta; asignación de `exports:report:*` y `analytics:kpi:read` a los perfiles que correspondan; pruebas de denegación por defecto | CAR-04/05, C-14, R-003 | Ratificación de D80–D84; C5 publicada |
| RB1-52 | Catálogo y generación de reportes | `GET /reports/catalog` (OP-50) y `POST /reports/{code}/generate` (OP-51) sobre `createExport`; cuatro definiciones con XLSX/PDF/CSV, límites de filas y tamaño, auditoría `reporte.generado` | CAR-04, AC-AUD-03, C-16 | RB1-51, D81 |
| RB1-53 | KPIs de matrícula y programas | `matricula_activa` y `programas` con período, programa y grupo; respuesta con valor, unidad y fecha de cálculo | CAR-05, D82 | RB1-51 |
| RB1-54 | KPIs de asistencia y evaluación | `asistencia` y `evaluacion` con fórmulas documentadas; distribución de escala sin promedios inventados; ámbito de educador | CAR-05, D82/D83 | RB1-53 |
| RB1-55 | KPIs de deserción y distribución geográfica | `desercion` y `distribucion_geografica` sobre `municipio`, con supresión de celdas < 5; agregados sin PII individual | CAR-05, D82/D84 | RB1-53 |
| RB1-56 | Consulta agregada y caché | `GET /analytics/kpis` (OP-49) con filtros y `?kpi=`; caché Redis con TTL explícito e invalidación por eventos `matricula.*`, `asistencia.registrada`, `evaluacion.*`; degradación a consulta directa si Redis falla | CAR-05, CAR-06, PA-009 | RB1-53–RB1-55, D84 |
| RB1-57 | Notificaciones académicas | Plantillas `evaluacion.publicada` y `recordatorio.fechas`, preferencias, publicación por outbox; cambio controlado del catálogo de eventos si D85 es ratificada | CAR-09, R-009/R-020 | D85, RB1-52 |
| RB1-58 | Contrato, permisos y matriz | 3 `operationId` nuevos con `x-*`, esquemas concretos, matriz 54 × 3 perfiles, validación bidireccional de eventos y cliente regenerado por Rol C | AC-SEC-16/17/20, AC-AUD-13, C-19 | RB1-52–RB1-57, D87 |
| RB1-59 | Verificación manual y acta | Tres reportes y tres KPIs comparados contra SQL directo sobre PostgreSQL real; acta con consultas, resultados y diferencias | Compuerta 6, CAR-04/05 | RB1-52–RB1-56, D86 |
| RB1-60 | Regresión, demo y paquete C6 | `docs/reviews/c6/rol-b.md`, registro de ejecución, demo guiada y propuesta de firma; sin etiqueta automática | Compuerta 6, D88 | RB1-51–RB1-59 |

**Estado final de las tareas:** RB1-51…RB1-59 cumplidos; RB1-60 parcial (regresión local y paquete producidos, demo con cliente real pendiente). El detalle está en `docs/tasks/rol-b/rol-b-it6-registro.md`.

**Delegación a Rol C:** pantallas de dashboards para administración y educadores, gráficas con Recharts, navegación derivada de `/me`, regeneración del cliente desde el contrato canónico y retirada de mocks. Rol B no implementa UI y no adapta el backend a formas del mock.

**Fuera de alcance de Rol B en C6:** permisos fuera del catálogo de 37, vistas materializadas sin evidencia de carga, proveedor SMTP/antimalware real, retención/anonimización efectiva y cierre de RB1-43 a RB1-48.

## 4. Decisiones propuestas para C6 (D80–D89)

Requieren ratificación antes de ejecutar. No se modifica ningún documento congelado sin solicitud de cambio aprobada.

| Decisión | Propuesta | Recomendación | Reversibilidad |
| --- | --- | --- | --- |
| D80 — Alcance | Reportes, KPIs y notificaciones académicas para Release 2.0; C7/C8 y la deuda C5 quedan fuera | **A — fijar alcance** | Media |
| D81 — Reportes | Cuatro definiciones en código sobre `createExport`, con `exports:report:create`/`export`; sin tablas ni migración nueva; `GET /reports/catalog` y `POST /reports/{code}/generate` | **A — reutilizar C3** | Barata |
| D82 — KPIs | Seis KPIs con fórmula cerrada: `matricula_activa` (estados `preinscrita`/`confirmada`/`activa`), `asistencia` (`presente + tarde` sobre registros de sesiones `realizada`), `evaluacion` (`excelente + bueno` sobre evaluaciones del periodo, con distribución), `programas` (programas `publicado` y grupos `abierto`), `desercion` (`retirada` sobre activas + finalizadas + retiradas), `distribucion_geografica` (conteo por `municipio` con celdas < 5 suprimidas). Sin promedios ponderados | **A — definir antes de consultar** | Media |
| D83 — Ámbito | Administrador ve todo; educador solo sus grupos; estudiante no accede a analítica (usa `/me/evaluations`); ajeno → 404 `RESOURCE_NOT_FOUND`; colecciones sin totales ajenos | **A — guard + filtro en repositorio** | Costosa tras congelar |
| D84 — Caché y PII | Caché Redis con TTL corto e invalidación por eventos; si Redis falla, se consulta la BD (disponibilidad), nunca se devuelve dato ajeno; respuestas solo agregados, sin PII individual; la exportación de reportes sigue auditada con `reporte.generado` | **A — agregados seguros** | Media |
| D85 — Eventos | Añadir `evaluacion.publicada` y `recordatorio.fechas` al catálogo (62 → 64) mediante solicitud de cambio a `modelo-auditoria-v1.md`; si no se ratifica, CAR-09 queda diferido y el catálogo se mantiene en 62 | **A — ampliar con acta** | Costosa tras congelar |
| D86 — Verificación | Tres reportes y tres KPIs comparados contra consultas directas; acta con fecha, consulta, resultado y tolerancia cero para conteos; sin acta no hay firma | **A — verificar, no estimar** | Barata |
| D87 — Contrato | 51 → 54 operaciones, 4 públicas y 37 permisos sin cambios; eventos 64 si D85, 62 si no; `docs/contratos/api-v1.openapi.yaml` sigue siendo referencia histórica | **A — code-first** | Costosa tras congelar |
| D88 — Congelamiento | Etiqueta `release-2.0-rc` solo tras firma de C6 y cliente Rol C regenerado; C7 puede abrirse con contrato congelado | **A — firmar antes de etiquetar** | Costosa tras etiquetar |
| D89 — Deuda C5 | La publicación de C5 no cierra RB1-43 a RB1-48; C6 registra su estado y no reutiliza su deuda como evidencia | **A — arrastrar explícitamente** | Barata |

## 5. Operaciones, permisos y auditoría

| OP | Operación | Permiso | Ámbito | Auditoría |
| --- | --- | --- | --- | --- |
| OP-49 | `GET /analytics/kpis` | `analytics:kpi:read` | mixed | — (solo agregados; exportación aparte) |
| OP-50 | `GET /reports/catalog` | `exports:report:create` **o** `exports:report:export` | global | — |
| OP-51 | `POST /reports/{code}/generate` | `exports:report:create` | mixed | `reporte.generado` |

- **Totales esperados:** **54 operaciones**, **4 públicas**, **37 permisos**; **64 eventos** si D85 es ratificada, **62** en caso contrario. Cualquier desviación se documenta antes de firmar.
- **Asignaciones:** `exports:report:create`/`export` y `analytics:kpi:read` no están hoy en ninguna semilla de perfil; su asignación forma parte de RB1-51 y debe quedar reflejada en la matriz ejecutable. No se crean permisos nuevos.
- **Notificaciones:** la publicación de plantillas usa el outbox existente; el evento `reporte.generado` ya está en el catálogo. Los dos eventos nuevos de D85 requieren cambio controlado y se documentan como **reservados** hasta que exista productor.
- **Errores estables reutilizables:** `RESOURCE_NOT_FOUND`, `VALIDATION_FAILED`, `FORBIDDEN`, `INVALID_PERIOD`, `REPORT_NOT_FOUND`, `KPI_NOT_FOUND`. Los dos últimos son nuevos y requieren prueba de contrato antes de congelar.
- **`manage`:** se mantiene la expansión concreta de C4/C5; `export` implica acceso a reportes, sin comodines nuevos.

## 6. Contrato y reconciliación con Rol C

La fuente canónica sigue siendo `packages/contracts/openapi.json`. El YAML `docs/contratos/api-v1.openapi.yaml` no se edita.

| Elemento | Estado al cierre de C5 | Acción en C6 |
| --- | --- | --- |
| Académico A/B | 51 `operationId` canónicos; cliente y pantallas pendientes | Rol C debe consumir el contrato generado antes de la demo C6 |
| Reportes y KPIs | Permisos `exports`/`analytics` declarados, sin endpoints funcionales (R-003) | RB1-58 publica OP-49/50/51 con esquemas concretos |
| Dashboards | Sin implementar | Rol C implementa gráficas sobre los KPIs; Rol B valida que no se filtre PII |
| Notificaciones académicas | Sin plantillas `evaluacion.publicada`/`recordatorio.fechas` | D85 decide ampliación del catálogo o diferimiento |
| Clientes | `apps/web/src/api/client.ts` escrito a mano | Regenerar/alinear en la compuerta de congelamiento (PA-005) |

Regla: si una pantalla necesita una forma distinta a la del contrato, se registra como solicitud de cambio. Rol B no implementa las formas del mock en el backend.

## 7. Seguridad, caché y operación

| Tema | Evidencia mínima | Límite conocido |
| --- | --- | --- |
| Ámbito | Prueba de educador A sobre grupo B → 404; matriz 54 × 3 perfiles; sin totales ajenos en agregados | Sin cliente HTTP real hasta Rol C |
| PII | `distribucion_geografica` solo con `municipio` agregado y supresión < 5; ninguna respuesta con documento, teléfono o dirección | La consulta individual sigue auditada por C4 |
| Caché | TTL documentado, invalidación por evento probada y prueba de degradación sin Redis | No se mide hit-rate sin entorno de carga |
| Auditoría | `reporte.generado` en cada exportación; ninguna observación copiada literalmente a auditoría (AC-AUD-08) | Catálogo de eventos requiere D85 para crecer |
| Límites | `RATE_LIMITS` vigentes de C5; ajuste solo tras informe de carga (PA-009) | k6 sigue pendiente de entorno |
| Endurecimiento | `security:secrets`, `test:security`, `arch:check` en verde | TLS, CI de GitHub y rotación con doble `kid` siguen pendientes |

Runbooks: no se modifica ninguno sin prueba asociada. `docs/runbook/respaldo-restauracion.md` sigue pendiente de entorno (RB1-46).

## 8. Verificación manual, regresión y demo

**Verificación manual (RB1-59).** Sobre PostgreSQL real: (1) reporte de asistencia, (2) reporte de matrícula, (3) reporte de deserción; y (4) `asistencia`, (5) `matricula_activa`, (6) `evaluacion`. Para cada uno se registra consulta SQL directa, valor del endpoint y diferencia; tolerancia cero en conteos y porcentajes redondeados a dos decimales. El acta se enlaza desde `docs/reviews/c6/rol-b.md`.

**Regresión (RB1-60).** Debe incluir C1 arquitectura y migraciones, C2 auth/RBAC/auditoría, C3 archivos/notificaciones/exportaciones, C4 académico A, C5 académico B y C6 reportes/KPIs, además de la verificación de que el frontend regenerado llama al contrato canónico.

**Demo de compuerta.** Seleccionar programa y grupo → generar reporte → descargar exportación → consultar tres KPIs → publicar notificación académica → inspeccionar `evento_auditoria` y `evento_outbox` → mostrar que un educador ajeno recibe 404. Cada paso enlaza a una prueba o acta.

## 9. Riesgos, bloqueos y preguntas abiertas

| Riesgo / bloqueo | Impacto | Mitigación / decisión |
| --- | --- | --- |
| C5 publicada sin firma y con deuda de entorno | La demo C6 no puede dar por cerrado Release 1.0 | D89: arrastrar deuda; C6 no la reutiliza como evidencia |
| Definición de KPIs ambigua | Dashboard incorrecto y pérdida de confianza | D82 fija fórmulas antes de consultar; RB1-59 verifica contra SQL |
| Agregados que filtran PII de grupos pequeños | Incumplimiento de privacidad | Supresión < 5, sin PII individual y ámbito filtrado en servidor |
| Catálogo de eventos cerrado | CAR-09 no se puede completar sin cambio controlado | D85: ampliación con acta o diferimiento explícito |
| Permisos `exports`/`analytics` sin asignar | Operaciones inalcanzables | RB1-51 asigna sin crear permisos nuevos y actualiza la matriz |
| Caché con datos ajenos | Fuga entre educadores | Clave de caché incluye actor/ámbito; invalidación por evento y prueba de aislamiento |
| Rol C sin regenerar cliente | Demo y congelamiento inválidos | PA-005: regenerar en C6; si no, la compuerta queda pendiente |
| PA-009 (límites de tasa) sin informe de carga | No se pueden fijar valores definitivos | Mantener los vigentes y marcar el ajuste como pendiente |

Preguntas que C6 debe resolver o dejar registradas: PA-005 (cliente regenerado), PA-009 (límites), PA-017 (AC-FUN de CAR-04/05), SUP-004/SUP-005 (entorno), SUP-008 (antimalware).

## 10. Verificación final y evidencia

Antes de proponer la firma se ejecutan, con resultado adjunto en `docs/reviews/c6/rol-b.md`:

```text
pnpm format:check
pnpm typecheck && pnpm lint && pnpm build
pnpm test                          (API + web)
pnpm test:integration              (PostgreSQL 16 real, ejecución serial)
pnpm test:architecture
pnpm arch:check
pnpm test:contracts && pnpm contracts:validate
pnpm test:security && pnpm security:secrets
pnpm contracts:generate            (54 operaciones / 4 públicas / 64 o 62 eventos)
acta de verificación de 3 reportes y 3 KPIs contra datos crudos
demo con cliente regenerado por Rol C
```

## 11. Próximos pasos

1. Leer y ratificar este plan y D80–D89; pronunciarse sobre D85 (catálogo de eventos).
2. Confirmar el estado real de la deuda C5 (RB1-43 a RB1-48) y del cliente de Rol C.
3. Confirmar entorno disponible para CI, PostgreSQL de preproducción y k6.
4. Solo entonces abrir RB1-51 con TDD, registrando cada tarea en `docs/tasks/rol-b/rol-b-it6-registro.md`.
5. **Publicación:** el plan no autorizaba `git commit` ni `git push`; la orden posterior «continuemos subiendo la iteración 6 y hagamos lo que se pueda de la 6» autorizó el commit y push con mensaje `iteracion 6 b`. La firma y la etiqueta siguen sujetas a evidencia externa y a Rol C.

## 12. Fuentes

- `docs/vision-alcance.md` (CAR-04, CAR-05, CAR-09; ON-2, ON-3; releases 2.0).
- `docs/diseno-arquitectonico.md` (§4, §6, §10.3, §12, §14, §18, §19).
- `docs/contratos/reconciliacion-c0.md` (R-003, R-009, R-020).
- `docs/contratos/gramatica-y-catalogo-permisos-v1.md` (catálogo de 37 permisos).
- `docs/contratos/matriz-autorizacion-v1.md`, `docs/contratos/modelo-auditoria-v1.md`.
- `docs/open-questions.md` (PA-005, PA-009, PA-017), `docs/assumptions.md` (SUP-004/005/008).
- `docs/reviews/c5/rol-b.md` (deuda y límites heredados).
- `packages/contracts/openapi.json`, `packages/contracts/events.json`.
