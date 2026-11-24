# Plan de trabajo — Iteración 7 (Rol B)

- **Fecha:** 22 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Iteración objetivo:** **C7 — Accesibilidad, responsividad y cabeceras (Release 3.0)**
- **Estado:** **Ejecutado por Rol B; compuerta abierta.** La orden «empieza con la iteracion 7» autorizó la ejecución de las tareas de Rol B. C7 **no se publica ni se firma**: faltan actas de TLS/auditoría y evidencia de Rol C. Registro en `docs/tasks/rol-b/rol-b-it7-registro.md` y paquete en `docs/reviews/c7/rol-b.md`.
- **Predecesor:** C6 publicada en `0ecbe32` (`iteracion 6 b`), con compuerta **no firmada**; deuda de Rol C y de entorno registrada en `docs/reviews/c6/rol-b.md`.
- **Registro predecesor:** `docs/tasks/rol-b/rol-b-it6-registro.md`.
- **Paquete de revisión anterior:** `docs/reviews/c6/rol-b.md`.
- **Paquete de revisión a producir:** `docs/reviews/c7/rol-b.md`.
- **Requisitos:** `docs/vision-alcance.md` (CAR-11, ON-1), `docs/requirements/seguridad.md` (AC-SEC-23, C-20/C-23/C-36), `docs/diseno-arquitectonico.md` (§14, §18, §19), `docs/contratos/controles-seguridad-v1.md`, `docs/contratos/auth-v1.md` §7.3 y PA-010 de `docs/open-questions.md`.
- **Contrato:** `packages/contracts/openapi.json` (54 operaciones, 4 públicas, 37 permisos, 64 eventos) y `packages/contracts/events.json`; fuente canónico code-first.
- **Regla de alcance:** Rol B trabaja solo en API, cabeceras, configuración, contrato y evidencia. No define ni implementa pantallas, cliente, foco, contraste, lectores de pantalla ni puntos de quiebre: eso pertenece a Rol C y no se detalla aquí.

## 1. Objetivo de la iteración

Preparar la parte de C7 que es responsabilidad de Rol B sin anticipar la solución de Rol C:

1. **Cerrar la deuda de cabeceras (C-36):** verificar de forma ejecutable `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, CSP sin `unsafe-eval` y HSTS en producción.
2. **Cerrar PA-010 (CSP):** fijar las directivas exactas compatibles con el frontend, sin editar documentos congelados; cualquier cambio al contrato se hace por enmienda controlada.
3. **Dejar trazabilidad CAR-11:** mapear cada criterio medible de accesibilidad/seguridad con código, prueba o acta, marcando como pendiente lo que dependa de entorno o de Rol C.
4. **No firmar C7 sin evidencia:** la compuerta queda abierta hasta que existan las actas de cabeceras/TLS, la auditoría automatizada y el recorrido manual correspondiente.

**Fuera de alcance de este plan:** UI, componentes MUI, navegación por teclado, contraste, lector de pantalla, responsive 360/768/1024/1440, regeneración del cliente y retirada de mocks (Rol C); retención/anonimización e integridad criptográfica (C8); proveedor SMTP, antimalware y k6 reales; firma, etiqueta `release-3.0-rc` o publicación de C7/C8.

### 1.1 Condición previa

C6 está publicada pero no firmada. Se arrastra explícitamente la deuda D89: RB1-43 a RB1-48, firma de C0/C1/C3/C4/C5/C6, Rol C y evidencia externa. Ninguna de esas deudas se reutiliza como evidencia de C7. Antes de ejecutar código se requiere:

- ratificación de D90–D99;
- decisión sobre PA-010 (cerrar CSP con la configuración actual o ampliar directivas por enmienda);
- autorización expresa para cualquier dependencia nueva (por ejemplo `axe`/`@axe-core/playwright`) — **sin autorización no se instala**;
- disponibilidad de preproducción con TLS para el acta C-20. Sin entorno, el criterio se marca **pendiente**, nunca verificado.

## 2. Criterios de salida y Compuerta 7

| Condición | Criterio verificable |
| --- | --- |
| Cabeceras C-36 | Prueba ejecutable que compruebe `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restringida, COOP `same-origin`, CORP `same-site` y CSP con `default-src 'none'` y sin `unsafe-eval`/`unsafe-inline`. |
| TLS/HSTS C-20 | Configuración de HSTS activa solo en producción (`max-age=31536000; includeSubDomains; preload`) con prueba de configuración; el escaneo real queda pendiente de preproducción. |
| PA-010/CSP | Decisión documentada con directivas exactas y su justificación; si afecta al contrato congelado, enmienda controlada sin tocar `auth-v1.md`. |
| Errores comprensibles (WCAG 3.3.x desde la API) | Problem Details con `code` estable, `detail` legible, `requestId` y tipo de contenido correcto; sin HTML, PII ni consultas SQL en el detalle. |
| Trazabilidad CAR-11 | Matriz requisito → código/prueba/acta en el paquete de revisión; cada criterio sin evidencia se marca pendiente. |
| Auditoría automatizada | `axe` en CI solo si se autoriza la dependencia; si no, se registra como deuda y no se afirma que C7 cumplió la auditoría. |
| Regresión | C1–C6 en verde localmente; `contracts:generate` sin deriva; sin permisos ni eventos nuevos. |
| Congelamiento | Ninguna etiqueta ni firma. `release-3.0` corresponde a la aceptación final de C8. |

