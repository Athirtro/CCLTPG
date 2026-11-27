# Plan de integración — Módulo Emisora R.A.C. en CCLTPG

- **Versión:** 0.2 (revisada e integrada tras revisión arquitectónica independiente)
- **Fecha:** 2026-11-27
- **Fuente funcional:** Manual de Procedimientos Secretaría de Cultura, Emisora Cultural (Pereira), abril 2023 — RF-01…RF-12, RNF-01…RNF-06, actores e integraciones del levantamiento.
- **Estado del sistema receptor:** CCLTPG en funcionamiento, `main` alineado con `origin/main` (`116d414`), contratos code-first vigentes (`packages/contracts/openapi.json`, `events.json`, `public-routes.json`). Sin despliegue a producción aún.
- **Regla de oro:** **todo cambio es aditivo**. Ninguna tabla, endpoint, permiso, componente, prueba ni documento congelado del módulo general se modifica en su semántica; solo se añaden artefactos nuevos y se extienden listas cerradas de forma controlada.
- **Aclaración de "aditivo" tras la revisión:** añadir una entrada a una lista cerrada o una fila a una tabla de catálogo **sí es aditivo** y, cuando una prueba existente verifica un recuento/set exacto, esa expectativa debe ampliarse en el mismo PR. Se identifican **siete** expectativas exactas que hay que ampliar deliberadamente (EL-1…EL-7, §3); cualquier otra modificación de un archivo existente debe limitarse a una línea nueva y quedar registrada en §3.
- **Destino acordado para el registro (decisión del usuario 2026-11-27):** copiar este plan a `docs/diseno-emisora.md` dentro del repo y hacer **un commit con solo el plan** (sin código ni documentos de gobernanza E0), seguido de `push` a `origin/main`. El archivo actual en `~/.opencode/plan/` es el borrador de trabajo; `.opencode/` está ignorado por `.gitignore:26`.

---

## 1. Principios de integración

| # | Principio | Consecuencia concreta |
|---|---|---|
| P1 | Contexto delimitado propio | `Emisora R.A.C.` es un contexto nuevo con esquema `emisora`, paralelo a `academic`. Dueño único de sus datos. |
| P2 | Aditividad estricta | Las extensiones a listas/catalogos se hacen **añadiendo** entradas; nunca cambiando las existentes. Las únicas excepciones son actualizaciones de listas de prueba que verifican conjuntos exactos (ver §3). |
| P3 | Comunicación solo por puertos públicos | Emisora → núcleo compartido (Archivos, Exportaciones, Notificaciones, Auditoría, Identidad) e → interfaces públicas de Académico. **Prohibido** importar código interno de otro contexto o SQL contra esquema ajeno. |
| P4 | Contratos congelados intactos | No se editan `docs/diseno-arquitectonico.md`, `docs/contratos/modelo-auditoria-v1.md` ni contratos C0–C9. Los cambios van en ADR/enmiendas nuevas bajo `docs/contratos/cambios/`. |
| P5 | Misma gramática, mismo RBAC | Permisos `contexto:recurso:acción`, vocabulario fijo, denegación por defecto, guard global, matriz ejecutable. No se crea un sistema de permisos paralelo. |
| P6 | Misma estética y gramática de UI | Se consumen tema MUI, componentes `common/`, layout `MainLayout` y cliente generado. La emisora no define paleta, tipografía ni contratos de API propios. |
| P7 | Sin lógica financiera | Los viáticos, incentivos, pagos de derechos e inversiones se registran como **trazabilidad y estado de trámite**; nunca ejecutan pagos, asientos ni compromisos (coherente con SUP-002 y principio 8 del diseño). |
| P8 | Trazabilidad documental | Todo acta, formato, oficio, resolución, conclusión y registro fotográfico se adjunta o referencia mediante `archivo_id` lógico del contexto Archivos. |
| P9 | Regresión primero | Cada fase termina con la suite completa en verde; ninguna prueba se desactiva, relaja o simula. |

---

## 2. Contexto, capas y límites

### 2.1 Estructura nueva (backend)

```
apps/api/src/
  modules/emisora/
    domain/           entidades, máquinas de estado, reglas, eventos de dominio (sin framework)
    application/      casos de uso, puertos, DTOs internos
    infrastructure/   repositorios Kysely, adaptadores (archivos, exportaciones, notificaciones)
    api/              controladores REST, DTOs, decoradores de contrato
    tests/            unitarias y de API del contexto
  database/migrations/emisora/
    0001_create_emisora_core.ts
    0002_create_emisora_operation.ts
    0003_create_emisora_reporting.ts
    0004_emisora_indexes.ts
```

El aislamiento se verifica automáticamente: `.dependency-cruiser.mjs` **descubre los contextos leyendo `apps/api/src/modules/`**, por lo que al crear el directorio `emisora` se generan solas las reglas `contexto-emisora-no-importa-<otro>` y viceversa. No hay que editar esa configuración; basta con ejecutar `pnpm arch:check`.

### 2.2 Reglas de dependencia específicas

1. `emisora/domain` no importa NestJS, Kysely, pg, Redis ni otros contextos.
2. `emisora/application` define puertos; `infrastructure` los implementa.
3. Emisora **no importa** `src/modules/academic/**` ni `src/modules/identity/**` (el guard de dependencias lo prohíbe). Para consumir interfaces públicas se usan **tokens de puerto en `src/shared/integration/`** (nuevo subdirectorio, sin dependencias hacia contextos):
   - `shared/integration/academic-directory.port.ts`: `FormacionDirectory` (programas, formadores, inscripciones de formación). Implementado **dentro** de `academic` (nuevo proveedor aditivo en `academic.module.ts`) y consumido por emisora mediante el token compartido.
   - `shared/integration/identity-directory.port.ts`: resolución de usuarios/perfiles vigentes (`usuario_id`, nombre, correo, `valid_until`). **Decisión cerrada (antes "se decide en E1"):** se expone un proveedor nuevo `IdentityDirectory` **desde el módulo `identity`**, de forma simétrica a `FormacionDirectory`; emisora solo depende del token en `shared/integration/` y **no lee tablas de `public`**. Con esto se respeta P3 sin excepción y `arch:check` sigue siendo la red de seguridad. El proveedor se registra como aditivo en `identity.module.ts`.
   - `shared/integration/ownership.port.ts`: `EmisoraOwnershipPolicy` para permisos `*_own` (realizador, locutor, operador). Implementación en `emisora/infrastructure`; recibe `IdentityDirectory` para resolver el principal, sin SQL contra `public`.
4. Ninguna FK cruzada de `emisora` a `public` o `academic`: referencias lógicas `uuid` validadas por el contexto dueño.
5. Emisora no escribe en `public.evento_auditoria` directamente: usa `AuditWriter` / `AuditWriterFactory` existente (`shared/audit/audit.port.ts`).

### 2.3 Estructura nueva (frontend)

```
apps/web/src/extensions/emisora/
  routes.tsx            subrouter montado bajo /emisora/*
  pages/                una página por agrupación funcional (RF-01…RF-12)
  api/                  adaptadores delgados sobre @ccltpg/client (client.ts)
  components/           solo componentes específicos de emisora; reutiliza common/
  emisora.test.tsx      pruebas de rutas, permisos y accesibilidad
```

La extensión se monta **dentro del shell**: `App.tsx` añade una ruta hija `<Route path="/emisora/*" element={<EmisoraShell/>}/>` dentro del `<Route element={<RequireAuth><MainLayout/></RequireAuth>}>`. `SideDrawer.tsx` añade una sección "Emisora R.A.C." filtrada con `hasPermission('emisora:...:read')`, sin tocar las secciones actuales.

---

## 3. Puntos de contacto exactos con el sistema en funcionamiento

Esta tabla es la lista completa de archivos existentes que se tocan. Los cambios son aditivos (una entrada nueva, un parámetro opcional con valor por defecto idéntico, o una fila nueva de catálogo). Hay **siete expectativas exactas** que deben ampliarse en el mismo PR que las causa; se numeran EL-1…EL-7 y se listan al final de la tabla. No se modifica la lógica de ninguna de esas pruebas.

