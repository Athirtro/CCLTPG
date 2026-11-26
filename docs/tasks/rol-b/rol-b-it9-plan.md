# Plan de trabajo — Iteración 9 (Rol B)

- **Fecha:** 23 de noviembre de 2026; actualizado el 26 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Iteración objetivo:** **C9 — Cierre de deuda acumulada y aceptación final (Release 3.0)**
- **Estado:** **Ejecución documental parcial realizada el 26 de noviembre de 2026.** La orden «genera un plan para una iteracion 9 … agregues todo lo que quedo faltando de las iteraciones» autorizó el plan; la orden «actualizar el plan C9 al estado real, producir la matriz/paquete/registro y generar el runbook» autorizó los entregables de Rol B. **No** autoriza código de API/web, `commit`, `push`, firma, etiqueta `release-3.0` ni publicación de C9. D110…D119 siguen **propuestas, no ratificadas**.
- **Predecesor:** C8 ejecutada por Rol B en `3df23ce` (`iteracion 8 rol b`) y ya incluida en `origin/main` (`dd1079d`). La compuerta 8 sigue abierta: la deuda de calidad de Rol C quedó corregida, pero subsisten actas y evidencia externa (`docs/reviews/c8/rol-b.md`).
- **Registro predecesor:** `docs/tasks/rol-b/rol-b-it8-registro.md`.
- **Entregables C9 producidos:** `docs/reviews/c9/rol-b.md`, `docs/reviews/c9/trazabilidad.md`, `docs/tasks/rol-b/rol-b-it9-registro.md` y `docs/runbook/respaldo-restauracion.md`.
- **Decisión de propiedad del 26-11:** la incidencia de `ChangePasswordDto` detectada por Rol C se delega a **Rol A** (`docs/contratos/cambios/seguimiento-auth-cliente-c7.md` §2). Rol B no modifica ese código en C9.
- **Paquetes de revisión de origen:** `docs/reviews/c0/estado-cierre.md`, `docs/reviews/c1/rol-b.md`, `docs/reviews/c2/rol-b.md`, `docs/reviews/c3/rol-b.md`, `docs/reviews/c4/rol-b.md`, `docs/reviews/c5/rol-b.md`, `docs/reviews/c6/rol-b.md`, `docs/reviews/c7/rol-b.md`, `docs/reviews/c8/rol-b.md`.
- **Paquete a producir:** `docs/reviews/c9/rol-b.md`.
- **Registro a producir:** `docs/tasks/rol-b/rol-b-it9-registro.md`.
- **Requisitos:** `docs/vision-alcance.md` (CAR-01…CAR-12), `docs/requirements/seguridad.md`, `docs/diseno-arquitectonico.md` (§13, §14, §18, §19), `docs/contratos/controles-seguridad-v1.md`, `docs/open-questions.md`, `docs/assumptions.md`.
- **Contrato:** `packages/contracts/openapi.json` y `packages/contracts/events.json` (54 operaciones, 4 públicas, 37 permisos, 64 eventos); fuente canónica code-first.
- **Nota de extensión:** C9 **no está prevista** en `docs/diseno-arquitectonico.md` §18 (que termina en C8). Se registra como decisión **D110** y se refleja solo en `docs/iteraciones.md`. El diseño, la visión y los contratos congelados **no se editan**: cualquier cambio documental va por `docs/contratos/cambios/*.md`.

## 1. Objetivo

Cerrar, agrupar y dar dueño a **toda la deuda pendiente de C0 a C8**, sin declarar aprobada ninguna compuerta que siga sin evidencia. C9 es una iteración de **consolidación y aceptación**, no de nuevas funcionalidades de negocio.

Resultado esperado y estado al 26-11:

1. ✅ Inventario único de deuda con dueño, evidencia de cierre y estado real (sección 2).
2. ⏳ Actas y ratificaciones de C0…C8, con el catálogo formal de requisitos funcionales que sustituye a PA-017. Rol A entregó insumos; el equipo no ha firmado.
3. ✅ Regresión global en verde: los 15 errores de `lint` y los 6 archivos sin formato heredados de Rol C fueron corregidos por Rol C y reverificados por Rol B.
4. ⚠️ Cliente `apps/web`: sesión y Bearer/CSRF corregidas; **regeneración desde el contrato y demo completa siguen pendientes** (Rol C).
5. ⚠️ Evidencia de entorno: CI documentada en verde; runbook de respaldo creado. TLS, MinIO, k6, alertas, rotación y simulacro siguen pendientes o sin re-verificación.
6. ✅ Matriz requisito → código → prueba → acta para CAR-01…CAR-12 publicada en `docs/reviews/c9/trazabilidad.md`, con filas ⚠️/⏳ identificadas.

