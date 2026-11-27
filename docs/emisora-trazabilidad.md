# Trazabilidad de la Emisora R.A.C. — RF/RNF → código → prueba

- **Objetivo:** permitir verificar, sin inferencias, que cada requisito funcional (RF-01…RF-12) y no funcional (RNF-01…RNF-06) del levantamiento tiene implementación, contrato y prueba identificables.
- **Fuentes:** `docs/diseno-emisora.md` §§6, 12, 14 y 20; `docs/adr/ADR-0006-emisora-decisiones-y-supuestos.md` §3; enmiendas `docs/contratos/cambios/cambio-emisora-contexto.md` y `cambio-emisora-eventos.md`; matriz `docs/contratos/matriz-autorizacion-emisora-v1.md`.
- **Regla:** este documento es aditivo. No sustituye los contratos congelados ni añade permisos; solo enlaza requisitos con lo ya implementado.
- **Estado general:** RF-01…RF-12 implementados y verificados en E2/E3/E4. RNF-01…RNF-06 verificados; la compuerta manual de RNF-06 se ejecutó el 2026-11-27 con 200 VUs y p95 de 9,82 ms; ver §4.

## 1. Requisitos funcionales

Las rutas están bajo el prefijo `/api/v1`. Los archivos de aplicación se indican
respecto a la raíz del repositorio.