| # | Archivo existente | Cambio aditivo | Seguridad del cambio | Verificación |
|---|---|---|---|---|
| 1 | `apps/api/src/app.module.ts` | Añadir `EmisoraModule` a `imports` | No altera módulos actuales; solo registra controladores bajo `/emisora` | `test` + `test:api` |
| 2 | `apps/api/src/database/migrator/migrator-setup.ts` | Añadir `'emisora'` a `MIGRATION_SCHEMAS` | Cada esquema tiene historial y candado propios; no afecta `public` ni `academic` | `test:integration` |
| 3 | `apps/api/src/database/migrator/migrate.ts` | Ajustar el mensaje de `parseTarget` (`:34`) y el de reversión (`:42`) para incluir `emisora` | Solo texto; el bucle ya itera `MIGRATION_SCHEMAS`, por lo que `up/down/status emisora` funcionan sin otro cambio | `migrate:status emisora` |
| 4 | `docs/runbook/migraciones.md` | Añadir `emisora` a "Esquemas" (`:5`), regla 1 (`:9`) y bloques de comandos (`:27-33`, `:50-52`) | Documental; aclara la ruta correcta de las migraciones | Revisión de compuerta |
| 5 | `infra/compose/postgres/init/00-roles.sql` | Crear esquema `emisora`, `GRANT USAGE` a `ccltpg_app`/`ccltpg_readonly`, `USAGE, CREATE` a `ccltpg_migrator`, y cuatro `ALTER DEFAULT PRIVILEGES` análogos a los de `academic` (`:58-60`, `:72-79`) | Bloqueante B3: sin esto CI (`.github/workflows/ci.yml:160-161`) y Compose no crean el esquema y la API falla al arrancar. Bloque nuevo, idéntico al de `academic` | `test:integration`, job `integration` de CI |
| 6 | `apps/api/src/database/schema.ts` | Añadir interfaces `Emisora*Table` y claves `'emisora.xxx'` a `Database` | Solo nuevos miembros; Kysely es code-first | `typecheck` + integración |
| 7 | `apps/api/src/modules/identity/domain/permissions.ts` | Anexar permisos `emisora:*` a `PERMISSION_CATALOG` | El catálogo es cerrado; añadir no cambia la expansión de los existentes. `manage` solo implica acciones presentes en el catálogo: cada recurso declara `read` y `manage` como mínimo | `permissions.spec.ts`, `test` |
| 8 | `apps/api/src/modules/identity/domain/perfiles.ts` | Extender `PerfilCodigo`, añadir los 13 perfiles a `PROFILE_SEEDS` y `emisora:*:manage` a `administrador` | No se quita ningún permiso existente | EL-1, EL-2 |
| 9 | `apps/api/src/modules/identity/domain/perfiles.spec.ts` | **EL-1 (B1):** actualizar `catalogo.size` de 37 a `37 + N_permisos_emisora` (`:31-33`) | Es una expectativa de recuento, no una relajación; se documenta el nuevo valor exacto | `pnpm test` |
| 10 | `apps/api/test/integration/identity-flow.spec.ts` | **EL-2:** ampliar el array exacto de perfiles de `:208-212` con los 13 códigos nuevos | Sin cambio, la semilla falla; la lógica de `seedIdentity` no se toca | `test:integration` |
| 11 | `apps/api/src/modules/identity/identity.module.ts` | Exportar el nuevo proveedor `IdentityDirectory` (archivo nuevo en `identity/infrastructure/`) | Proveedor nuevo; resuelve I4 sin que emisora lea `public` | `arch:check` + `test` |
| 12 | `apps/api/src/modules/academic/academic.module.ts` | Exportar el proveedor `FormacionDirectory` (archivo nuevo en `academic/infrastructure/`) | Proveedor nuevo; no se tocan casos de uso ni repositorios existentes | `arch:check` + `test` |
| 13 | `apps/api/src/modules/files/domain/file.service.ts` | **B4:** añadir parámetro opcional `politica?: 'default' | 'emisora-audio'` a `UploadFileInput`; cuando no se envía, ejecuta exactamente el código actual (`env.MAX_FILE_BYTES`, `ALLOWED_MIME_LIST`) | Valor por defecto idéntico; la ruta `POST /api/v1/files` no cambia | `file.service.spec.ts` + regresión |
| 14 | `apps/api/src/shared/config/env.ts` y `.env.example` | Añadir `EMISORA_MAX_AUDIO_BYTES` con valor por defecto explícito | Variable nueva; no altera `MAX_FILE_BYTES` | `typecheck` + `test` |
| 15 | `packages/contracts/scripts/contract.test.mjs` | **EL-3 (B2):** actualizar recuentos de `:178`, `:179`, `:194` (62 base, `64 + N_eventos_emisora` merged) y el `deepEqual` de `amendments` de `:195-198` para incluir `cambio-emisora-eventos.md` | Sin esto `pnpm test:contracts` falla aunque el catálogo sea correcto. La base sigue siendo 62: los eventos emisora van solo en la enmienda | `pnpm test:contracts` |
| 16 | `packages/contracts/events.json` | Regenerado por `pnpm contracts:generate`; incorpora la enmienda de eventos emisora | No se edita a mano | `contracts:validate` |
| 17 | `packages/contracts/openapi.json` | Regenerado desde código; solo rutas nuevas `/api/v1/emisora/...` | Sin cambios en operaciones existentes | `contracts:validate`, `contracts:lint`, `git diff` |
| 18 | `packages/contracts/public-routes.json` | **Sin cambios**. Ninguna ruta de emisora es pública | El validador exige coincidencia exacta | `contracts:validate` |
| 19 | `apps/api/src/modules/exports/domain/export-templates.ts` | Añadir plantillas `emisora-*` al arreglo `EXPORT_TEMPLATES` | Arreglo aditivo; `findExportTemplate` sigue igual | `export-templates.spec.ts` |
| 20 | `apps/api/src/modules/notifications/domain/notification-policy.ts` | **I9:** añadir a `CRITICAL_EVENT_PREFIXES` los prefijos críticos emisora `rejilla.aprobada`, `incentivo.asignado`, `transmision.autorizada` (nombres `dominio.accion`, §5.1) | Arreglo aditivo; `isCriticalEvent` no cambia | EL-6 |
| 21 | `apps/api/src/modules/notifications/domain/notification-policy.spec.ts` | **EL-6:** ampliar el `deepEqual` de `:41-47` con los prefijos nuevos | Expectativa exacta, no relajación | `pnpm test` |
| 22 | `apps/api/src/database/migrations/public/0009_emisora_notification_templates.ts` (nuevo) | **B5:** migración aditiva que inserta solo las filas nuevas de `public.plantilla_notificacion`; `down` las borra por `codigo` | Ruta elegida para no modificar el código del módulo Notificaciones: las plantillas siguen viviendo donde el dispatcher ya las lee. Alternativa (EM-PA-08) si el equipo rechaza escribir en `public` | `test:integration` |
| 23 | `apps/api/test/integration/migrator.spec.ts` | **EL-4 (B5):** ampliar `toBe(22)` de `:275` y `:384` a `22 + N_plantillas_emisora` y añadir un `where codigo in ('convocatoria.abierta', 'rejilla.aprobada', ...)` que verifique las nuevas | Sin cambio falla por recuento exacto; se comprueba que el `down` deja 22 | `test:integration` |
| 24 | `apps/api/src/shared/audit/audit-redactor.ts` | **I6:** añadir a `SECRET_KEYS` las claves cifradas/PII de emisora (`numero_documento_cifrado`, `numero_documento_hash`, `contacto_cifrado`, `consentimiento_datos`) | Conjunto aditivo; la redacción sigue siendo por clave, no por evento | `audit-redactor.spec.ts` nuevo |
| 25 | `apps/api/test/api/authorization-matrix.spec.ts` | **EL-5:** añadir los `operationId` nuevos a `EXPECTED_OPERATIONS` y verificar, para cada operación con `scope: global`, un caso permitido **y** un caso denegado (`:354-381`) | Cubre I12: la matriz ya impone el caso denegado, solo hay que darle datos emisora | `pnpm test` |
| 26 | `apps/web/src/api/client.ts` | Añadir tipos de las nuevas operaciones al tipo `Paths`, con query/body/multipart idénticos a OpenAPI | **EL-7 (I10):** `client-contract.test.mjs:154-189` compara shapes exactos; toda operación no consumida debe entrar en `OPERACIONES_NO_CONSUMIDAS` (`:147-152`) | `pnpm test:contracts` |
| 27 | `packages/contracts/scripts/client-contract.test.mjs` | **EL-7 bis:** si alguna operación emisora no tiene UI (p. ej. reportes internos), añadir su `method path` a `OPERACIONES_NO_CONSUMIDAS` | Conjunto aditivo | `pnpm test:contracts` |
| 28 | `apps/web/src/App.tsx` | Una ruta hija `/emisora/*` dentro del shell | No modifica rutas actuales | `test:e2e`, a11y |
| 29 | `apps/web/src/components/layout/SideDrawer.tsx` | Una sección de navegación filtrada por permiso | Usuarios sin permisos emisora ven exactamente el menú actual | `common.test.tsx`, E2E |
| 30 | `e2e/fixtures.ts` | **I8:** extender `E2eUserKey` (`:9`) y `E2eUserFixture.perfil` (`:16`) con los perfiles emisora usados en E2E, y añadir entradas a `E2E_USERS` | Solo tipos/fixtures nuevos; las fixtures actuales quedan igual | `pnpm test:e2e` |
| 31 | `.github/workflows/ci.yml` | **Verificado en E5:** el job `e2e` ya existe desde E0 y ejecuta migraciones, semilla, Chromium y `pnpm test:e2e` (recorridos E2/E3/E4). No se duplica. k6 queda fuera del CI por decisión RNF-06 (§21) | El plan se escribió cuando se creía que solo existía el job `integration`; la comprobación real prevalece sobre la suposición | CI |
| 32 | `docs/adr/ADR-0005-emisora-contexto-delimitado.md` (nuevo) | Registra contexto, esquema, puertos y decisión I4 | No edita ADR-0001…0004 | Revisión de compuerta |
| 33 | `docs/contratos/cambios/cambio-emisora-contexto.md` (nuevo) | Enmienda de gramática: contexto `emisora` | No edita el cap. 8 congelado | Revisión de compuerta |
| 34 | `docs/contratos/cambios/cambio-emisora-eventos.md` (nuevo) | Enmienda con tabla bajo `## 3.` y eventos en backticks; nombres `^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$` (M3: sin guiones) | `catalog.mjs:15` solo lee esa sección y ese patrón; si se incumple, `events.json` no los detecta | `contracts:generate` + `validate` |
| 35 | `docs/contratos/matriz-autorizacion-emisora-v1.md` (nuevo) | Matriz documental de emisora | No edita la matriz congelada v1 | Revisión de compuerta |
| 36 | `apps/api/src/database/seeds/run.ts` | Invocar `seedEmisora(db)` después de `seedIdentity`, bajo el mismo guard que prohíbe semillas en producción | No se modifica `seedIdentity`; la semilla de emisora solo carga datos de negocio (I3) | `pnpm db:seed` en local |

**Expectativas exactas (EL-1…EL-7), resincronizar en el mismo PR:** EL-1 `perfiles.spec.ts:33` (37 → 37+N); EL-2 `identity-flow.spec.ts:208-212` (3 → 16 perfiles); EL-3 `contract.test.mjs:178-198` (62 base sin cambio, 64 → 64+N merged, `amendments` con dos entradas); EL-4 `migrator.spec.ts:275,384` (22 → 22+M); EL-5 `authorization-matrix.spec.ts` (`EXPECTED_OPERATIONS` + caso denegado por `scope: global`); EL-6 `notification-policy.spec.ts:41-47` (prefijos); EL-7 `client-contract.test.mjs:147-189` (paridad de shapes y `OPERACIONES_NO_CONSUMIDAS`).

**Prohibido expresamente:** modificar la semántica de `file-policy.ts` (lista blanca/límite por defecto), `problem-details.filter.ts`, `authorization.guard.ts`, `auditoria_solo_insercion()`, las migraciones **existentes** de `public/*` y `academic/*` (la `0009` nueva es aditiva y explícita), `public-routes.json`, la lógica de las pruebas EL-1…EL-7 (solo sus datos esperados), ni estilos/tema de `apps/web/src/theme/`.

---

## 4. Modelo de datos propuesto (esquema `emisora`)

Convenciones heredadas: UUIDv7 generado en aplicación, `snake_case`, `timestamptz` UTC, enum de PostgreSQL, `deleted_at` solo donde el negocio lo exija, sin FK entre esquemas, auditoría aparte.

### 4.1 Agrupación de tablas

| Agregado | Tablas | RF |
|---|---|---|
| Convocatoria y participación | `convocatoria`, `realizador`, `proyecto_programa`, `comite`, `rejilla_anual`, `rejilla_anual_item` | RF-03.1…03.4 |
| Programación | `programacion_diaria`, `programacion_item` | RF-01.1…01.3 |
| Grabación y archivo sonoro | `sesion_grabacion`, `audio`, `asistencia_cabina` | RF-02.1…02.4, RF-11.1 |
| Seguimiento e incentivos | `informe_realizador`, `incentivo`, `resolucion_incentivo` | RF-03.5…03.7 |
| Patrocinios y promos | `patrocinio`, `orden_emision`, `promo`, `publicacion` | RF-04, RF-05 |
| Transmisiones | `transmision`, `salida_equipo`, `reporte_desplazamiento`, `prestamo_mifi`, `viatico` | RF-06.1…06.6, RF-10.2 |
| Sede de transmisores | `turno_operador`, `lectura_transmisor`, `bitacora_sede` | RF-07.1…07.3 |
| Derechos de autor | `obra`, `reporte_obra`, `pago_derechos`, `parametro_reporte` (EM-PA-07: entidad, periodicidad, día límite, activo) | RF-08.1…08.3 |
| Tecnología e inversión | `hoja_vida_equipo`, `actualizacion_tecnologica`, `proyeccion_anual`, `inversion_seguimiento`, `version_software`, `asignacion_equipo` | RF-09.1…09.4 |
| Oferta cultural y trámites | `actividad_cultural`, `permiso_gobierno`, `tramite_externo`, `soporte_tramite` | RF-10.1, RF-12.1…12.2 |
| Emisión y archivo | `planilla_emision`, `archivo_emisora` | RF-11.2, RF-11.1 |

`archivo_emisora` guarda **metadatos** (tipo, duración, fecha, responsable, `archivo_id` lógico a `public.archivo`); el binario vive en el contexto Archivos. No se duplica almacenamiento.

### 4.2 Reglas de integridad y negocio en el dominio