**Regla de bloqueo aplicable a C9:** un criterio sin evidencia enlazada en `docs/reviews/c9/rol-b.md` no se marca como cumplido. La ejecución en código de C0…C8 no equivale a su aprobación. Un ✅ en este plan significa **entregable o verificación de Rol B realizada**, no compuerta firmada.

## 2. Inventario consolidado de deuda (C0 → C8)

### 2.1 Gobernanza y decisiones (dueño: Equipo; Rol B facilita el checklist)

| Origen | Deuda pendiente | Evidencia de cierre |
| --- | --- | --- |
| C0 | 5 condiciones P0: RC-A-01…04 (diccionario), RC-C-01…04 (catálogo/OpenAPI), ratificación de ADR-0001…0004 + R-018…R-031 + PA-006, confirmación de PA-001/PA-003/PA-005, y vacío del catálogo de requisitos (PA-017) | `docs/reviews/c0/estado-cierre.md` §4 + acta firmada |
| C1 | Acta C0/C1; ratificación de D27, D28, D33, D34, D36, D37, D38 y dependencias; excepción firmada para CVE-2026-112366 (`picomatch`, high, solo tooling) | `docs/reviews/c1/rol-b.md` §9 |
| C2 | D41…D48, `argon2@0.45.2`, `jose@6.2.18`, R-030 (`debe_cambiar_password`, `codigo_recuperacion_mfa`), `usuario.listado`, `x-allow-anonymous`, semántica AC-SEC-01/22 | `docs/reviews/c2/rol-b.md` §9 |
| C3 | D49…D58 y dependencias (`@aws-sdk/client-s3`, `file-type`, `pdfkit`, `exceljs`, `multer`), R-009/R-020/R-029/R-032/R-033, `reporte.generado`, SUP-008 (antimalware) y stub de correo | `docs/reviews/c3/rol-b.md` §9 |
| C4 | D59…D68, R-018/R-034/R-035/R-036, contrato canónico vs. `api-v1.openapi.yaml` | `docs/reviews/c4/rol-b.md` §9 |
| C5 | D69…D79 y **RB1-43…RB1-48** (HTTP real, TLS, rotación doble `kid`, respaldo, alertas, k6) | `docs/reviews/c5/rol-b.md` §6 |
| C6 | D80…D89, firma de C6, demo con cliente real | `docs/reviews/c6/rol-b.md` §6 |
| C7 | D90…D99, **D95** (`axe` sin autorizar), D96/D97 (teclado/lector/responsive), escaneo TLS, cliente y demo | `docs/reviews/c7/rol-b.md` §4 |
| C8 | D100…D109, deuda de calidad de Rol C (corregida en C9), runbook de respaldo creado en C9, simulacros de PA-011/PA-016 | `docs/reviews/c8/rol-b.md` §5 y `docs/reviews/c9/rol-b.md` §2 |

**Firmas:** C0, C1, C2, C3, C4, C5, C6, C7 y C8 siguen **sin firma formal**. El push de C8 ya no es deuda: `3df23ce` está en `origin/main` (`dd1079d`).

### 2.2 Deuda de Rol A (documentación y datos)

- RC-A-01…04 en `docs/diccionario-datos.md`: cifrado + hash, `recurso_id`, identidad MFA y vínculo `usuario_id` (P0 de C0).
- Extensión R-030 y campos de anonimización derivados de `cambio-retencion-c8.md` (PA-011).
- Catálogo formal de criterios funcionales CAR-01…CAR-05/CAR-09 (resuelve PA-017).
- Catálogo de notificaciones, reportes y KPIs (P1 de C0, vinculado a C6).

### 2.3 Deuda de Rol C (cliente e interfaz)