| RF | Operaciones / contrato | Código | Prueba |
| --- | --- | --- | --- |
| RF-01.1…01.3 — programación diaria, franjas, verificación contra rejilla | `POST/GET /emisora/programacion-diaria`, `PATCH /emisora/programacion-diaria/{id}/transitions`, `POST/GET /emisora/rejilla-anual`, `PATCH /emisora/rejilla-anual/{id}/transitions` | `apps/api/src/modules/emisora/application/programacion.service.ts`; `domain/emisora-rules.ts` (`haySolape`, `verificarContraRejilla`); `api/programacion.controller.ts` | `domain/emisora-rules.spec.ts` (solapes y desviaciones); `e2e/emisora.spec.ts` (recorrido E2) |
| RF-02.1…02.4 — sesión de grabación, asistencia, audio | `POST /emisora/grabaciones`, `PATCH /emisora/grabaciones/{id}/transitions`, `POST /emisora/grabaciones/{id}/asistencia-cabina`, `POST /emisora/audios` | `apps/api/src/modules/emisora/application/grabacion.service.ts`; `api/grabaciones.controller.ts`; `modules/files/domain/file-policy-emisora.ts` | `apps/api/src/modules/emisora/domain/emisora-rules.spec.ts`; `apps/web/src/extensions/emisora/emisora.test.tsx` (recorrido E2); `e2e/emisora.spec.ts` (E2) |
| RF-03.1 — convocatoria anual | `POST/GET /emisora/convocatorias` | `apps/api/src/modules/emisora/application/convocatoria.service.ts`; `api/convocatorias.controller.ts` | `apps/api/test/integration/emisora-migrations.spec.ts` (plazo de 21 días); `e2e/emisora.spec.ts` (E2) |
| RF-03.2 — proyectos y realizadores | `POST /emisora/proyectos`, `GET/PATCH /emisora/realizadores/{id}` | `application/convocatoria.service.ts`; `infrastructure/identity-ownership-policy.ts` | `infrastructure/identity-ownership-policy.spec.ts`; `e2e/emisora.spec.ts` (E2) |
| RF-03.3 — comité y rejilla anual | `POST /emisora/comites`, `PATCH /emisora/rejilla-anual/{id}/transitions` | `application/convocatoria.service.ts`; `domain/emisora-states.ts` | `e2e/emisora.spec.ts` (E2); `apps/api/test/integration/emisora-transitions.spec.ts` (CAS) |
| RF-03.4 — notificación al realizador | `PATCH /emisora/realizadores/{id}` | `application/convocatoria.service.ts`; `infrastructure/identity-ownership-policy.ts` | `convocatoria.service.spec.ts` (destinatario de identidad y omisión sin cuenta) |
| RF-03.5 — informe de realizador en oct/nov | `POST /emisora/informes` | `domain/emisora-rules.ts` (`esVentanaInforme`); `application/convocatoria.service.ts` | `domain/emisora-rules.spec.ts`; `convocatoria.service.spec.ts` (fuera de ventana) |
| RF-03.6 — incentivos | `PATCH /emisora/incentivos/{id}/transitions` | `application/convocatoria.service.ts`; `domain/emisora-states.ts` | `convocatoria.service.spec.ts` (sin auditoría si el estado de origen ya no sirve); `e2e/emisora.spec.ts` (E3) |
| RF-03.7 — resolución PDF de incentivos | `POST /emisora/resoluciones`, `GET /emisora/resoluciones/{id}/pdf` | `application/operacion.service.ts`; `integration/emisora-report-exporter.ts` (plantilla `emisora-resolucion-incentivos`) | `operacion.service.spec.ts` (plantilla, idempotencia, replay y periodo inválido); `e2e/emisora.spec.ts` (E3) |
| RF-04.1…04.3 — patrocinios y orden de emisión | `POST/PATCH /emisora/patrocinios`, `POST/PATCH /emisora/ordenes-emision` | `application/operacion.service.ts`; `domain/emisora-states.ts` | `operacion.service.spec.ts` (contrato PDF limpio y transición terminal); `e2e/emisora.spec.ts` (E3) |
| RF-05.1…05.3 — promos y publicación | `POST/PATCH /emisora/promos`, `POST/PATCH /emisora/publicaciones` | `application/operacion.service.ts`; `integration/emisora-report-exporter.ts` | `operacion.service.spec.ts` (audio limpio, MIME y referencia); `e2e/emisora.spec.ts` (E3) |
| RF-06.1…06.6 — transmisiones, salidas, mifi y viáticos | `POST/PATCH /emisora/transmisiones`, `POST /emisora/salidas-equipo`, `POST /emisora/reportes-desplazamiento`, `POST/PATCH /emisora/prestamos-mifi`, `POST /emisora/viaticos` | `application/operacion.service.ts`; `domain/emisora-rules.ts`; `emisora-states.ts` (`canTransicionarE3`) | `operacion.service.spec.ts` (antelación de dos días en Bogotá, salida+reporte, viáticos dentro/fuera de ciudad); `apps/api/test/integration/emisora-transitions.spec.ts`; `e2e/emisora.spec.ts` (E3) |
| RF-07.1…07.3 — turnos, lecturas y bitácora de sede | `POST /emisora/turnos`, `PATCH /emisora/turnos/{id}/transitions`, `POST/GET /emisora/lecturas`, `POST /emisora/bitacoras` | `application/gestion.service.ts`; `domain/emisora-states.ts` (`canTransicionarE4`) | `gestion.service.spec.ts` (clave, replay, unicidad y actor); `apps/api/test/integration/emisora-e4.spec.ts` (23505 y CAS); `e2e/emisora.spec.ts` (E4) |
| RF-08.1…08.3 — obras, reporte y pagos de derechos | `POST/GET /emisora/obras`, `POST /emisora/reportes-obras`, `POST /emisora/pagos-derechos` | `application/gestion.service.ts`; `integration/emisora-report-exporter.ts` (`emisora-reporte-obras`) | `gestion.service.spec.ts` (PDF limpio y EXPORT con clave propia); `e2e/emisora.spec.ts` (E4) |
| RF-09.1…09.4 — tecnología e inversión | `POST /emisora/equipos`, `PATCH /emisora/equipos/{id}/estado`, `POST/PATCH /emisora/actualizaciones-tecnologicas`, `POST/PATCH /emisora/proyecciones`, `POST/PATCH /emisora/inversiones`, `POST /emisora/versiones-software`, `POST /emisora/asignaciones-equipo` | `application/gestion.service.ts`; `infrastructure/persistence/kysely-emisora.repository.ts` | `gestion.service.spec.ts` (serie única, contrato de inversión y eventos); `emisora-e4.spec.ts` (proyección anual duplicada); `e2e/emisora.spec.ts` (E4) |
| RF-10.1…10.2 — actividad cultural y permiso de gobierno | `POST/GET /emisora/actividades`, `POST /emisora/permisos-salida` | `application/gestion.service.ts`; `integration/emisora-report-exporter.ts` (`emisora-oficio-salida`) | `gestion.service.spec.ts` (plantilla y `estado: 'emitido'`); `emisora-e4.spec.ts` (estado persistido en BD); `e2e/emisora.spec.ts` (E4) |
| RF-11.1…11.2 — archivo de emisora y planilla | `POST /emisora/archivos-emisora`, `POST /emisora/planillas-emision` | `application/gestion.service.ts`; `shared/integration/file-directory.port.ts`; `integration/emisora-report-exporter.ts` (`emisora-planilla-emision`) | `gestion.service.spec.ts` (archivo inexistente/sucio, audio limpio, `planilla.registrada`); `emisora-e4.spec.ts` (planilla `registrada` y unicidad); `e2e/emisora.spec.ts` (E4) |
| RF-12.1…12.2 — trámites externos y soportes | `POST/GET /emisora/tramites`, `POST /emisora/tramites/{id}/soportes`, `PATCH /emisora/tramites/{id}/transitions` | `application/gestion.service.ts`; `domain/emisora-states.ts` | `gestion.service.spec.ts` (radicado, soporte PDF y sentido único); `e2e/emisora.spec.ts` (E4) |