| Regla | RF | Implementación |
|---|---|---|
| Convocatoria anual con plazo de **tres semanas** al inicio de año; una por año | RF-03.1 | `convocatoria.fecha_cierre = fecha_apertura + 21 días`, restricción + validación de dominio; única por `anio`. |
| Proyecto solo se recibe en convocatoria abierta y con formato oficial adjunto | RF-03.2 | Estado `convocatoria = 'abierta'` y `archivo_id` obligatorio. |
| Rejilla anual aprobada solo por comité con acta adjunta | RF-03.3 | Transición `borrador → aprobada` exige `comite.acta_archivo_id`. **Sin versionado** (respuesta 4): una rejilla vigente por año; el histórico queda en auditoría. |
| Programación diaria verificable contra rejilla anual | RF-01.3 | `programacion_diaria.rejilla_anual_id` + regla de correspondencia de franjas/tipo; resultado `concuerda`/`desviaciones[]`. |
| No solapamiento de franjas en la misma fecha | RF-01.1 | Restricción de exclusión o validación transaccional en `programacion_item`. |
| Asistencia a cabina registrada por sesión | RF-02.2 | `asistencia_cabina` única por (`sesion_id`, `usuario_id`). |
| Programa externo: recibido → revisado → aprobado/rechazado;_aprobado habilita archivo en catálogo | RF-02.3 | Máquina de estados con transiciones tipadas. |
| Metadatos mínimos del audio: tipo, duración, fecha, responsable | RF-02.4 | Columnas obligatorias en `audio`. |
| Informes de realizador en octubre/noviembre | RF-03.5 | Ventana de fecha validada; estado `recibido → evaluado`. |
| Incentivo: calificación → resolución → solicitud de CDP (referencia externa) | RF-03.6/03.7 | `incentivo.estado`; `resolucion_incentivo` con PDF emitido y `referencia_cdp` como texto, sin llamada a SIIF. |
| Orden de emisión y patrocinio en plantilla de promos/menciones | RF-04.3 | `orden_emision` referencia `promo` y a la programación; estado `programado`. |
| Mifi con **antelación mínima de dos días** | RF-06.5 | `prestamo_mifi.fecha_solicitud <= fecha_transmision - 2 días`; validación de dominio + restricción. |
| Viático solo para transmisiones **fuera de la ciudad** | RF-06.6 | `transmision.es_fuera_ciudad = true` obliga/permite `viatico`; estados de resolución/compromiso/orden como referencias. |
| Lecturas técnicas diarias y bitácora por sede | RF-07.2/07.3 | Única por (`transmisor_id`, `fecha`); `bitacora_sede` con actor y `request_id`. |
| Obra con título, compositor/artista, duración y fecha de inclusión | RF-08.1 | Columnas obligatorias; `reporte_obra` agrupa por entidad y periodo. |
| Pagos de derechos solo soporte/estado | RF-08.3 | Sin importes calculados ni ejecución; `soporte_archivo_id` + `referencia`. |
| Inversión aprobada y seguimiento contractual | RF-09.3 | Estado y referencias de contrato; sin contabilidad. |
| Trámites a otras dependencias con soportes | RF-12 | `tramite_externo.destino` enum cerrado + `soporte_tramite`. |

### 4.3 Privacidad (RNF-05, Ley 1581)

- `realizador` es el único agregado con PII de terceros: `numero_documento_cifrado` + `numero_documento_hash` (HMAC ciego para búsqueda), `contacto_cifrado`, `consentimiento_datos` (jsonb con versión y fecha del aviso).
- Dueño de los datos: **el administrador** (respuesta 3). Se registra como decisión `EM-D-03` (corrección M2: `EM-D-01` es la decisión de oficios PDF) con responsable de la política de retención.
- Los datos personales nunca se copian a `datos_antes`/`datos_despues` de auditoría: los DTOs de emisora construyen el payload solo con claves permitidas y `audit-redactor.ts` redacta **por clave** (no por evento). Se añaden las claves cifradas de emisora a `SECRET_KEYS` de forma aditiva (fila 24 de §3).
- Acceso `*_own` de `realizador_externo` se resuelve por `realizador.usuario_id`, con identidad temporal (`valid_until`) cuando aplique; la resolución del principal viene de `IdentityDirectory` (§2.2), no de SQL contra `public`.

### 4.4 Tiempo, fechas y límites (I7)

| Aspecto | Decisión |
|---|---|
| Zona horaria de negocio | `America/Bogota` (UTC-5, sin horario de verano). Se declara en la enmienda `cambio-emisora-contexto.md` y en la configuración de la API. |
| Almacenamiento | `timestamptz` UTC para todo instante (`creado_en`, `ocurrido_en`, `fecha_solicitud`, etc.); `date` sin zona para fechas de calendario (`fecha_transmision`, `fecha_inclusion`, `anio`, franjas de la rejilla). Nunca se guarda un `timestamp without time zone`. |
| Presentación | La SPA convierte a `America/Bogota` con el mismo mecanismo de formato del shell; el contrato documenta el formato ISO-8601 con offset. |
| Convocatoria de 3 semanas | `fecha_cierre = fecha_apertura + 21 días`, **inclusive**: se aceptan proyectos con `fecha_recepcion <= fecha_cierre` a las `23:59:59 America/Bogota`. Un año = una convocatoria (`unique (anio)`). |
| Mifi, 2 días de antelación | `fecha_solicitud <= fecha_transmision - 2 días` (días calendario), **inclusive**. Solicitudes el mismo día o con 1 día de antelación se rechazan con `EMISORA_MIFI_ANTELACION_INSUFICIENTE`. |
| Informes oct/nov | Ventana `[1 octubre, 30 noviembre]` **inclusive** en `America/Bogota`, evaluada sobre `date`; fuera de ventana: `EMISORA_FUERA_VENTANA_INFORME`. |
| Concurrencia | Las transiciones de estado (rejilla, incentivo, orden de emisión, trámite) se hacen con `SELECT ... FOR UPDATE` sobre la fila del agregado dentro de la misma transacción que escribe la auditoría; un conflicto devuelve 409 con código de dominio, nunca una excepción 500. |

---

## 5. Permisos y perfiles

### 5.1 Gramática y catálogo

Se añade el contexto `emisora` a la gramática `contexto:recurso:acción`, sin cambiar el vocabulario de acciones (`read`, `read_own`, `create`, `update`, `update_own`, `delete`, `export`, `manage`). Recursos propuestos (cada uno con `read` y `manage` como mínimo, más acciones concretas donde haga falta):

`programacion`, `rejilla`, `convocatoria`, `realizador`, `proyecto`, `comite`, `grabacion`, `asistencia-cabina` (M1: requerido por `tecnico_grabacion`), `audio`, `informe`, `incentivo`, `resolucion`, `patrocinio`, `promo`, `publicacion`, `transmision`, `viatico`, `prestamo`, `turno`, `lectura`, `bitacora`, `obra`, `derecho`, `equipo`, `inversion`, `proyeccion`, `actividad`, `permiso-salida`, `tramite`, `planilla`, `archivo-emisora`.

Ejemplos: `emisora:programacion:update`, `emisora:rejilla:export`, `emisora:proyecto:read_own`, `emisora:incentivo:update`, `emisora:lectura:create`, `emisora:tramite:manage`.

> Los guiones son válidos en el **recurso** (`asistencia-cabina`, `permiso-salida`, `archivo-emisora`), pero **no** en los nombres de evento de auditoría: `catalog.mjs:15` y `notification-policy.ts:29` exigen `^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$` (**un solo punto**, sin guiones). Por tanto los eventos emisora siguen la convención `dominio.accion` del catálogo base (`asistencia.registrada`, `reporte_obra.generado`) y **no** se escriben como `emisora.asistencia.registrada` (dos puntos → el generador los ignoraría). "Eventos `emisora.*`" en este documento significa "eventos del catálogo de la emisora", no un prefijo literal.

> Detalle técnico crítico: `expandPermissions` y `permissionsFor` solo materializan acciones **presentes en `PERMISSION_CATALOG`**. Si un recurso tiene únicamente `manage`, no se conceden `read`/`create`. Por eso el catálogo debe enumerar explícitamente cada acción usada por los controladores.

### 5.2 Perfiles nuevos (mismo esquema RBAC)

| Perfil | Actor(es) del manual | Permisos representativos |
|---|---|---|
| `jefe_emisora` | Jefe de oficina de la emisora | `emisora:*:manage`, `exports:report:export`, `files:*:create/read` |
| `programador` | Programador | `emisora:programacion:manage`, `emisora:rejilla:read`, `emisora:patrocinio:read`, `emisora:promo:read` |
| `tecnico_grabacion` | Técnico operativo de grabación | `emisora:grabacion:manage`, `emisora:audio:manage`, `emisora:proyecto:read`, `emisora:asistencia-cabina:create` |
| `tecnico_emision` | Técnico operativo de emisión | `emisora:programacion:read`, `emisora:promo:manage`, `emisora:patrocinio:manage`, `emisora:planilla:create`, `emisora:transmision:read` |
| `locutor` | Locutor | `emisora:grabacion:read_own`, `emisora:audio:create`, `files:document:create` |
| `tecnico_contenidos` | Técnico operativo de contenidos digitales | `emisora:publicacion:manage`, `emisora:promo:read`, `emisora:audio:read` |
| `realizador_externo` | Realizador externo | `emisora:convocatoria:read`, `emisora:proyecto:create/read_own/update_own`, `emisora:informe:create/read_own`, `emisora:rejilla:read` (identidad temporal con `valid_until`) |
| `comite_programacion` | Comité de programación | `emisora:proyecto:read`, `emisora:informe:read`, `emisora:rejilla:update`, `emisora:incentivo:update` |
| `secretario_cultura` | Secretario de Cultura | `emisora:incentivo:update/export`, `emisora:resolucion:read`, `emisora:inversion:read` |
| `auxiliar_administrativo` | Auxiliar administrativo | `emisora:tramite:manage`, `emisora:permiso-salida:create`, `emisora:actividad:read` |
| `contratista_prensa` | Contratista de prensa | `emisora:actividad:read`, `emisora:publicacion:create`, `files:document:create` |
| `ingeniero_mantenimiento` | Ingeniero/técnico de mantenimiento | `emisora:equipo:manage`, `emisora:inversion:read`, `emisora:proyeccion:manage` |
| `operador_transmisor` | Operador de sede de transmisores | `emisora:turno:read_own`, `emisora:lectura:create`, `emisora:bitacora:create` |

El perfil `administrador` existente recibe **una entrada adicional** `emisora:*:manage` (no se le quita ni se le cambia nada). Con esto, cada operación nueva tiene al menos un caso permitido en la matriz ejecutable.

**Decisión I3 cerrada:** los 13 perfiles viven en `PROFILE_SEEDS` (la semilla, la matriz de autorización y el guard comparten la misma concesión). No existe un `seedEmisora` que cree perfiles: `seedEmisora` solo carga datos de negocio de ejemplo y se invoca desde `apps/api/src/database/seeds/run.ts` después de `seedIdentity` (fila 36 de §3 y §11). Esto evita dos fuentes de verdad y resincroniza EL-1/EL-2.

Todo permiso `*_own` exige verificación de propiedad en servidor (`EmisoraOwnershipPolicy`) además del permiso; se prueba caso permitido, caso ajeno denegado y caso sin permiso. Para operaciones con `scope: global` la matriz existente (`authorization-matrix.spec.ts:354-381`) exige **además** un caso denegado (EL-5).

---

## 6. Auditoría, idempotencia y trazabilidad