Estado al 26-11: lint/format, responsive y sesión ya tienen corrección; siguen abiertos la regeneración del cliente, la demo completa, el lector de pantalla, los tres navegadores y la CSP desplegada.

- Regenerar `apps/web/src/api/client.ts` desde `packages/contracts/openapi.json`: hoy contiene DTOs escritos a mano (D28/D36/D37, PA-005).
- Retirar datos de ejemplo en pantallas y ejecutar la demo completa con API real: sesión → académico → asistencia/evaluación → reporte → exportación → KPI → notificación → auditoría (RB1-43/RB1-49/RB1-60).
- ✅ Corregidos los 15 errores de `pnpm lint` en `Archivos.tsx`, `Programas.tsx`, `Reportes.tsx`, `VistaEducador.tsx` y los 6 archivos de `pnpm format:check` en `apps/web/src/pages/`. Ya no bloquean la regresión global.
- ✅ Auditoría WCAG 2.1 AA automatizada, teclado y responsive 360/768/1024/1440 (D96/D97); ⏳ lector de pantalla, tres navegadores y ratificación formal de `axe` (D95, ya declarado desde `c4c906a`).
- ✅ Token de sesión en memoria (diseño §15) y navegación desde `/me` (AC-SEC-21); ⏳ incidencia de cambio de contraseña delegada a Rol A.

### 2.4 Deuda de entorno y operación

| Necesidad | Origen | Estado |
| --- | --- | --- |
| Docker/Compose real: PostgreSQL, Redis y MinIO (errores `28P01` y 401) | C1/C2/C3, RB1-02/RB1-44 | ⚠️ Rol A reporta PostgreSQL 16/Redis 7.4 en Docker con 6/49 integración y `up/down/up`; Rol B re-ejecutó `test:integration` sin entorno y las 49 pruebas quedaron `skipped`. MinIO real sigue pendiente |
| CI de GitHub observable con contratos, formato, lint, tipos y SCA | C1…C8, RB1-45 | ⚠️ Rol C documenta run #24 (`7d0cec2`) con 4 jobs en verde; excepción formal de `picomatch` sigue pendiente |
| TLS/preproducción: redirección HTTP→HTTPS, HSTS real y escaneo (C-20, AC-SEC-23) | C5/C7/C8, RB1-44 | Pendiente |
| Rotación con doble `kid` y acta (RB1-45) | C5/C6 | Pendiente |
| Simulacro de respaldo/restauración con RPO ≤ 15 min y RTO ≤ 4 h; runbook dedicado | C5/C8/C9, RB1-46, C-25 | ⚠️ `docs/runbook/respaldo-restauracion.md` creado el 26-11; **simulacro y tiempos medidos pendientes** |
| Simulacro de alertas y ajuste de `RATE_LIMITS` (RB1-47, C-45) | C5/C8 | Pendiente |
| k6: 200 VUs, p95 < 4 s, 0 5xx y soak (RB1-48, CAR-06) | C5/C8 | Pendiente |
| SCA de dependencias, escaneo de imágenes, cierre de excepción `picomatch` (AC-SEC-32) | C1/C8, C-43/C-44 | Pendiente |
| Reemplazo o excepción firmada de stubs: antimalware, correo y adaptador local de almacenamiento | C3/C8, SUP-008 | Pendiente |
| Ejecución operativa de PA-011/PA-016: anonimización sobre copia, resumen firmado y staging anonimizado verificado (C-26) | C8 | Pendiente |

### 2.5 Preguntas abiertas que C9 debe cerrar o confirmar

PA-001, PA-003, PA-004 (acudiente), PA-005 (regeneración de cliente), PA-006, PA-007, PA-008, PA-009 (límites definitivos tras carga), PA-012 (autoservicio de contraseña), PA-014 (separación de funciones), PA-015 (gracia de refresh), PA-017 (catálogo). El commit `ddcac05` registra decisión documental para PA-001 y PA-007; PA-010, PA-011 y PA-016 tienen cierre documentado en C7/C8. Todas requieren confirmación en un acta firmada; ninguna se da por ratificada en este plan.

## 3. Alcance propuesto (tareas RB1-80…RB1-103)