## 2. Requisitos no funcionales

La correspondencia RNF-01…RNF-06 sigue la fila agregada de ADR-0006 §3
("guard, catálogo, puertos, auditoría, adjuntos, redacción, disponibilidad") y
la §4.3 del plan para privacidad.

| RNF | Requisito | Código / contrato | Prueba / evidencia | Estado |
| --- | --- | --- | --- | --- |
| RNF-01 | Autorización con el guard y el catálogo de permisos existentes; sin mecanismo propio | `apps/api/src/modules/identity/domain/perfiles.ts` (13 perfiles de emisora en `PROFILE_SEEDS`); `api/guards/authorization.guard.ts`; `apps/api/test/api/authorization-matrix.spec.ts` (118 operaciones) | `pnpm test:contracts` (16 pruebas) y `pnpm test` (API 2302): `authorization-matrix.spec.ts` genera casos permitidos/denegados para las 118 operaciones del contrato, incluidas las 28 de E4 | Verificado |
| RNF-02 | Catálogo cerrado de eventos y auditoría acoplada a la transacción | `docs/contratos/cambios/cambio-emisora-eventos.md` (38 eventos); `packages/contracts/events.json` (101 eventos totales); `application/registrar-evento.ts`; `shared/audit/audit-redactor.ts` | `pnpm contracts:generate && pnpm contracts:validate` (101 eventos); `emisora-wiring.spec.ts`; aserciones de `lectura.registrada`, `planilla.registrada` y eventos de transición en `gestion.service.spec.ts` | Verificado |
| RNF-03 | Integración por puertos con Archivos, Exportaciones, Notificaciones, Identidad y Académico | `application/ports/report-exporter.port.ts`; `shared/integration/file-directory.port.ts`; `modules/emisora/emisora.module.ts`; `apps/api/src/integration/emisora-report-exporter.ts` | `pnpm arch:check` (333 módulos, 1265 dependencias sin violación); `pnpm test:architecture` (3); `apps/api/test/api/emisora-wiring.spec.ts` | Verificado |
| RNF-04 | Adjuntos documentales gestionados por Archivos y validados como limpios/compatibles | `modules/files/domain/file-policy-emisora.ts` (política opt-in `emisora-audio`); `application/gestion.service.ts` (`validarArchivo`) | `file-type-inspector.spec.ts`; `gestion.service.spec.ts` (PDF limpio en pagos, soportes y oficios); `e2e/emisora.spec.ts` (E3/E4) | Verificado |
| RNF-05 | Privacidad y redacción de datos personales (Ley 1581) | `application/emisora-pii.ts`; `infrastructure/identity-ownership-policy.ts`; `shared/audit/audit-redactor.ts` | `identity-ownership-policy.spec.ts` (dueño vigente, sin consulta ajena); `convocatoria.service.spec.ts` (destinatario de identidad); `emisora-migrations.spec.ts` | Verificado |
| RNF-06 | 200 usuarios concurrentes, p95 < 4 s y 0 errores 5xx en consulta crítica | `k6/emisora-programacion.js`; atajo `pnpm load:emisora`; procedimiento en `docs/runbook/emisora.md` | Compuerta manual ejecutada con k6 v0.54.0 el 2026-11-27T09:54Z: 200 VUs, 17 960 peticiones, p95 9,82 ms, `http_req_failed` 0,00 %, `errores_5xx` 0, checks 53 880/53 880. Umbrales `p(95)<4000`, `rate<0.01` y `count<1` sin incumplimiento | **Verificado** |