1. **Eventos:** catálogo nuevo en `docs/contratos/cambios/cambio-emisora-eventos.md` con encabezado `## 3.` y tabla de eventos en backticks (formato que parsea `catalog.mjs`). Nombres `dominio.accion`, un solo punto y sin guiones (§5.1). Lista cerrada: `programacion.creada`, `programacion.aprobada`, `rejilla.aprobada`, `rejilla.verificada`, `grabacion.programada`, `grabacion.aprobada`, `asistencia.registrada`, `audio.archivado`, `convocatoria.abierta`, `convocatoria.cerrada`, `proyecto.recibido`, `realizador.notificado`, `comite.registrado`, `informe.recibido`, `informe.calificado`, `incentivo.asignado`, `resolucion.generada`, `patrocinio.aprobado`, `orden.emitida`, `promo.producida`, `publicacion.realizada`, `transmision.autorizada`, `viatico.solicitado`, `prestamo.autorizado`, `turno.asignado`, `lectura.registrada`, `bitacora.registrada`, `obra.incluida`, `reporte_obra.generado`, `pago.registrado`, `equipo.actualizado`, `proyeccion.generada`, `inversion.registrada`, `actividad.registrada`, `permiso.emitido`, `tramite.radicado`, `soporte.adjuntado`, `planilla.registrada`. Esta lista es la única fuente para §14: todo evento de la matriz de trazabilidad está aquí (corrige I11).
2. **Reglas de redacción (I6):** se reutiliza `audit-redactor.ts`, que redacta **por nombre de clave**, no por evento, y trunca payloads mayores de 8 KB a `{resumen, hash_sha256, campos}`. Por tanto: (a) los DTOs de emisora construyen `datosDespues` solo con claves permitidas; (b) se añaden aditivamente a `SECRET_KEYS` las claves `numero_documento_cifrado`, `numero_documento_hash`, `contacto_cifrado`, `consentimiento_datos`; (c) el payload se mantiene por debajo de 8 KB y los soportes voluminosos se sustituyen por `archivo_id` + hash; (d) se registra versión/fecha del consentimiento, nunca su contenido.
3. **Escritura:** `AuditWriter` en la misma transacción que el cambio; si falla, la operación se revierte. Sin acceso directo a la tabla de auditoría.
4. **Contrato:** cada operación lleva `ApiContract({ access: 'permission', permission: [...], scope, auditEvent, errorCodes })`. El validador de contrato rechaza operaciones mutantes sin `x-audit-event`.
5. **Generación de documentos (I5):** `apps/api/src/modules/exports/application/exports.service.ts:175-205` **siempre** registra `reporte.generado` y encola ese mismo evento en el outbox; no acepta un `auditEvent` parametrizable. No se modifica: los casos de uso de emisora emiten su propio evento de dominio (`resolucion.generada`, `reporte_obra.generado`, etc.) **además** de ese evento transversal de exportación, y el contrato documenta ambos. Las pruebas de auditoría deben esperar la pareja y no asumir que `reporte.generado` es el único evento.
6. **Idempotencia:** cabecera `Idempotency-Key` obligatoria en creaciones con efecto secundario (convocatoria, grabación, transmisión, orden de emisión, generación de resolución/reporte, radicación de trámite) usando el store existente (`public.idempotency_key`). La verificación M6 de `idempotency store` y `AuditWriter` se ejecuta **antes** de E1 para confirmar firmas y semántica reales; si difieren del plan, se ajusta el plan antes de escribir código.
7. **Adjuntos:** todo soporte documental se registra vía contexto Archivos; `archivo_id` es referencia lógica y su descarga queda auditada por el contexto dueño.

---

## 7. Integraciones internas

| Servicio | Forma de integración | Restricción |
|---|---|---|
| Archivos (`files`) | Carga y descarga por sus endpoints; emisora guarda `archivo_id`, `hash`, MIME. Incluye audios, PDFs, actas, imágenes de evidencia | **B4 resuelto:** la política por defecto de `file-policy.ts` y el límite `env.MAX_FILE_BYTES` **no se cambian**. Se crea `files/domain/file-policy-emisora.ts` con MIME de audio y `env.EMISORA_MAX_AUDIO_BYTES`; `FileService.upload` acepta un parámetro opcional `politica` cuyo valor por defecto es el comportamiento actual; el upload de audio se expone en un endpoint **nuevo de emisora** con su propio `FileInterceptor`, sin tocar `files.controller.ts:45-48`. `POST /api/v1/files` sigue igual |
| Exportaciones (`exports`) | Los oficios, actas, resoluciones, formatos y reportes se generan con plantillas registradas nuevas (`emisora-oficio-salida`, `emisora-resolucion-incentivos`, `emisora-formato-programacion`, `emisora-rejilla-cuneros`, `emisora-reporte-obras`, etc.). Entrada: JSON saneado; salida PDF | No se generan PDF dentro de controladores de emisora; no se consulta BD desde el módulo de exportaciones. `exports.service.ts` no se modifica: emite `reporte.generado` además del evento de dominio emisora (§6.5) |
| Notificaciones | Nuevos eventos y plantillas: convocatoria abierta/cerrada, rejilla aprobada, grabación asignada, informe recibido, incentivo aprobado, transmisión autorizada, turno asignado. Archivos concretos: `notifications/domain/notification-policy.ts`, su `.spec.ts` (EL-6) y `migrations/public/0009_emisora_notification_templates.ts` (B5/EL-4) | Mismo respeto a preferencias; prefijos críticos `rejilla.aprobada`, `incentivo.asignado`, `transmision.autorizada` se añaden a `CRITICAL_EVENT_PREFIXES`. Los nombres de plantilla (`codigo`) cumplen el regex de un solo punto (M3) |
| Auditoría | `AuditWriter` existente | Sin cambios en inmutabilidad ni en el modelo; solo entradas nuevas en `SECRET_KEYS` y en el catálogo de eventos |
| Identidad y Acceso | Guard global, `PERMISSION_CATALOG`, `PROFILE_SEEDS`, `valid_until`, `x-perfil-activo`; `IdentityDirectory` expuesto por `identity` (§2.2) | No se crea un mecanismo de autorización propio; emisora no consulta `public` directamente |
| Académico | `FormacionDirectory` expuesto como interfaz pública en `shared/integration/`, implementado dentro de `academic`, consumido por emisora para inscripciones de formación y datos de formadores | Sin importar clases internas ni SQL contra `academic`; `arch:check` lo garantiza |
| Analítica | Solo si se requieren KPIs de emisora: nuevas definiciones **aditivas** sobre vistas de lectura del esquema `emisora` | No se modifica `analytics-catalog.ts` existente ni se escribe en esquemas ajenos |

---

## 8. Integraciones externas y trámites

| Sistema | Alcance en este módulo | Límite explícito |
|---|---|---|
| SAIA | Registro y seguimiento de radicación; generación del oficio en PDF para radicar | Sin llamada automática; `tramite_externo.radicado_ref` y soporte adjunto |
| SIIF | Seguimiento de compromisos y órdenes de pago de viáticos/incentivos como **referencias y estados** | Sin integración financiera ni cálculo de pagos (respuesta 2) |
| Secretaría de TIC | Préstamo de mifi (RF-06.5) y plataforma de inscripciones | Registro local; validación de antelación de 2 días |
| Sayco / Acinpro | Reporte digital de obras y registro de pagos con soporte | Sin envío automático en esta versión; `reporte_obra` + PDF |
| Secretaría de Gobierno | Permisos de salida y eventos como flujo documental | Oficio PDF emitido + bitácora de trámite |
| Hacienda | Resoluciones y soportes de incentivos | Solo trazabilidad documental |
| Módulo Académico | Formación y formadores | Vía `FormacionDirectory` (§7) |

**Respuesta 1 integrada:** los oficios **se emiten en PDF** desde Exportaciones; no se entregan solo plantillas.

---

## 9. API y contratos

- Prefijo: `/api/v1/emisora/...`, `kebab-case` en rutas, `camelCase` en JSON.
- Un `operationId` estable por operación, añadido a `EXPECTED_OPERATIONS`.
- Respuestas Problem Details (RFC 9457) con `code` y `requestId`; errores de dominio tipados (`EMISORA_CONVOCATORIA_CERRADA`, `EMISORA_MIFI_ANTELACION_INSUFICIENTE`, `EMISORA_FUERA_VENTANA_INFORME`, `EMISORA_TRANSICION_INVALIDA`, etc.).
- Paginación `page`/`pageSize` ≤ 100, `sort` y filtros tipados.
- Ninguna operación `x-access=public`; `public-routes.json` permanece intacto.
- Tras cada fase: `pnpm contracts:generate && pnpm contracts:validate && pnpm contracts:lint && pnpm test:contracts`.
- El cliente `apps/web/src/api/client.ts` se actualiza con los tipos nuevos; la paridad se verifica en CI. **I10:** `client-contract.test.mjs:154-189` exige que los *shapes* de query, body y la presencia de JSON/multipart coincidan exactamente con OpenAPI; las operaciones sin UI se declaran en `OPERACIONES_NO_CONSUMIDAS` (EL-7). No se pueden documentar parámetros opcionales en el cliente que el contrato no declare, ni al revés.
- Todo `operationId` nuevo entra en `EXPECTED_OPERATIONS` (EL-5); los errores de dominio se declaran en `errorCodes` y se mapean a Problem Details sin cambiar `problem-details.filter.ts`.

### 9.1 Mapa de recursos REST (propuesto)

`/emisora/programacion-diaria`, `/emisora/rejilla-anual`, `/emisora/convocatorias`, `/emisora/proyectos`, `/emisora/comites`, `/emisora/grabaciones`, `/emisora/audios`, `/emisora/informes`, `/emisora/incentivos`, `/emisora/resoluciones`, `/emisora/patrocinios`, `/emisora/promos`, `/emisora/publicaciones`, `/emisora/transmisiones`, `/emisora/viaticos`, `/emisora/prestamos-mifi`, `/emisora/turnos`, `/emisora/lecturas`, `/emisora/bitacora`, `/emisora/obras`, `/emisora/reportes-obras`, `/emisora/pagos-derechos`, `/emisora/equipos`, `/emisora/inversiones`, `/emisora/actividades`, `/emisora/permisos-salida`, `/emisora/tramites`, `/emisora/planillas`, `/emisora/archivos`.

---

## 10. Frontend

1. Enrutamiento anidado bajo `/emisora/*` con una landing del módulo y subrutas por agrupación (Programación, Grabación, Rejilla y realizadores, Patrocinios y promos, Transmisiones, Transmisores, Derechos, Tecnología, Archivo y trámites).
2. Cada pantalla usa `PageHeader`, `SectionCard`, `DataTable`, `SearchToolbar`, `StatusChip`, `LoadingState`, `EmptyState`, `ErrorState`, `ConfirmDialog` existentes.
3. Navegación generada desde permisos; si el usuario no tiene permisos emisora, la sección no aparece y las rutas devuelven 403 en API (autorización real siempre en backend).
4. Sin estilos propios de tema; solo `sx` local cuando sea estrictamente necesario y siempre con tokens del tema.
5. Accesibilidad: mismas pruebas `axe`, foco, teclado y puntos de quiebre 360/768/1024/1440. Se añaden recorridos E2E para los flujos críticos.
6. Estados de carga/error/vacío y traducción de códigos de error con el mismo mecanismo del shell.

---

## 11. Migraciones y semillas

**Ruta correcta (corrección I1):** `apps/api/src/database/migrations/emisora/` — la misma que resuelve `resolveMigrationFolder()` (`migrator-setup.ts:15-17`) a partir de `../migrations/<schema>`. **No** existe `apps/api/src/database/migrator/migrations/...`; escribir allí dejaría el migrador sin ver los archivos.

| Archivo | Contenido |
|---|---|
| `apps/api/src/database/migrations/emisora/0001_create_emisora_core.ts` | Tipos enum y tablas de convocatoria, realizador, proyecto, comité y rejilla |
| `apps/api/src/database/migrations/emisora/0002_create_emisora_operation.ts` | Programación, grabación, audio, patrocinios, promos y transmisiones |
| `apps/api/src/database/migrations/emisora/0003_create_emisora_reporting.ts` | Transmisores, derechos (incl. `parametro_reporte`), tecnología, archivo y trámites |
| `apps/api/src/database/migrations/emisora/0004_emisora_indexes.ts` | Índices y restricciones de exclusión |
| `apps/api/src/database/migrations/public/0009_emisora_notification_templates.ts` | **Única** migración en `public`: filas nuevas de `plantilla_notificacion` (B5), con `down` que las elimina por código |

