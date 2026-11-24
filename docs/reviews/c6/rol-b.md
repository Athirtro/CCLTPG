# Paquete de revisión — Compuerta 6 (Rol B)

- **Rol:** B — Seguridad, identidad y operación
- **Compuerta:** C6 — Reportes, dashboards/KPIs y notificaciones (Release 2.0)
- **Estado:** **Código ejecutado y verificado localmente; compuerta no firmada.** No se propone congelamiento ni etiqueta `release-2.0-rc`.
- **Fecha de verificación:** 22 de noviembre de 2026
- **Plan asociado:** `docs/tasks/rol-b/rol-b-it6-plan.md`
- **Registro de ejecución:** `docs/tasks/rol-b/rol-b-it6-registro.md`
- **Acta RB1-59:** `docs/reviews/c6/verificacion-reportes-kpis.md`
- **Paquete previo:** `docs/reviews/c5/rol-b.md`
- **Regla aplicada:** un criterio sin evidencia enlazada se marca como **pendiente**, nunca como verificado.

## 1. Alcance entregado

| Tarea | Entregable | Estado | Evidencia |
| --- | --- | --- | --- |
| RB1-51 | Fundaciones de analítica | **Cumplido** | Catálogo de 4 reportes y 6 KPIs; 37 permisos sin cambios; pruebas de definiciones y perfiles |
| RB1-52 | Reportes OP-50/OP-51 | **Cumplido con límite HTTP** | `ReportGenerationService` sobre `ExportsService`: auditoría `reporte.generado`, outbox e idempotencia; ámbito en SQL |
| RB1-53 | KPIs de matrícula y programas | **Cumplido con límite HTTP** | `matricula_activa` y `programas`, valor/unidad/fecha de cálculo |
| RB1-54 | KPIs de asistencia y evaluación | **Cumplido con límite HTTP** | Fórmulas D82; distribución de escala sin promedios inventados |
| RB1-55 | Deserción y distribución geográfica | **Cumplido con límite HTTP** | `municipio` agregado, celdas < 5 suprimidas, sin PII individual |
| RB1-56 | Caché y degradación | **Cumplido sin medición de carga** | Redis TTL 60 s, generación invalidable, degradación probada en unitario e integración |
| RB1-57 | Notificaciones académicas | **Cumplido con correo stub** | Enmienda D85, migración 0008, productores transaccionales y cuatro plantillas entregadas |
| RB1-58 | Contrato, permisos y matriz | **Cumplido con cliente pendiente** | 54/4/64; matriz 54 × 3 perfiles; Rol C no regeneró cliente |
| RB1-59 | Verificación manual | **Cumplido** | Acta con 3 reportes y 3 KPIs contra SQL directo, tolerancia cero |
| RB1-60 | Regresión, demo y paquete | **Parcial** | Regresión local verde; demo con cliente real pendiente de Rol C; sin firma ni etiqueta |

No se modificaron documentos congelados. `modelo-auditoria-v1.md` sigue intacto; los dos eventos nuevos se incorporan mediante `docs/contratos/cambios/cambio-eventos-c6.md` y `events.json` conserva `version: "1.0"`.

## 2. Decisiones D80–D89 aplicadas

La orden «empieza entonces la iteración» se registró como ratificación de D80–D89 en sus opciones recomendadas (A); el acta formal sigue pendiente.

| Decisión | Aplicación | Límite |
| --- | --- | --- |
| D80 — Alcance | Reportes, KPIs y notificaciones; C7/C8 y deuda C5 fuera | — |
| D81 — Reportes | Cuatro definiciones en código sobre `createExport`; sin DDL de reportes | Límite HTTP: verificado en servicios/integración |
| D82 — KPIs | Seis fórmulas cerradas y reproducibles | Verificación en `verificacion-reportes-kpis.md` |
| D83 — Ámbito | Administrador global; educador filtrado en servidor; ajeno → 404 | Sin petición HTTP real hasta Rol C |
| D84 — Caché y PII | Agregados seguros, TTL corto, invalidación y degradación a BD | Sin hit-rate ni informe de carga |
| D85 — Eventos | 62 → 64 por enmienda controlada; crítico por prefijo `evaluacion.` | Catálogo congelado sin editar |
| D86 — Verificación | Tres reportes y tres KPIs contra PostgreSQL real | No cubre evidencia externa |
| D87 — Contrato | 51 → 54 operaciones; 4 públicas y 37 permisos sin cambios | Cliente no regenerado |
| D88 — Congelamiento | Sin etiqueta sin firma | `release-2.0-rc` no aplicado |
| D89 — Deuda C5 | RB1-43 a RB1-48 arrastrada, no reutilizada como evidencia | Firma de C0/C1/C3/C4/C5 pendiente |