Regla de bloqueo: un criterio sin evidencia enlazada en `docs/reviews/c7/rol-b.md` no se marca como cumplido. La publicación de C6 no implica aprobación de C6 ni de C7.

## 3. Alcance propuesto (tareas)

Estado actual: RB1-61 a RB1-69 **ejecutados por Rol B**; la compuerta permanece abierta por la evidencia externa y de Rol C pendiente (RB1-66/RB1-69). Numeración continua desde RB1-60.

| ID | Tarea | Estado | Entregable | Criterios que impulsa | Depende de |
| --- | --- | --- | --- | --- |
| RB1-61 | Baseline y plan C7 | ✅ | Este documento y actualización de `docs/iteraciones.md`; registro de deuda C6/D89 | Compuerta 7, D90/D99 | Orden de planificación |
| RB1-62 | Cierre de PA-010 | ✅ | `docs/contratos/cambios/cambio-csp-c7.md` con directivas exactas, `style-src` compatible y sin `unsafe-eval` | PA-010, C-36, D91 | Ratificación de D91 |
| RB1-63 | Pruebas ejecutables de cabeceras | ✅ | `CSP_DIRECTIVES` en `configureApp` y aserciones exactas en `security-headers.spec.ts` (15 pruebas verdes) | C-36, D92 | RB1-62 |
| RB1-64 | HSTS y TLS | ✅ | `hstsOptions()` con prueba de configuración; escaneo TLS real pendiente de entorno | C-20, AC-SEC-23, D93 | RB1-63 |
| RB1-65 | Errores legibles y sin PII | ✅ | `problem-details.filter.spec.ts` ampliado (sin HTML/SQL/PII en `detail`) | C-23, WCAG 3.3.1/3.3.3, D94 | RB1-63 |
| RB1-66 | Auditoría automatizada | ✅/⏳ | Evaluada: sin autorización no se instala `axe`; queda como deuda condicionada | CAR-11, D95 | Autorización de dependencia |
| RB1-67 | Trazabilidad y paquete C7 | ✅ | Matriz en `docs/reviews/c7/rol-b.md`; registro en `docs/tasks/rol-b/rol-b-it7-registro.md` | Compuerta 7, D97/D99 | RB1-61–RB1-66 |
| RB1-68 | Regresión local | ✅ | Todos los comandos verdes; `contracts:generate` sin deriva; sin cambios de contrato | C1–C6, D98 | RB1-63–RB1-65 |
| RB1-69 | Deuda y cierre | ✅/⏳ | Deuda externa y de Rol C registrada en el acta; sin publicación ni firma | D89/D99 | RB1-67 |

**Delegación a Rol C:** las actividades de accesibilidad visual, teclado, lector de pantalla, responsividad y cliente real quedan fuera de este plan; Rol B solo las referencia como dependencias y no prescribe su implementación.

**Fuera de alcance de Rol B en C7:** permisos fuera del catálogo de 37, nuevas operaciones o eventos salvo enmienda controlada, cambios en documentos congelados, y cierre de RB1-43 a RB1-48.

## 4. Decisiones propuestas para C7 (D90–D99)