- Numeración independiente por esquema: `emisora.kysely_migration` es el historial; `public.kysely_migration` conserva `0001`…`0008` más la `0009` nueva. No se renombra ninguna migración existente.
- Cada migración `up`/`down` reversible, de **un solo esquema**, probada con `up → down → up`; el `down` elimina tipos/tablas/índices/filas creados por esa migración y solo esos (I2).
- `migrate.ts` ya itera `MIGRATION_SCHEMAS`: basta con actualizar los mensajes que enumeran esquemas (fila 3 de §3) para que `migrate:up emisora`, `migrate:down emisora` y `migrate:status emisora` estén documentados y operativos. El runbook se amplía en la fila 4.
- Grants: `00-roles.sql` crea el esquema y otorga `USAGE` a `ccltpg_app`/`ccltpg_readonly`, `USAGE, CREATE` a `ccltpg_migrator`, y `ALTER DEFAULT PRIVILEGES` equivalentes a los de `academic` (fila 5). `ccltpg_readonly` queda con `default_transaction_read_only = on`. No se dan permisos de UPDATE/DELETE sobre `public.evento_auditoria`.
- Semilla `apps/api/src/database/seeds/emisora.seed.ts` (nueva, idempotente, UUIDv5 deterministas): convocatoria de ejemplo, rejilla anual y transmisor de ejemplo. **No crea perfiles ni permisos** (I3): esos viven en `PROFILE_SEEDS`/`PERMISSION_CATALOG`. Se invoca desde `apps/api/src/database/seeds/run.ts` después de `seedIdentity`, bajo el mismo guard que prohíbe ejecutar semillas en producción. `seedIdentity` no se modifica.

---

## 12. Pruebas, compuertas y regresión

| Nivel | Acción | Herramienta |
|---|---|---|
| Unitaria | Máquinas de estado (convocatoria, rejilla, grabación, incentivo, transmisión, trámite), reglas de fecha (3 semanas, 2 días, oct/nov), redacción de auditoría | Vitest |
| Integración | Migraciones `up/down/up` en esquema `emisora`, restricciones, unicidad, índices, roles de BD, transacciones con auditoría | Testcontainers + PostgreSQL real |
| API | Un Supertest por operación: contrato, Problem Details, paginación, idempotencia, adjuntos, 403/404 | Supertest |
| Autorización | Matriz emisora: permitido/denegado por perfil, `*_own` con recurso ajeno, sin permiso, sin sesión | `authorization-matrix.spec.ts` + matriz documental |
| Contrato | OpenAPI generado sin deriva, eventos en catálogo, allowlist pública intacta, paridad cliente | `contracts:validate`, `client-contract.test.mjs` |
| Arquitectura | Sin importaciones cruzadas, dominio sin frameworks, datos solo en infraestructura | `arch:check`, `test:architecture` |
| E2E y a11y | Flujos: programación diaria, convocatoria→rejilla, grabación→audio, patrocinio→promo→orden, transmisión→mifi→viático, reporte de obras; `axe` y teclado. **I8:** ampliar `e2e/fixtures.ts` con los perfiles emisora; el CI actual (`.github/workflows/ci.yml:160-164`) solo ejecuta `test:integration`, así que hay que añadir un job de E2E para que estas pruebas existan de verdad | Playwright + CI |
| Carga | Escenario de consulta de programación diaria con 200 usuarios concurrentes y p95 < 4 s (RNF-06). Fuera del job estándar de CI: se ejecuta como compuerta manual en E5 y se documenta en el runbook | k6 |