Estado inicial: **propuestas**. Los dueños son orientativos; Rol B ejecuta solo lo de su competencia y coordina el resto. El estado de la última columna se actualizó el 26-11 con evidencia enlazada: ✅ entregable/verificación realizada, ⚠️ parcial, ⏳ pendiente. Un ✅ **no** implica compuerta firmada.

| ID | Tarea | Dueño | Entregable | Estado 26-11 | Cierre |
| --- | --- | --- | --- | --- | --- |
| RB1-80 | Inventario único de deuda y plan C9 | Rol B | Este documento y `docs/iteraciones.md` | ✅ Actualizado | Orden de planificación |
| RB1-81 | Acta C0 + catálogo de requisitos | Equipo / Rol A / Rol C | Checklist de P0 firmado; PA-017 convertida en catálogo CAR-01…CAR-12 | ⚠️ Insumos de Rol A; sin acta | C0 |
| RB1-82 | Acta C1/C2 | Equipo | D27…D38, D41…D48, dependencias, R-030, `usuario.listado`, `x-allow-anonymous`, excepción CVE | ⏳ Acta pendiente | C1/C2 |
| RB1-83 | Acta C3/C4 | Equipo | D49…D68, dependencias, R-009/R-020/R-029/R-032/R-033/R-034/R-035/R-036, SUP-008 | ⏳ Acta pendiente | C3/C4 |
| RB1-84 | Acta C5/C6/C7/C8 + push de C8 | Equipo / Rol B | D69…D109, RB1-43…48, D95, PA-011/PA-016; firmas y `origin/main` alineado | ✅ Push de C8 (`3df23ce` en `dd1079d`); ⏳ firmas | C5…C8 |
| RB1-85 | Diccionario y reglas de datos | Rol A | RC-A-01…04, extensión R-030 y campos de anonimización | ⚠️ Propuesta `864102f`; diccionario sin aplicar | C0/C8 |
| RB1-86 | Alinear contrato documental al canónico | Rol C / Rol B | `api-v1.openapi.yaml` retirado; `openapi.json` canónico; PA-007 con decisión documental | ✅ Documental en `ddcac05`; ⏳ confirmación en acta | C0/C4 |
| RB1-87 | Regenerar cliente web desde `openapi.json` | Rol C | `apps/web/src/api/client.ts` generado; verificación de cambios rupturistas en CI | ⏳ DTOs manuales; sin script de codegen | PA-005, D114 |
| RB1-88 | Demo extremo a extremo con API real | Rol C | Guion ejecutado y grabado/acta; sin datos de ejemplo en producción | ⚠️ Login/`/me` HTTP verificados; recorrido completo pendiente | RB1-43/RB1-49/RB1-60 |
| RB1-89 | Corregir deuda de calidad de `apps/web` | Rol C | `pnpm lint` y `pnpm format:check` globales en verde | ✅ Corregido por Rol C y reverificado por Rol B | Bloqueo C8 |
| RB1-90 | Auditoría de accesibilidad y responsive | Rol C | Informe WCAG 2.1 AA, teclado, lector de pantalla y 360/768/1024/1440; `axe` si se autoriza | ⚠️ 21 páginas axe + 4 breakpoints; ⏳ lector, 3 navegadores y ratificación D95 | D95/D96/D97 |
| RB1-91 | Sesión y navegación en cliente | Rol C | Token en memoria, `/me` y críticas no silenciables | ⚠️ Bearer/CSRF corregidos; ⏳ incidencia `ChangePasswordDto` (Rol A) y refresh silencioso | AC-SEC-21 |
| RB1-92 | Docker/Compose y MinIO reales | Rol B / entorno | `docker compose ps` sano; resolver `28P01` y 401 | ⚠️ PostgreSQL/Redis reportados por Rol A; MinIO pendiente; integración de Rol B `skipped` | RB1-02/RB1-44 |
| RB1-93 | CI de GitHub observable | Rol B / entorno | Pipeline con contratos, formato, lint, tipos y SCA; excepción CVE cerrada | ⚠️ Run #24 documentado en verde; ⏳ excepción `picomatch` | AC-SEC-32 |
| RB1-94 | TLS y cabeceras en preproducción | Rol B / entorno | Escaneo TLS, redirección HTTPS y HSTS reales | ⏳ Sin entorno | C-20, AC-SEC-23 |
| RB1-95 | Stubs de almacenamiento, correo y antimalware | Rol B / entorno | Proveedores reales o excepción firmada (SUP-008) | ⏳ Sin proveedor ni excepción | C3/C8 |
| RB1-96 | Rotación de secretos con doble `kid` | Rol B | Acta de rotación ejecutada | ⏳ Sin acta | RB1-45 |
| RB1-97 | SCA y escaneo de imágenes | Rol B / entorno | Informe sin críticas abiertas o excepciones firmadas | ⚠️ `pnpm audit` en CI documentado; ⏳ escaneo de imágenes | C-43/C-44 |
| RB1-98 | Runbook y simulacro de respaldo/restauración | Rol B | Runbook dedicado + acta con RPO/RTO medidos | ⚠️ Runbook creado; ⏳ simulacro | RB1-46, C-25 |
| RB1-99 | Ejecución operativa de retención e integridad | Rol B | Anonimización sobre copia, resumen firmado y staging anonimizado verificado | ⏳ Sin ejecución sobre copia | PA-011/PA-016, C-26 |
| RB1-100 | Simulacro de alertas y límites de tasa | Rol B | Acta de alerta e informe que justifique `RATE_LIMITS` | ⏳ Sin simulacro | RB1-47, C-45 |
| RB1-101 | Prueba de carga y soak | Rol B / entorno | Informe k6: 200 VUs, p50/p95/p99, 0 5xx, soak | ⏳ Sin k6 ni informe | RB1-48, CAR-06 |
| RB1-102 | Matriz de trazabilidad completa | Rol B | `docs/reviews/c9/trazabilidad.md`: CAR-01…CAR-12 × código × prueba × acta | ✅ Publicada; filas ⚠️ conservadas | Compuerta 9 |
| RB1-103 | Regresión global y paquete de aceptación | Rol B | `docs/reviews/c9/rol-b.md` y registro; **sin firma automática** | ✅ Producidos; ⏳ aceptación | Aceptación final |

