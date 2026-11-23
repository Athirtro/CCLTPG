# Registro de ejecución — Iteración 6 (Rol B)

- **Fecha:** 22 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Alcance:** RB1-51 a RB1-60 (plan `docs/tasks/rol-b/rol-b-it6-plan.md`)
- **Paquete de revisión:** `docs/reviews/c6/rol-b.md`
- **Acta RB1-59:** `docs/reviews/c6/verificacion-reportes-kpis.md`
- **Predecesor:** `docs/tasks/rol-b/rol-b-it5-registro.md`

> La orden «empieza entonces la iteración» se registró, por analogía con el
> inicio de C5, como ratificación de D80–D89 en sus opciones recomendadas (A).
> En particular, **D85 = ampliar el catálogo de eventos a 64** con una
> solicitud de cambio controlada; no se editó `modelo-auditoria-v1.md`.
> C5 quedó publicada en `c91009d` (`iteracion 5 b`) sin firma formal: RB1-43 a
> RB1-48, Rol C y el entorno externo siguen pendientes y no se reutilizan como
> evidencia de C6 (D89).

## 1. Entorno verificado

| Herramienta | Versión | Nota |
| --- | --- | --- |
| Node.js | 22.19.0 | Igual que C4/C5 |
| pnpm | 9.15.4 | Lockfile congelado; sin dependencias nuevas |
| PostgreSQL | 16 embebido | Harness local en el puerto 55432, 49 pruebas de integración |
| Docker / MinIO | no ejecutables | Deuda heredada; evidencia externa pendiente |

## 2. Ejecución por tarea

### RB1-51 — Fundaciones de analítica

- Catálogo cerrado de 4 reportes y 6 KPIs en `analytics-definitions.ts`, con fórmula verificable, formatos pdf/xlsx/csv y umbral de supresión de 5.
- Tipos, códigos de error estables y puerto de consultas agregadas sin registros individuales.
- `exports:report:create` y `analytics:kpi:read` asignados a administrador y educador; el estudiante no los recibe. Catálogo de permisos inalterado en 37.
- Pruebas `analytics-definitions.spec.ts` y `perfiles.spec.ts`.

### RB1-52 — Catálogo y generación de reportes

- `KyselyReportDataProvider` aplica periodo/programa/grupo/ámbito en SQL; el puerto compartido vive en `shared/analytics` para respetar `arch:check`.
- `ReportGenerationService` reutiliza `ExportsService`: misma auditoría `reporte.generado`, misma outbox y `Idempotency-Key` obligatoria.
- `ReportsController` expone OP-50 (`GET /reports/catalog`) y OP-51 (`POST /reports/{code}/generate`) con DTOs concretos.

### RB1-53…RB1-55 — KPIs

- `KyselyKpiRepository` implementa los seis agregados D82; `KpiService` aplica la fórmula, el desglose y la supresión de celdas < 5.
- La clave de caché incluye filtro, ámbito resuelto y códigos; un educador ajeno recibe `404 RESOURCE_NOT_FOUND` antes de consultar.
- La distribución geográfica usa solo `municipio` agregado.

### RB1-56 — Caché y degradación

- `RedisKpiCache` con TTL de 60 s y generación invalidable; `KpiCacheInvalidator` reacciona a `matricula.*`, `asistencia.*` y `evaluacion.*`.
- Pruebas: reutilización e invalidación en integración; degradación de Redis y consulta directa en `kpi.service.spec.ts` y `redis-kpi.cache.spec.ts`.

### RB1-57 — Notificaciones académicas

- Enmienda controlada `docs/contratos/cambios/cambio-eventos-c6.md`: 62 → 64 eventos sin tocar el documento congelado.
- Migración `0008_create_analytics_notification_templates.ts`: plantillas 119–122 para los dos eventos nuevos.
- `evaluacion.publicada` publicado desde `EvaluationService.create` en la misma transacción; payload sin observación/PII y destinatario resuelto desde la matrícula.
- `recordatorio.fechas` publicado desde `SessionService.create` con outbox transaccional y destinatarios del grupo.
- `evaluacion.` es crítico por prefijo; `recordatorio.fechas` respeta preferencias `app`/`email`. Prueba añadida en `notification-policy.spec.ts`.

### RB1-58 — Contrato, permisos y matriz

- `pnpm contracts:generate`: 54 operaciones, 4 públicas, 64 eventos (62 + 1 enmienda).
- `contracts:validate` y `test:contracts` en verde, incluida la prueba de la enmienda C6.
- Matriz de autorización ampliada a 54 × 3 perfiles con `generateReport`, `getKpis` y `listReportCatalog`.
- `generate-events.mjs` formatea `events.json` con Prettier: `contracts:generate`, `format:check` y la comprobación de deriva de CI son idempotentes.
- `ReportsController.generate` declara `@ApiParam('code')`: Spectral termina sin errores (36 advertencias preexistentes de estilo).
- Rol C sigue pendiente: no se regeneró `apps/web/src/api/client.ts` ni se retiraron mocks.

### RB1-59 — Verificación manual

- Acta: `docs/reviews/c6/verificacion-reportes-kpis.md`.
- Tres reportes y tres KPIs comparados contra SQL directo en PostgreSQL 16, con tolerancia cero. Ver también §3 de la verificación.

### RB1-60 — Regresión, demo y paquete

- Paquete `docs/reviews/c6/rol-b.md` con evidencia local y deuda externa.
- La demo con cliente real queda pendiente de Rol C; no se marca como ejecutada.

## 3. Verificación final

| Comando | Resultado |
| --- | --- |
| `pnpm format:check` | verde |
| `pnpm typecheck` | verde (API + web) |
| `pnpm lint` | verde |
| `pnpm build` | verde (API + web; solo aviso de tamaño de chunk en web) |
| `pnpm test` | 33 archivos / 419 pruebas de API + 2 archivos / 13 pruebas web, verdes |
| `pnpm test:integration` (PostgreSQL 16 real, serial) | 6 archivos / 49 pruebas, verdes |
| `pnpm test:architecture` | 1 archivo / 3 pruebas, verdes |
| `pnpm arch:check` | 0 violaciones (282 módulos, 1008 dependencias) |
| `pnpm test:contracts` | 13 pruebas, verdes |
| `pnpm contracts:validate` | 54 operaciones, 4 públicas, 64 eventos |
| `pnpm contracts:generate` | contrato regenerado; 64 eventos desde fuente + 1 enmienda |
| `pnpm test:security` | 6 pruebas, verdes |
| `pnpm security:secrets` | sin hallazgos |

## 4. Deuda y decisiones registradas

- **D89:** la publicación de C5 no cierra RB1-43 a RB1-48; su deuda no se reutiliza como evidencia de C6.
- **D85:** catálogo a 64 solo por enmienda; `events.json` conserva `version: "1.0"`.
- **Pendiente de entorno:** CI de GitHub, TLS/preproducción, Docker/MinIO, k6 y simulacro de respaldo/restauración.
- **Pendiente de Rol C:** cliente regenerado, retirada de mocks y demo con pantallas reales.
- **No ejecutado:** C7/C8, firma formal de C6 y etiqueta `release-2.0-rc`.