**Ratificadas el 23 de noviembre de 2026** por la orden de inicio de la Iteración 7; se ejecuta la opción A recomendada en todas. No se ha modificado ningún documento congelado: PA-010 se cierra mediante `docs/contratos/cambios/cambio-csp-c7.md`.

| Decisión | Propuesta | Recomendación | Reversibilidad |
| --- | --- | --- | --- |
| D90 — Alcance | Rol B cubre cabeceras, CSP, HSTS, errores legibles y trazabilidad; UI y verificación manual quedan en Rol C | **A — fijar alcance** | Barata |
| D91 — PA-010/CSP | Mantener `default-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'none'`; documentar `style-src` requerido por MUI/emotion; si el contrato lo exige, enmienda controlada | **A — cerrar con decisión documentada** | Media |
| D92 — Cabeceras C-36 | Verificar todas las directivas con pruebas ejecutables en `configureApp`, sin añadir middleware nuevo | **A — probar lo ya implementado** | Barata |
| D93 — TLS/HSTS | HSTS solo cuando `env.isProduction`; el escaneo TLS real exige preproducción y se marca pendiente sin ella | **A — configurar y esperar entorno** | Barata |
| D94 — Errores | No cambiar el contrato: reutilizar Problem Details, reforzar pruebas de `detail` legible y sin PII/HTML/SQL | **A — reutilizar C2** | Barata |
| D95 — Auditoría axe | Solo incorporar `axe` a CI si se autoriza una dependencia nueva; mientras tanto, deuda explícita y sin afirmación de cumplimiento | **A — sin dependencias nuevas** | Barata |
| D96 — Verificación manual | Teclado y lector de pantalla son responsabilidad de Rol C/entorno; Rol B no genera esa evidencia | **A — separar responsabilidades** | Barata |
| D97 — Responsividad | Puntos de quiebre 360/768/1024/1440 se verifican en Rol C; Rol B solo referencia el criterio en la matriz | **A — no duplicar** | Barata |
| D98 — Contrato | Sin nuevas operaciones ni permisos; 54/4/37/64 se mantienen. Cualquier cambio a documentos congelados va por enmienda controlada | **A — contrato estable** | Costosa tras congelar |
| D99 — Compuerta | C7 no se firma ni se publica sin actas de cabeceras/TLS y evidencia de accesibilidad; `release-3.0` se evalúa en C8 | **A — firmar solo con evidencia** | Costosa tras etiquetar |

## 5. Operaciones, permisos y auditoría

- No se crean `operationId`, permisos ni eventos nuevos en este plan.
- Totales esperados: **54 operaciones**, **4 públicas**, **37 permisos**, **64 eventos**. Cualquier desviación se documenta antes de avanzar.
- `docs/contratos/auth-v1.md`, `modelo-auditoria-v1.md` y `api-v1.openapi.yaml` permanecen intactos; PA-010 se cierra con una decisión o, si procede, con `docs/contratos/cambios/*.md`.
- Las pruebas de cabeceras viven en la API (`apps/api/test/api/security-headers.spec.ts` y configuración de `configureApp`); no se introducen dependencias nuevas sin autorización.

## 6. Evidencia y verificación esperada

Cuando se ejecute, el registro debe enlazar:

| Comando/artefacto | Resultado esperado |
| --- | --- |
| `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm build` | verdes |
| `pnpm test`, `pnpm test:integration` (PostgreSQL real) | verdes, sin regresión frente a C6 |
| `pnpm arch:check`, `pnpm test:architecture` | 0 violaciones |
| `pnpm test:contracts`, `pnpm contracts:validate`, `pnpm contracts:generate` | 54/4/64; sin deriva en `packages/contracts` |
| `pnpm contracts:lint` | 0 errores (advertencias preexistentes documentadas) |
| `pnpm test:security`, `pnpm security:secrets` | verdes |
| Acta C-20/C-36 | cabeceras y HSTS verificados; TLS real pendiente de preproducción |
| Acta CAR-11 | auditoría axe y recorrido manual **pendientes** si no hay autorización/dependencia/entorno |

## 7. Publicación

Este plan **no autoriza** `git commit` ni `git push`. C7 no se publica ni se firma sin autorización expresa y sin las actas indicadas. C8 no se inicia. La deuda de C6 (Rol C, entorno, firma) se mantiene y no se usa como evidencia de C7.