**Fuera de alcance de C9:** nuevas funcionalidades de negocio, nuevos permisos/operaciones/eventos sin enmienda, DDL desde la API, proveedores externos contratados sin autorización y cualquier trabajo que no esté en el inventario de la sección 2 salvo que se tramite por enmienda controlada.

## 4. Decisiones propuestas (D110…D119)

Requieren ratificación antes de ejecutar. Estado al 26-11: ninguna ha sido ratificada. D113 queda respaldada documentalmente por `ddcac05` y D115 tiene `axe-core` ya declarado desde `c4c906a`; en ambos casos falta el acta que lo confirme.

| Decisión | Propuesta | Recomendación | Reversibilidad |
| --- | --- | --- | --- |
| D110 — Naturaleza de C9 | Iteración extraordinaria de cierre de deuda, posterior a C8; no altera el diseño §18 y se documenta solo en `docs/iteraciones.md` | **A — aprobar C9** | Barata |
| D111 — Gobernanza | Actas agrupadas por bloque (C0, C1/C2, C3/C4, C5…C8); Rol B prepara el checklist, el Equipo firma | **A — agrupar** | Barata |
| D112 — Catálogo | Convertir PA-017 en catálogo formal CAR-01…CAR-12 con criterios verificables; sin editar documentos congelados, se registra en `docs/contratos/cambios/` | **A — catálogo formal** | Media |
| D113 — Contrato canónico | `packages/contracts/openapi.json` es la única fuente; el YAML de C0 queda como referencia histórica con aviso | **A — confirmar code-first** | Costosa tras congelar |
| D114 — Cliente | Regenerar el cliente web desde el contrato canónico y verificar rupturismo en CI; no mantener DTOs manuales | **A — regenerar** | Media |
| D115 — Dependencias nuevas | `axe`, k6 y escáner de contenedores requieren autorización expresa; sin ella se marcan pendientes y no se instalan | **A — sin instalación automática** | Barata |
| D116 — Entorno | Docker/MinIO, TLS/preproducción y CI se ejecutan solo si hay entorno; sin él se registran pendientes, nunca se simulan con atajos locales | **A — evidencia real o pendiente** | Barata |
| D117 — Stubs | Antimalware, correo y almacenamiento local se sustituyen por proveedores reales o se aceptan mediante excepción firmada; no se declaran verificados mientras sean stubs | **A — reales o excepción** | Media |
| D118 — PA abiertas | PA-004, PA-012, PA-014 y PA-015 se confirman «sin cambios en v1.0» salvo decisión contraria del Equipo; PA-009 se cierra con el informe de carga | **A — confirmar por defecto** | Costosa tras aceptación |
| D119 — Aceptación | `release-3.0` solo se etiqueta con actas firmadas, regresión global verde y evidencia de Rol C; la matriz marca pendiente lo que no tenga evidencia | **A — no etiquetar sin evidencia** | Costosa tras etiquetar |