## 3. Slices y compuertas

| Slice | Alcance | Commit | Compuerta |
| --- | --- | --- | --- |
| E0 | Contratos, ADR-0005/0006, enmiendas y matriz | `efc83e2` | Aprobado en revisión independiente |
| E1 | Esquema `emisora`, migraciones, perfiles, plantillas y política de audio | Ver historial entre `efc83e2` y E2 | `emisora-migrations.spec.ts` (up→down→up) |
| E2 | RF-01…RF-03.6: convocatoria, rejilla, programación, grabación y audio | `39f7f61` / fijas | E2E recorrido E2 |
| E3 | RF-03.7…RF-06: resolución, patrocinios, promos, transmisiones, mifi y viáticos | `0779564` / `7a2d2df` | E2E recorrido E3 |
| E4 | RF-07…RF-12: sede, derechos, tecnología, archivo y trámites | `0df53f8` / `1b5116c` | +28 operaciones; 0 eliminadas/modificadas; revisión APROBADA |
| E5 | CI E2E verificado, compuerta k6 ejecutada, runbook, trazabilidad y cierre de EM-PA | Este slice | Regresión completa + revisión independiente final; compuerta k6 de RNF-06 superada |

## 4. Estado de aceptación

- **Aceptado:** RF-01…RF-12 y RNF-01…RNF-05, con regresión completa en verde (format, lint, typecheck, 2302 tests API, 57 tests web, 60 de integración, 3 de arquitectura, 16 de contratos, build y 23 E2E).
- **Aditividad verificada frente a `7a2d2df`:** 90 → 118 operaciones (+28, 0 eliminadas, 0 modificadas); `events.json` y `public-routes.json` byte-idénticos.
- **RNF-06 ejecutado y superado:** 2026-11-27T09:54Z, k6 v0.54.0, `K6_BASE_URL=http://localhost:3001` (instancia de carga con `AUTH_RATE_LIMIT_ENABLED=false`), `K6_FECHA=2026-01-19`, `K6_VUS=200`. Resultado: 200 VUs máximos, 17 960 peticiones (148,91/s), p95 9,82 ms (límite 4000 ms), 0,00 % de peticiones fallidas, 0 errores 5xx y 53 880 checks superados. Ningún umbral se incumplió. Ver `docs/runbook/emisora.md` §6.
- El job `e2e` de `.github/workflows/ci.yml` ya ejecuta `pnpm test:e2e` con Chromium y datos sembrados; cubre los recorridos E2/E3/E4 de la emisora. No se añade un segundo job E2E ni k6 al CI.