**Comando de regresión obligatorio al final de cada fase:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:architecture && pnpm test:contracts && pnpm contracts:validate && pnpm format:check && pnpm test:e2e`. Todo debe pasar con el mismo resultado que antes de empezar, más las pruebas nuevas. **Nota I8:** `pnpm test:e2e` hoy no corre en CI (solo local); el plan incorpora el job nuevo en la fila 31 de §3, por lo que la regresión "en CI" no es efectiva hasta que ese job exista.

---

## 13. Fases y compuertas

| Fase | Alcance | Entregable principal | Compuerta de salida |
|---|---|---|---|
| **E0 — Gobernanza** | ADR-0005, enmiendas de gramática y eventos, matriz de autorización emisora, catálogo de plantillas, decisiones/supuestos/preguntas registradas | Documentos nuevos, sin código | Aprobación humana; ningún documento congelado editado |
| **E1 — Esqueleto** | Módulo NestJS, esquema `emisora` y migración base, permisos y perfiles, `FormacionDirectory` en `shared/integration`, ruta `/emisora/*` y menú, semillas | `app.module`/`migrator-setup`/`schema` extendidos, `arch:check` en verde | `pnpm arch:check` y regresión completa; rutas sin funcionalidad de neg aún |
| **E2 — Programación, grabación y rejilla** | RF-01, RF-02, RF-03; eventos, adjuntos, notificaciones | Primera demo de extremo a extremo convocatoria→rejilla→programación→audio | Revisión del patrón de módulo (análoga a C4) |
| **E3 — Patrocinios, promos y transmisiones** | RF-04, RF-05, RF-06; oficios PDF, orden de emisión, mifi y viáticos | Flujo completo de salida a transmisión | Verificación de oficios y reglas de plazo |
| **E4 — Operación, derechos, tecnología, archivo y trámites** | RF-07…RF-12; matrices/reportes, bitácora, reporte de obras, seguimiento de inversión, trámites | Módulo funcional completo | Revisión de reportes contra datos crudos |
| **E5 — Endurecimiento y aceptación** | A11y, responsividad, carga, runbooks, trazabilidad RF→código→prueba, cierre de preguntas abiertas | Paquete de revisión emisora | Regresión total en verde y aceptación |

Cada fase es un PR separado sobre `main`, con la regresión en verde antes de abrir el siguiente. No se requiere despliegue blue/green (no hay producción), pero sí migración previa al arranque de la API en cada entorno.

---

## 14. Matriz de trazabilidad RF → diseño

| RF | Tablas / agregado | Permiso representativo | Evento de auditoría | Fase |
|---|---|---|---|---|
| RF-01.1…01.3 | `programacion_diaria`, `programacion_item`, `rejilla_anual` | `emisora:programacion:manage` | `programacion.creada`, `programacion.aprobada`, `rejilla.verificada` | E2 |
| RF-02.1…02.4 | `sesion_grabacion`, `asistencia_cabina`, `audio`, `archivo_emisora` | `emisora:grabacion:manage`, `emisora:audio:create` | `grabacion.programada`, `grabacion.aprobada`, `audio.archivado` | E2 |
| RF-03.1 | `convocatoria` | `emisora:convocatoria:manage` | `convocatoria.abierta` | E2 |
| RF-03.2 | `proyecto_programa`, `realizador` | `emisora:proyecto:create` | `proyecto.recibido` | E2 |
| RF-03.3 | `comite`, `rejilla_anual`, `rejilla_anual_item` | `emisora:rejilla:update` | `comite.registrado`, `rejilla.aprobada` | E2 |
| RF-03.4 | `realizador`, `proyecto_programa` | `emisora:realizador:update` | `realizador.notificado` | E2 |
| RF-03.5 | `informe_realizador` | `emisora:informe:create/read_own` | `informe.recibido` | E2 |
| RF-03.6 | `incentivo`, `comite` | `emisora:incentivo:update` | `incentivo.asignado` | E2 |
| RF-03.7 | `resolucion_incentivo` | `emisora:resolucion:create/export` | `resolucion.generada` | E3 |
| RF-04.1…04.3 | `patrocinio`, `orden_emision`, `promo` | `emisora:patrocinio:manage` | `patrocinio.aprobado`, `orden.emitida` | E3 |
| RF-05.1…05.3 | `promo`, `publicacion` | `emisora:publicacion:manage` | `promo.producida`, `publicacion.realizada` | E3 |
| RF-06.1…06.6 | `transmision`, `salida_equipo`, `reporte_desplazamiento`, `prestamo_mifi`, `viatico` | `emisora:transmision:manage`, `emisora:viatico:read` | `transmision.autorizada`, `prestamo.autorizado`, `viatico.solicitado` | E3 |
| RF-07.1…07.3 | `turno_operador`, `lectura_transmisor`, `bitacora_sede` | `emisora:lectura:create`, `emisora:bitacora:create` | `lectura.registrada`, `turno.asignado` | E4 |
| RF-08.1…08.3 | `obra`, `reporte_obra`, `pago_derechos` | `emisora:obra:manage`, `emisora:derecho:manage` | `obra.incluida`, `reporte_obra.generado`, `pago.registrado` | E4 |
| RF-09.1…09.4 | `hoja_vida_equipo`, `actualizacion_tecnologica`, `proyeccion_anual`, `inversion_seguimiento`, `version_software`, `asignacion_equipo` | `emisora:equipo:manage`, `emisora:inversion:read` | `equipo.actualizado`, `inversion.registrada` | E4 |
| RF-10.1…10.2 | `actividad_cultural`, `permiso_gobierno` | `emisora:actividad:read`, `emisora:permiso-salida:create` | `actividad.registrada`, `permiso.emitido` | E4 |
| RF-11.1…11.2 | `archivo_emisora`, `planilla_emision` | `emisora:archivo-emisora:manage`, `emisora:planilla:create` | `audio.archivado`, `planilla.registrada` | E4 |
| RF-12.1…12.2 | `tramite_externo`, `soporte_tramite` | `emisora:tramite:manage` | `tramite.radicado` | E4 |
| RNF-01…06 | Guard, catálogo, puertos, auditoría, adjuntos, redacción, disponibilidad | Permisos `emisora:*` | Eventos del catálogo emisora (§6.1) y reglas de redacción | Todas |

---

## 15. Decisiones, supuestos y preguntas abiertas

### 15.1 Decisiones recibidas del levantamiento (ya cerradas)

| ID | Decisión |
|---|---|
| EM-D-01 | Los oficios **se emiten en PDF** (no solo plantilla). |
| EM-D-02 | Los pagos a realizadores y derechos se registran **solo como trazabilidad**; sin integración de ejecución de pagos. |
| EM-D-03 | El dueño de los datos personales de realizadores es **el administrador**. |
| EM-D-04 | La rejilla anual **no se versiona**; el histórico se consulta por auditoría. |

### 15.2 Preguntas abiertas nuevas (con valor por defecto para no bloquear)

| ID | Pregunta | Valor por defecto | Dueño / fase |
|---|---|---|---|
| EM-PA-01 | ¿Los archivos de audio se almacenan en el contexto Archivos con política opt-in o en un bucket separado de emisora? | Política opt-in `emisora-audio` dentro de Archivos; sin bucket propio | Rol B+Arquitectura / E1 |
| EM-PA-02 | ¿Los perfiles de emisora viven en `PROFILE_SEEDS` (identidad) o en una semilla propia? | En `PROFILE_SEEDS`, con actualización explícita de la expectativa de la prueba de semilla | Equipo / E0 |
| EM-PA-03 | ¿Los 13 actores se mapean 1:1 a perfiles o se agrupan? | 13 perfiles propuestos en §5.2; agrupables en revisión sin cambiar permisos | Negocio / E0 |
| EM-PA-04 | ¿Los **montos** de viáticos/incentivos se guardan como dato informativo? | Solo referencias y estados; sin importes calculados ni asientos | Secretaría / E0 |
| EM-PA-05 | ¿La rejilla anual no versionada impide consultar el año anterior en pantalla? | No se consulta en UI; la auditoría conserva el histórico | Jefe emisora / E2 |
| EM-PA-06 | ¿El `realizador_externo` necesita cuenta con MFA o identidad temporal sin MFA? | Identidad temporal con `valid_until` y MFA según política vigente para temporales | Rol B / E2 |
| EM-PA-07 | ¿Qué entidades de Sayco/Acinpro y plazos de reporte aplican? (M4: la "tabla de parámetros" debe estar modelada) | Se modela `emisora.parametro_reporte` (`entidad`, `periodicidad`, `dia_limite`, `activo`) en `0003_create_emisora_reporting.ts`; entidad por defecto `sayco`, periodicidad mensual | Jefe emisora / E4 |
| EM-PA-08 | ¿Se acepta insertar filas de plantillas de notificación en `public` (B5) o debe hacerse un registro local en emisora? | **Valor por defecto:** migración aditiva `public/0009` + EL-4. Alternativa: `emisora.plantilla_notificacion_emisora` con un puerto nuevo en Notificaciones, si el equipo prefiere cero escrituras en `public` | Equipo / E1 |
| EM-PA-09 | ¿Zona horaria y límites inclusivos de los plazos del manual? (I7) | `America/Bogota`; 3 semanas y 2 días en días calendario, ambos límites inclusivos; oct/nov sobre `date` (§4.4) | Jefe emisora + Rol B / E0 |
| EM-PA-10 | ¿Límites concretos para el audio de emisora? (I8/M6) | `EMISORA_MAX_AUDIO_BYTES` con valor por defecto explícito en `.env.example`; MIME restringido a `audio/mpeg`, `audio/wav`, `audio/ogg`. Se confirma con el proveedor de almacenamiento antes de E2 | Rol B / E1 |

---

## 16. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Romper la matriz de autorización al añadir perfiles/operaciones | Alto | Actualizar `EXPECTED_OPERATIONS` y la expectativa de perfiles en la misma fase; ejecutar `pnpm test` antes y después |
| Deriva OpenAPI ↔ cliente ↔ eventos | Alto | Regenerar contratos en cada fase; `contracts:validate` y `test:contracts` bloquean el PR |
| Violación de aislamiento por importar academic/identity desde emisora | Alto | Tokens en `shared/integration`; `arch:check` automático por descubrimiento de contextos |
| Cambiar accidentalmente la política de archivos existente | Medio | Política `emisora-audio` opt-in; prueba de regresión de `file-policy.spec.ts` |
| Convertir el módulo en contabilidad/pagos | Alto | Prohibición explícita en P7; solo referencias y estados; checklist anti-deriva |
| PII de realizadores en auditoría | Alto | Redacción por lista blanca; prueba de grep de secretos/PII; cifrado e índice ciego |
| Carga de audio exceda límites existentes | Medio | Límite propio por política opt-in, deduplicación por hash y almacenamiento fuera de la BD |
| Plazos del manual (3 semanas, 2 días, oct/nov) mal interpretados | Medio | Reglas en dominio con pruebas de límites (día exacto, inclusive/exclusive documentado) |
| Extensión SPA acoplada al shell | Medio | Subrouter aislado, mismo tema, sin estilos propios; rutas protegidas por permiso |

---

## 17. Checklist de "no romper lo que ya funciona"

1. `git diff` de archivos existentes contiene **solo** las entradas aditivas listadas en §3.
2. `public-routes.json` sin cambios; ninguna operación emisora es pública.
3. Ninguna migración **existente** de `public`/`academic` modificada; las migraciones de `emisora` solo crean objetos en `emisora`. La única excepción declarada es `public/0009`, que inserta filas nuevas de plantilla y está listada en §3 (fila 22) y §11.
4. Ningún permiso existente eliminado ni renombrado; `administrador` solo gana permisos, y `PERMISSION_CATALOG` pasa de 37 a `37+N` (EL-1).
5. Ningún endpoint existente cambia de ruta, método, `operationId`, esquema ni código de error; `POST /api/v1/files` conserva su política y su límite.
6. Ninguna prueba existente desactivada o relajada; las **siete** expectativas exactas EL-1…EL-7 actualizadas deliberadamente en el mismo PR.
7. `pnpm arch:check` y `pnpm test:architecture` en verde con el contexto nuevo descubierto; emisora no importa `identity`/`academic` ni lee `public`.
8. La SPA sin permisos emisora muestra exactamente el menú y las rutas de antes.
9. `pnpm contracts:generate` no produce cambios en operaciones preexistentes; la base del catálogo sigue en 62 eventos y solo crece la enmienda (EL-3).
10. `00-roles.sql` crea y grants el esquema `emisora` antes de cualquier `migrate:up`; `migrate:status emisora` lista las cuatro migraciones.
11. Las tres políticas ("default", `emisora-audio`, exportaciones) tienen prueba de no regresión: la lista blanca y `MAX_FILE_BYTES` originales quedan intactos.
12. Los documentos generados por emisora registran tanto su evento de dominio como `reporte.generado`; no se asume que este último es el único evento.
13. Regresión completa en verde (§12) antes de cada compuerta, incluido el job de E2E una vez añadido a CI.

---

## 18. Revisión independiente

### 18.1 Ejecución

- **Revisor:** subagente independiente `general`, modo **solo lectura**; no modificó archivos ni ejecutó commit/push.
- **Entrada:** plan v0.1 + repositorio `main` (`116d414`), contrastados contra código, contratos, pruebas y CI.
- **Veredicto del revisor sobre v0.1:** **con huecos bloqueantes** — 5 bloqueantes, 12 importantes, 6 menores.
- **Veredicto sobre v0.2:** los 23 hallazgos están **cerrados o convertidos en decisión explícita con valor por defecto** en las secciones anteriores. Quedan EM-PA-08/09/10 como decisiones de equipo con valor por defecto operativo, no como bloqueos de diseño.

### 18.2 Hallazgos bloqueantes (cerrados)

| ID | Hallazgo (evidencia) | Resolución en v0.2 |
|---|---|---|
| **B1** | `perfiles.spec.ts:31-33` exige `PERMISSION_CATALOG.size === 37`; añadir permisos rompe `pnpm test` | §3 fila 9 / EL-1: recuento actualizado a `37+N` en el mismo PR; lógica de la prueba intacta |
| **B2** | `contract.test.mjs:173-198` fija 62 eventos base, 64 merged y `amendments === ['cambio-eventos-c6.md']` | §3 fila 15 / EL-3: base se mantiene en 62 (los eventos emisora van solo en la enmienda), merged pasa a `64+N`, `amendments` con dos entradas |
| **B3** | `00-roles.sql:58-79` solo crea/grants `public` y `academic`; CI lo ejecuta en `.github/workflows/ci.yml:160-161` | §3 fila 5: bloque aditivo para `emisora` con esquema, `GRANT`s y `ALTER DEFAULT PRIVILEGES`; §11 lo exige antes del primer `migrate:up` |
| **B4** | `file-policy.ts:10-26`, `file.service.ts:65`, `files.controller.ts:47` impiden MIME y tamaño de audio, contradiciendo la "política opt-in" del plan | §3 filas 13-14, §7: parámetro opcional `politica` con valor por defecto idéntico, `file-policy-emisora.ts`, `EMISORA_MAX_AUDIO_BYTES` y endpoint nuevo de emisora; `POST /api/v1/files` sin cambios |
| **B5** | `migrator.spec.ts:270-286,380-384` espera exactamente 22 plantillas en `public`; el plan no daba ruta para las nuevas | §3 filas 22-23 / EL-4, §11: migración aditiva `public/0009`, `down` por código y recuento ampliado a `22+M`; alternativa registrada como EM-PA-08 |

### 18.3 Hallazgos importantes (cerrados)

| ID | Hallazgo | Resolución |
|---|---|---|
| I1 | Rutas de migración contradictorias | §11: `apps/api/src/database/migrations/emisora/`; se descarta `database/migrator/migrations/...` |
| I2 | `migrate.ts` y `docs/runbook/migraciones.md` solo nombran `public`/`academic` | §3 filas 3-4 y §11: mensajes y runbook ampliados |
| I3 | Doble fuente de verdad para perfiles (`PROFILE_SEEDS` vs `seedEmisora`) | §5.2 y §11: perfiles solo en `PROFILE_SEEDS`; `seedEmisora` únicamente datos de negocio; `seeds/run.ts` añadido a puntos de contacto |
| I4 | `identity-directory.port.ts` sin decidir; leer `public` chocaba con P3 | §2.2: proveedor `IdentityDirectory` exportado por `identity`, simétrico a `FormacionDirectory` |
| I5 | `exports.service.ts:175-205` siempre audita `reporte.generado` | §6.5 y §7: no se modifica; emisora emite además su evento de dominio y el contrato documenta ambos |
| I6 | `audit-redactor.ts` redacta por clave y trunca a 8 KB | §6.2 y §4.3: payload con claves permitidas, `SECRET_KEYS` ampliado, soportes como `archivo_id`+hash |
| I7 | Sin zona horaria ni límites inclusivos | §4.4: `America/Bogota`, `timestamptz` vs `date`, 3 semanas/2 días/oct-nov inclusivos, concurrencia con `FOR UPDATE` |
| I8 | `e2e/fixtures.ts:9-17` solo cuatro perfiles; CI no corre E2E ni k6 | §3 filas 30-31, §12: fixtures ampliadas, job de E2E en CI, k6 como compuerta manual |
| I9 | `notification-policy.spec.ts:41-47` fija `CRITICAL_EVENT_PREFIXES` | §3 filas 20-21 / EL-6 y §7: prefijos emisora añadidos y expectativa resincronizada |
| I10 | `client-contract.test.mjs:147-189` exige shapes exactos y `OPERACIONES_NO_CONSUMIDAS` | §3 filas 26-27 / EL-7 y §9: paridad de query/body/multipart y conjunto de operaciones sin UI |
| I11 | Eventos de §14 ausentes en §6 | §6.1: lista cerrada de 38 eventos que incluye `realizador.notificado`, `informe.recibido`, `turno.asignado`, `actividad.registrada`, `permiso.emitido` y los nuevos `asistencia.registrada`, `bitacora.registrada`, etc. |
| I12 | `authorization-matrix.spec.ts:354-381` exige caso permitido y denegado para `scope: global` | §3 fila 25 / EL-5 y §5.2: se generan ambos casos para cada operación emisora |

### 18.4 Hallazgos menores (cerrados)

| ID | Hallazgo | Resolución |
|---|---|---|
| M1 | `asistencia-cabina` ausente en el catálogo de recursos | §5.1: añadido |
| M2 | `EM-D-01` mal referido en §4.3 (debía ser `EM-D-03`) | §4.3: corregido |
| M3 | `catalog.mjs:15` no acepta guiones en eventos | §5.1 y §3 fila 34: eventos con un solo punto y sin guiones; se advierte que tampoco admiten dos puntos |
| M4 | EM-PA-07 proponía tabla de parámetros no modelada | §15.2: `emisora.parametro_reporte` modelada en la migración `0003` |
| M5 | Entrada de notificaciones en §3 sin archivos concretos | §3 filas 20-23: `notification-policy.ts`, su `.spec.ts` y `0009_...ts` |
| M6 | Sin verificación de `idempotency store` ni `AuditWriter` | §6.6: comprobación de firmas/semántica antes de E1; EM-PA-10 para límites de audio |

### 18.5 Aspectos validados como correctos por el revisor

- Descubrimiento automático de contextos en `.dependency-cruiser.mjs` (sin editar la configuración).
- Advertencia sobre `manage`/catálogo en `permissions.ts`.
- Uso de `MIGRATION_SCHEMAS` como punto de extensión.
- `public-routes.json` sin cambios y ninguna operación emisora pública.
- Reutilización de `AuditWriter` y del modelo de auditoría inmutable.
- Convenciones de API (`ApiContract`, Problem Details, paginación, `operationId`).
- Reutilización de tema/componentes del shell y subrouter de extensión.
- Prohibición de lógica de pagos/integración financiera.

### 18.6 Archivos existentes añadidos a la tabla de puntos de contacto

`perfiles.spec.ts`, `contract.test.mjs`, `00-roles.sql`, `.github/workflows/ci.yml`, `migrator.spec.ts`, `identity-flow.spec.ts`, `notification-policy.ts`, `notification-policy.spec.ts`, `file.service.ts`, `env.ts`, `.env.example`, `identity.module.ts`, `migrate.ts`, `docs/runbook/migraciones.md`, `audit-redactor.ts`, `client-contract.test.mjs`, `e2e/fixtures.ts`, `apps/api/src/database/seeds/run.ts`. Todos aparecen ahora en §3 con su cambio concreto y su verificación.

---

## 19. Inventario de implementación del slice E3 (patrocinios, promos y transmisiones)

Este apartado cierra el inventario pendiente de §§4.1, 4.2, 13 y 14 y fija la
correspondencia exacta entre las tablas ya creadas por
`apps/api/src/database/migrations/emisora/0002_create_emisora_operation.ts` y los
casos de uso que se añaden en E3. No modifica ninguna migración existente ni
ningún documento congelado: todas las tablas y enums ya están desplegados desde
E1; E3 solo los consume.

### 19.1 Tablas de `0002` consumidas en E3

| Tabla | Columnas relevantes | Restricción que se refuerza en dominio | RF |
| --- | --- | --- | --- |
| `emisora.resolucion_incentivo` | `incentivo_id`, `pdf_archivo_id`, `referencia_cdp`, `emitida_en` | `unique(incentivo_id)`: una resolución por incentivo | RF-03.7 |
| `emisora.patrocinio` | `nombre`, `entidad`, `estado`, `fecha_inicio`, `fecha_fin`, `contrato_archivo_id`, `deleted_at` | `fecha_fin >= fecha_inicio`; el acta de aprobación exige contrato PDF limpio | RF-04 |
| `emisora.promo` | `patrocinio_id`, `nombre`, `guion`, `duracion_segundos`, `audio_archivo_id`, `estado` | `duracion_segundos > 0`; `borrador → producida` exige audio | RF-05 |
| `emisora.orden_emision` | `promo_id`, `programacion_item_id`, `estado`, `fecha_emision`, `emitida_en` | `borrador → programada → emitida`; la promo debe estar `producida` | RF-04.3 |
| `emisora.publicacion` | `promo_id`, `canal`, `fecha_publicacion`, `estado`, `archivo_id` | `programada → publicada` | RF-05 |
| `emisora.transmision` | `programacion_item_id`, `fecha_transmision`, `es_fuera_ciudad`, `destino`, `estado`, `autorizada_por`, `autorizada_en` | `programada → autorizada` exige salida de equipo y reporte de desplazamiento | RF-06 |
| `emisora.salida_equipo` | `transmision_id`, `equipo_id`, `responsable_id`, `fecha_salida`, `fecha_devolucion` | `fecha_devolucion >= fecha_salida` | RF-06.2 |
| `emisora.reporte_desplazamiento` | `transmision_id`, `conductor_id`, `vehiculo`, `hora_salida`, `hora_llegada`, `novedades` | `hora_llegada >= hora_salida` | RF-06.3 |
| `emisora.prestamo_mifi` | `transmision_id`, `usuario_id`, `fecha_solicitud`, `fecha_transmision`, `estado` | `(fecha_solicitud at time zone 'America/Bogota')::date <= fecha_transmision - 2` | RF-06.5 |
| `emisora.viatico` | `transmision_id`, `usuario_id`, `estado`, `referencia_compromiso`, `referencia_orden`, `soporte_archivo_id` | solo se crea si `transmision.es_fuera_ciudad = true`; sin importes | RF-06.6 |

### 19.2 Reglas de negocio añadidas a §4.2

1. **RF-03.7.** `POST /emisora/resoluciones` solo acepta un incentivo en estado
   `resuelto` con `referencia_cdp`. Genera el PDF mediante la plantilla
   `emisora-resolucion-incentivos` del contexto Exportaciones (sin llamar a
   SIIF) y persiste el `archivo_id` devuelto en `resolucion_incentivo`.
   El evento `resolucion.generada` **ya se emite en E2** al transicionar el
   incentivo a `resuelto`; la creación del PDF registra la misma acción en
   auditoría y añade `reporte.generado` desde Exportaciones, pero **no publica
   una segunda vez** `resolucion.generada`. Así EM-12 queda cubierto sin
   duplicar el aviso al realizador.
2. **RF-04.** Un patrocinio se crea en `propuesto`; `aprobado` exige contrato PDF
   limpio verificado por `FILE_DIRECTORY` y emite `patrocinio.aprobado`.
   `rechazado` no emite evento de dominio.
3. **RF-05.** Una promo `producida` exige audio limpio y emite `promo.producida`.
   La orden de emisión referencia esa promo y, cuando existe, la franja de
   programación; `emitida` emite `orden.emitida`. Una publicación se registra en
   `programada` y `publicada` emite `publicacion.realizada`.
4. **RF-06.** `autorizar` una transmisión requiere al menos una
   `salida_equipo` y un `reporte_desplazamiento`; emite
   `transmision.autorizada`, prefijo crítico de la política de notificaciones
   (§6.1). El préstamo de mifi valida en dominio la antelación de dos días
   calendario en `America/Bogota` antes de escribir, con la restricción SQL como
   red de seguridad, y `autorizado` emite `prestamo.autorizado`. El viático se
   rechaza con `EMISORA_VIATICO_NO_FUERA_CIUDAD` si la transmisión no es fuera
   de la ciudad y su creación emite `viatico.solicitado`.
5. **Concurrencia.** Todas las transiciones E3 leen y validan el estado dentro
   de `EmisoraUnitOfWork`, y el `UPDATE` filtra por el estado de origen
   (`WHERE estado = $from`), igual que el fix de E2. Un cambio concurrente
   devuelve 409 `INVALID_STATE_TRANSITION`, nunca 500.

### 19.3 Operaciones E3 y trazabilidad

| Operación | Permiso | Evento de dominio | RF / matriz |
| --- | --- | --- | --- |
| `POST /emisora/resoluciones` | `emisora:resolucion:create` | auditoría `resolucion.generada` + `reporte.generado` (sin duplicar outbox) | RF-03.7 / EM-12 |
| `GET /emisora/resoluciones/{id}/pdf` | `emisora:resolucion:read` | — | RF-03.7 / EM-34 |
| `POST /emisora/patrocinios`, `PATCH /emisora/patrocinios/{id}/transitions` | `emisora:patrocinio:create/update` | `patrocinio.aprobado` | RF-04 / EM-13 |
| `POST /emisora/promos`, `PATCH /emisora/promos/{id}/transitions` | `emisora:promo:create/update` | `promo.producida` | RF-05 / EM-14 |
| `POST /emisora/ordenes-emision`, `PATCH /emisora/ordenes-emision/{id}/transitions` | `emisora:patrocinio:create/update` | `orden.emitida` | RF-04.3 |
| `POST /emisora/publicaciones`, `PATCH /emisora/publicaciones/{id}/transitions` | `emisora:publicacion:create/update` | `publicacion.realizada` | RF-05 / EM-15 |
| `POST /emisora/transmisiones`, `PATCH /emisora/transmisiones/{id}/transitions` | `emisora:transmision:create/update` | `transmision.autorizada` | RF-06 / EM-16 |
| `POST /emisora/salidas-equipo`, `POST /emisora/reportes-desplazamiento` | `emisora:transmision:create` | — | RF-06.2/06.3 |
| `POST /emisora/prestamos-mifi`, `PATCH /emisora/prestamos-mifi/{id}/transitions` | `emisora:prestamo:create/update` | `prestamo.autorizado` | RF-06.5 / EM-18 |
| `POST /emisora/viaticos` | `emisora:viatico:create` | `viatico.solicitado` | RF-06.6 / EM-17 |

Todas son `x-access=permission`, `x-scope=global` y mantienen `public-routes.json`
intacto. Los perfiles `jefe_emisora`, `tecnico_emision`, `contratista_prensa` y
`secretario_cultura` conservan los casos permitidos de la matriz §3; E3 añade a
`tecnico_emision` solo `emisora:prestamo:create`/`update`, necesario para EM-18.

### 19.4 Compuerta específica de E3

Además de la regresión de §12, E3 verifica: (a) el PDF de la resolución se
descarga por `GET /files/{id}/download` con el permiso existente de Archivos;
(b) dos solicitudes de mifi con menos de dos días de antelación fallan con
`EMISORA_MIFI_ANTELACION_INSUFICIENTE`, tanto en dominio como en la restricción
SQL; (c) un viático sobre transmisión dentro de la ciudad falla con
`EMISORA_VIATICO_NO_FUERA_CIUDAD`; (d) la autorización de transmisión sin
soportes falla con `EMISORA_TRANSMISION_SIN_SOPORTES`; (e) la creación de la
resolución no añade un segundo evento `resolucion.generada` a la outbox; y (f)
los eventos nuevos ya presentes en el catálogo (101) no se duplican al regenerar
`events.json`.

La comprobación de resolución previa se ejecuta dentro de
`runIdempotentCreate`: un replay con la misma clave devuelve la respuesta 201
cacheada sin regenerar el PDF, y la restricción única de
`resolucion_incentivo` se traduce a `409 EMISORA_RESOLUCION_YA_EXISTENTE` si dos
claves distintas compiten.

Las acciones de auditoría de creación y rechazo (`patrocinio.propuesto`,
`patrocinio.rechazado`, `orden.creada`, `orden.programada`, etc.) cumplen la
gramática `recurso.accion`, pero no se publican en la outbox: el catálogo de
eventos queda intacto. La descarga del PDF se hace con el cliente autenticado
(token en memoria), no con un enlace plano que recibiría un 401.

---

## 20. Inventario y compuerta del slice E4

### 20.1 Alcance

E4 cierra RF-07…RF-12 sin tocar migraciones ni contratos congelados: las
19 tablas de `0003_create_emisora_reporting.ts` y sus tipos en `schema.ts` ya
están migrados desde E1. Se añaden estados/tipos al dominio, métodos al puerto
y al repositorio Kysely, un servicio de gestión, controladores/DTOs, el
adaptador de exportaciones, la página `/emisora/operacion-e4` y pruebas. No se
modifican permisos existentes: E4 solo consume el catálogo cerrado ya declarado
(`turno`, `lectura`, `bitacora`, `obra`, `derecho`, `equipo`, `inversion`,
`proyeccion`, `actividad`, `permiso-salida`, `tramite`, `planilla`,
`archivo-emisora`). Todos los eventos que emite ya están en `events.json` (101).

### 20.2 Reglas implementadas

1. **RF-07.** Un turno va `planificado → confirmado → realizado`; la lectura
   técnica es única por (`transmisor_id`, `fecha`) y un duplicado devuelve
   `409 EMISORA_LECTURA_DUPLICADA` (también ante carrera, vía `23505`). La
   bitácora guarda `actor_id` y `request_id` del contexto autenticado.
2. **RF-08.** La obra exige título, compositor/autor, duración positiva y fecha
   de inclusión. El reporte agrupa obras por entidad (`sayco`/`acinpro`) y
   periodo, valida `fecha_fin >= fecha_inicio` y genera PDF con la plantilla
   `emisora-reporte-obras` (Idempotency-Key obligatoria). El pago de derechos
   es solo trazabilidad: soporte PDF limpio + referencia + estado; sin importes
   ni ejecución.
3. **RF-09.** Hoja de vida por número de serie único; actualización tecnológica
   `solicitada → aprobada|rechazada → implementada`, con soporte opcional;
   proyección anual única por año (`borrador → aprobada`); seguimiento de
   inversión `proyectada → aprobada → en_seguimiento → cerrada` con referencia
   de contrato, sin contabilidad; versión de software y asignación de equipo
   como registros de trazabilidad.
4. **RF-10/11.** La actividad cultural se registra con fecha y responsable; el
   permiso de gobierno exige oficio PDF limpio generado con
   `emisora-oficio-salida`. El archivo de emisora guarda solo metadatos y
   valida contra `FILE_DIRECTORY` que el binario exista, esté limpio y tenga
   MIME compatible con el tipo; `tipo = audio` publica `audio.archivado`. La
   planilla es única por fecha, se genera con `emisora-planilla-emision` y
   `registrada` publica `planilla.registrada`.
5. **RF-12.** El trámite nace `radicado` (Idempotency-Key obligatoria) y sigue
   `en_tramite → respondido → archivado`; cada soporte exige archivo limpio y
   emite `soporte.adjuntado`. El `destino` es un enum cerrado.
6. **Transiciones.** Igual que E2/E3: se validan en dominio dentro de la UoW y
   el `UPDATE` filtra por el estado de origen; un conflicto concurrente es
   409 `INVALID_STATE_TRANSITION`, nunca 500.

### 20.3 Operaciones E4 y trazabilidad

| Operación | Permiso | Evento de dominio | RF |
| --- | --- | --- | --- |
| `POST /emisora/turnos`, `PATCH /emisora/turnos/{id}/transitions` | `emisora:turno:create/update` | `turno.asignado` | RF-07.1 |
| `POST /emisora/lecturas`, `GET /emisora/lecturas` | `emisora:lectura:create/read` | `lectura.registrada` | RF-07.2 |
| `POST /emisora/bitacoras` | `emisora:bitacora:create` | `bitacora.registrada` | RF-07.3 |
| `POST /emisora/obras`, `GET /emisora/obras` | `emisora:obra:create/read` | `obra.incluida` | RF-08.1 |
| `POST /emisora/reportes-obras` | `emisora:derecho:create` | `reporte_obra.generado` + `reporte.generado` (Exportaciones) | RF-08.2 |
| `POST /emisora/pagos-derechos` | `emisora:derecho:create` | `pago.registrado` | RF-08.3 |
| `POST /emisora/equipos`, `PATCH /emisora/equipos/{id}/estado`, `POST /emisora/versiones-software`, `POST /emisora/asignaciones-equipo` | `emisora:equipo:create/update` | `equipo.actualizado` | RF-09.1/09.2/09.4 |
| `POST /emisora/actualizaciones-tecnologicas`, `PATCH /emisora/actualizaciones-tecnologicas/{id}/transitions` | `emisora:equipo:create/update` | `equipo.actualizado` | RF-09.2 |
| `POST /emisora/proyecciones`, `PATCH /emisora/proyecciones/{id}/transitions` | `emisora:proyeccion:create/update` | `proyeccion.generada` | RF-09.3 |
| `POST /emisora/inversiones`, `PATCH /emisora/inversiones/{id}/transitions` | `emisora:inversion:create/update` | `inversion.registrada` | RF-09.3 |
| `POST /emisora/actividades`, `GET /emisora/actividades` | `emisora:actividad:create/read` | `actividad.registrada` | RF-10.1 |
| `POST /emisora/permisos-salida` | `emisora:permiso-salida:create` | `permiso.emitido` | RF-10.2 |
| `POST /emisora/archivos-emisora` | `emisora:archivo-emisora:create` | `audio.archivado` (solo `tipo=audio`) | RF-11.1 |
| `POST /emisora/planillas-emision` | `emisora:planilla:create` | `planilla.registrada` | RF-11.2 |
| `POST /emisora/tramites`, `GET /emisora/tramites`, `POST /emisora/tramites/{id}/soportes`, `PATCH /emisora/tramites/{id}/transitions` | `emisora:tramite:create/read/update` | `tramite.radicado`, `soporte.adjuntado` | RF-12.1/12.2 |

Todas son `x-access=permission`, `x-scope=global` y mantienen
`public-routes.json` y `events.json` byte-idénticos. La matriz ejecutable añade
los `operationId` nuevos sin cambiar ningún permiso ni perfil existente: el
perfil `jefe_emisora` (`emisora:*:manage`) da el caso permitido y los perfiles
sin esos recursos dan el denegado exigido para `scope: global`.

### 20.4 Compuerta específica de E4

Además de la regresión de §12, E4 verifica: (a) dos lecturas del mismo
transmisor y fecha fallan con `EMISORA_LECTURA_DUPLICADA` (dominio y `23505`);
(b) un pago sin soporte PDF limpio y un permiso sin oficio PDF limpio se
rechazan; (c) el reporte de obras y la planilla generan PDF por Exportaciones
con clave de idempotencia propia, sin duplicar `reporte.generado` en la outbox
de emisora; (d) las transiciones de trámite, proyección e inversión son
unidireccionales y un segundo intento devuelve 409; (e) el archivo de emisora
rechaza un `archivo_id` inexistente o no limpio; (f) los 101 eventos del
catálogo no se duplican al regenerar contratos y las operaciones nuevas son
estrictamente aditivas frente a `7a2d2df`.

## 21. Inventario y cierre del slice E5 (endurecimiento y aceptación)

E5 no añade operaciones, tablas ni permisos. Cierra las preguntas EM-PA-01…EM-PA-10, verifica la cobertura de CI y deja documentadas la compuerta manual de carga y la trazabilidad completa. Es el último slice del plan.

### 21.1 CI E2E: verificación, no duplicación

El punto de contacto 31 de §3 se escribió partiendo de que `.github/workflows/ci.yml` solo tenía el job `integration`. La comprobación en E5 muestra lo contrario: el job `e2e` existe desde E0 y, tras instalar dependencias, aplica `pnpm migrate:up`, ejecuta `pnpm --filter @ccltpg/api db:seed`, instala Chromium, levanta API y SPA y corre `pnpm test:e2e`. Los tres recorridos de emisora (`e2e/emisora.spec.ts`: E2, E3 y E4) se ejecutan por tanto en cada push a `main`. **No se ha añadido un segundo job E2E.**

k6 **no entra en el CI estándar**: RNF-06 es una compuerta manual de aceptación y su resultado depende del entorno (200 VUs, token compartido con el limitador desactivado). Meterla en el CI añadiría ruido no determinista y competencia por recursos con las pruebas funcionales.

### 21.2 Compuerta manual de carga (RNF-06)

| Elemento | Decisión |
| --- | --- |
| Script | `k6/emisora-programacion.js` (nuevo), con atajo `pnpm load:emisora` en `package.json` |
| Escenario | `ramping-vus`: 0 → 200 en 30 s, 200 sostenidos 1 min, 200 → 0 en 30 s; 1 s de pensamiento por VU |
| Objetivo | `GET /api/v1/emisora/programacion-diaria?fecha=2026-01-19`, con token Bearer obtenido una sola vez en `setup()` |
| Umbrales | p95 < 4000 ms en la operación, `http_req_failed` < 1 % y `errores_5xx` con `count < 1` (cero 5xx) |
| Seguridad | Contraseña **solo** por `K6_PASSWORD`; el script falla en `setup()` si no está definida. Sin secretos versionados |
| Limitador | `AUTH_RATE_LIMIT_ENABLED=false` en el entorno de carga, porque el cupo `api:user` es de 300/min por `userId` y los VUs comparten token. El limitador se prueba en C2, no aquí |
| Procedimiento | `docs/runbook/emisora.md`, enlazado desde `docs/runbook/README.md` |
| Estado | **Ejecutada y superada** el 2026-11-27T09:54Z con k6 v0.54.0: 200 VUs, p95 9,82 ms, 0,00 % fallos y 0 errores 5xx |

### 21.3 Accesibilidad y responsividad

La página E4 (`apps/web/src/extensions/emisora/pages/EmisoraOperacionE4.tsx`) usa `flexWrap: 'wrap'` y anchos flexibles en las seis agrupaciones, dentro del `MainLayout` compartido. Su prueba en `apps/web/src/extensions/emisora/emisora.test.tsx` ya ejecuta `axe-core` con `color-contrast`, `aria-*`, `button-name`, `label`, `landmark-one-main`, `page-has-heading-one` y `nested-interactive` para la ruta E4 con permisos; la landing se comprueba con y sin permisos. La responsividad del shell se cubre en `apps/web/src/accessibility/responsive.test.tsx` a 360/768/1024/1440 px. No hacía falta añadir pruebas nuevas: se verifica la cobertura existente y se registra aquí.

### 21.4 Cierre de EM-PA-01…EM-PA-10

El registro normativo de los cierres está en `docs/adr/ADR-0006-emisora-decisiones-y-supuestos.md` §6. Resumen ejecutivo:

| ID | Cierre aplicado |
| --- | --- |
| EM-PA-01 | Política opt-in `emisora-audio` en Archivos; sin bucket propio |
| EM-PA-02 | Perfiles en `PROFILE_SEEDS` de identidad; `seedEmisora` solo datos de negocio |
| EM-PA-03 | 13 perfiles de emisora mapeados 1:1; sin cambios de permisos existentes |
| EM-PA-04 | Sin importes ni asientos en viáticos, incentivos ni derechos |
| EM-PA-05 | Rejilla no versionada; histórico por auditoría, sin consulta de año anterior en UI |
| EM-PA-06 | Identidad temporal con `valid_until`, MFA según política de temporales |
| EM-PA-07 | `emisora.parametro_reporte` con entidad por defecto `sayco` y periodicidad mensual |
| EM-PA-08 | Migración aditiva `public/0009_emisora_notification_templates.ts`; se conserva la alternativa documentada |
| EM-PA-09 | `America/Bogota`, días calendario inclusivos y ventana oct/nov sobre `date` |
| EM-PA-10 | `EMISORA_MAX_AUDIO_BYTES=26214400` en `.env.example`; MIME `audio/mpeg`, `audio/wav`, `audio/ogg` |

### 21.5 Trazabilidad y compuerta final

`docs/emisora-trazabilidad.md` enlaza RF-01…RF-12 y RNF-01…RNF-06 con operaciones, archivos de aplicación y pruebas. La regresión repetida en E5 queda en verde: `format:check`, `lint`, `typecheck`, 2302 tests API, 57 tests web, 60 de integración, `arch:check`, 3 de arquitectura, 16 de contratos, `contracts:generate/validate/lint` (118 operaciones, 4 públicas, 101 eventos), `build` y 23 E2E. La aditividad frente a `7a2d2df` se mantiene: +28 operaciones, 0 eliminadas, 0 modificadas, `events.json` y `public-routes.json` byte-idénticos.

**Aceptación:** funcional, contractual y operativamente completa. RNF-06 se ejecutó en compuerta manual con 200 VUs, p95 de 9,82 ms, 0,00 % de peticiones fallidas y 0 errores 5xx; 17 960 peticiones y 53 880 checks superados. El detalle y la evidencia están en `docs/emisora-trazabilidad.md` §4 y `docs/runbook/emisora.md` §6. La compuerta sigue siendo manual y fuera del CI: un cambio de entorno obliga a repetirla.