## 5. Criterios de salida y Compuerta 9 (propuesta)

| Condición | Criterio verificable |
| --- | --- |
| Gobernanza | Actas de C0…C8 firmadas; D27…D109 y R-018…R-036 ratificados; PA-001…PA-017 cerradas o confirmadas con valor por defecto |
| Catálogo | CAR-01…CAR-12 con criterios de aceptación verificables en `docs/contratos/cambios/` |
| Calidad | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` globales en verde |
| Cliente y demo | Cliente regenerado desde `openapi.json`; demo E2E con API real y sin mocks en producción |
| Accesibilidad | Informe WCAG 2.1 AA, teclado, lector, responsive y `axe` autorizado o deuda firmada |
| Entorno | Compose real, CI de GitHub, TLS/preproducción, SCA/imágenes, rotación doble `kid`, simulacro de respaldo con RPO/RTO, alertas, k6/soak |
| Cumplimiento | PA-011/PA-016 ejecutadas sobre copia anonimizada; C-25/C-26 con acta; runbook de respaldo publicado y accesible |
| Trazabilidad | Matriz CAR-01…CAR-12 × código × prueba × acta, sin filas ⚠️ sin justificación |
| Contrato | 54/4/37/64 sin deriva; sin permisos, operaciones ni eventos nuevos salvo enmienda |
| Aceptación | Firma y etiqueta `release-3.0` **solo** con autorización expresa; C9 no se publica automáticamente |

## 6. Evidencia y verificación (resultado real del 26-11)

| Comando/artefacto | Resultado |
| --- | --- |
| `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm build` | ✅ verdes en todo el monorepo |
| `pnpm test` | ✅ API 33 archivos/420 pruebas; web 3 archivos/31 pruebas |
| `pnpm test:integration` | ⚠️ 6 archivos/49 pruebas `skipped` en la ejecución de Rol B (sin entorno DB); Rol A reporta PASS con PostgreSQL 16/Redis en Docker |
| `pnpm arch:check` | ✅ 282 módulos, 1008 dependencias, 0 violaciones |
| `pnpm test:architecture` | ✅ 1 archivo/3 pruebas |
| `pnpm test:contracts` | ✅ 14/14 |
| `pnpm contracts:validate` | ✅ 54 operaciones, 4 públicas, 64 eventos |
| `pnpm contracts:generate` | ✅ sin deriva |
| `pnpm contracts:lint` | ✅ 0 errores, 36 advertencias preexistentes |
| `pnpm test:security`, `pnpm security:secrets` | ✅ 6/6 y sin hallazgos |
| CI de GitHub | ⚠️ Run #24 (`7d0cec2`) documentado por Rol C con 4 jobs en verde; no re-ejecutado por Rol B |
| `docker compose ps`, TLS, k6, simulacros, MinIO | ⏳ Sin evidencia de Rol B; se mantienen pendientes |
| Matriz `docs/reviews/c9/trazabilidad.md` y paquete `docs/reviews/c9/rol-b.md` | ✅ Producidos y enlazados desde el registro |

## 7. Publicación

Este plan **no autoriza** `git commit`, `git push`, firma, etiqueta ni publicación de C9. C8 ya está en `origin/main` (`3df23ce` dentro de `dd1079d`); los entregables de C9 producidos el 26-11 permanecen como cambios locales sin commitear. La etiqueta `release-3.0` corresponde a la aceptación final y solo se evalúa con autorización expresa, actas y evidencia completa. No se inicia ninguna iteración posterior.