## 3. Contrato y autorización

- **54 operaciones**, **4 públicas**, **64 eventos**, **37 permisos**.
- Nuevos `operationId`: `listReportCatalog`, `generateReport`, `getKpis`.
- Códigos de error estables nuevos: `REPORT_NOT_FOUND`, `KPI_NOT_FOUND`; se reutilizan `RESOURCE_NOT_FOUND`, `VALIDATION_FAILED` y `INVALID_PERIOD`.
- Matriz ejecutable: 54 `operationId` × 3 perfiles, con caso permitido y denegado.
- Ámbito ajeno: `404 RESOURCE_NOT_FOUND`, sin totales ni filas de otro educador (integración y unitario).
- `docs/contratos/api-v1.openapi.yaml` permanece como referencia histórica; Rol C debe alinearse a `packages/contracts/openapi.json`.

## 4. Evidencia de pruebas

| Comando | Resultado |
| --- | --- |
| `pnpm format:check` | verde |
| `pnpm typecheck` | verde |
| `pnpm lint` | verde |
| `pnpm build` | verde (solo aviso de tamaño de chunk en web) |
| `pnpm test` | API 419/419; web 13/13 |
| `pnpm test:integration` + PostgreSQL 16 real | 6 archivos / 49 pruebas verdes |
| `pnpm test:architecture` | 3/3 |
| `pnpm arch:check` | 0 violaciones (282 módulos, 1008 dependencias) |
| `pnpm test:contracts` | 13/13 |
| `pnpm contracts:lint` | 0 errores; 36 advertencias preexistentes de estilo |
| `pnpm contracts:generate` | 54/4/64; 62 eventos base + 1 enmienda; sin deriva tras regenerar |
| `pnpm contracts:validate` | 54 operaciones, 4 públicas, 64 eventos |
| `pnpm test:security` | 6/6 |
| `pnpm security:secrets` | sin hallazgos |

`apps/api/test/integration/analytics-c6-flow.spec.ts` cubre la coincidencia de reportes y KPIs contra SQL directo, supresión de celdas < 5, reutilización e invalidación de caché, ocultamiento de ámbito ajeno y entrega de los dos eventos de D85 con sus cuatro plantillas y registros `notificacion.enviada`.

## 5. Criterios de compuerta

| Condición | Resultado |
| --- | --- |
| Reportes verificados contra datos crudos | **Cumple** (acta RB1-59) |
| KPIs verificados contra SQL directo | **Cumple** (acta RB1-59) |
| Notificaciones por outbox con preferencias y plantillas | **Cumple con correo stub**; críticas no silenciables |
| Seguridad y auditoría (37 permisos, matriz, sin PII) | **Cumple en código**; sin petición HTTP real |
| Contrato canónico 54/4/37/64 | **Cumple**; cliente de Rol C pendiente |
| Regresión C1–C6 | **Cumple localmente**; falta verificación del frontend regenerado |
| Demo con cliente real | **Pendiente de Rol C** |
| CI de GitHub, TLS/preproducción, Docker/MinIO, k6 y respaldo/restauración | **Pendiente de entorno** |
| Congelamiento y etiqueta | **No aplicado** |

## 6. Deuda y próximos pasos

1. Firma formal de C0/C1/C3/C4/C5/C6 y de D49–D89, incluidas las decisiones ratificadas por las órdenes de inicio.
2. Rol C: regenerar `apps/web/src/api/client.ts`, retirar mocks, implementar dashboards y ejecutar la demo de reporte → exportación → KPI → notificación → auditoría.
3. RB1-43 a RB1-48: entorno con TLS, CI, Docker y PostgreSQL de preproducción para producir actas de rotación, alerta, carga y restauración.
4. Solo con esas actas y la demo se propone `release-2.0-rc` (D88).

**Publicación:** la orden «continuemos subiendo la iteración 6 y hagamos lo que se pueda de la 6» autorizó el `git commit` y `git push` de C6 a `origin/main` con mensaje `iteracion 6 b` (`0ecbe32`, verificado en `origin/main`). La firma formal de la compuerta y la etiqueta `release-2.0-rc` siguen pendientes (D88); C7/C8 no se publican. Cualquier publicación posterior requiere autorización expresa.
