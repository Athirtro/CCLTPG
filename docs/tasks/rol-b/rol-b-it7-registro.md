# Registro de ejecución — Iteración 7 (Rol B)

- **Fecha:** 23 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Iteración:** C7 — Accesibilidad, responsividad y cabeceras (Release 3.0)
- **Plan:** `docs/tasks/rol-b/rol-b-it7-plan.md`
- **Paquete de revisión:** `docs/reviews/c7/rol-b.md`
- **Estado:** ejecución de Rol B en curso; **sin commit, sin push, sin firma y sin publicación**.

## 1. Decisiones ratificadas

D90–D99 se ratifican el 23 de noviembre de 2026 con la opción A recomendada. Resumen operativo:

- D90: Rol B cubre cabeceras, CSP, HSTS, errores legibles y trazabilidad; no UI ni verificación manual.
- D91: PA-010 se cierra con enmienda `docs/contratos/cambios/cambio-csp-c7.md`.
- D92: C-36 se verifica con pruebas ejecutables, sin middleware nuevo.
- D93: HSTS solo en producción; escaneo TLS pendiente de preproducción.
- D94: Problem Details sin cambios de contrato; se refuerzan pruebas.
- D95: sin dependencias nuevas; `axe` en CI queda como deuda.
- D96/D97: teclado, lector de pantalla y responsividad son de Rol C; solo se referencian.
- D98: contrato estable (54/4/37/64).
- D99: C7 no se firma ni publica sin actas y evidencia completa.

## 2. Trabajo ejecutado

### RB1-61 — Baseline y plan

Plan C7 producido y ratificado; `docs/iteraciones.md` pendiente de actualizar el estado a «en ejecución» al cierre de este registro. Deuda D89 arrastrada sin reutilizarse como evidencia.

### RB1-62 — Cierre de PA-010

Enmienda controlada `docs/contratos/cambios/cambio-csp-c7.md`. `auth-v1.md` y `open-questions.md` no se editan (congelados). CSP exacta de la API: `default-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'none'`, `object-src 'none'`, `script-src 'self'`, `script-src-attr 'none'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`, `font-src 'self'`, `connect-src 'none'`, `upgrade-insecure-requests`. Sin `unsafe-eval`.

### RB1-63 — Pruebas de cabeceras

- `apps/api/src/bootstrap/configure-app.ts`: se extraen `CSP_DIRECTIVES` y `hstsOptions(isProduction)` como configuración canónica verificable.
- `apps/api/test/api/security-headers.spec.ts`: cabecera CSP completa carácter por carácter, `Permissions-Policy` exacta y ausencia de HSTS fuera de producción.
- Resultado: 8 pruebas del archivo verdes; combinado con Problem Details, 15/15.

### RB1-64 — HSTS y TLS

`hstsOptions(false) === false` y `hstsOptions(true) = { maxAge: 31536000, includeSubDomains: true, preload: true }`. No existe entorno de preproducción con TLS: el escaneo real se registra como **pendiente**, no como verificado.

### RB1-65 — Errores legibles

`apps/api/src/shared/errors/problem-details.filter.spec.ts`: el caso de error 500 ahora inyecta SQL, contraseña, `<script>` y correo en el mensaje original y comprueba que `detail` no contiene ninguno; se fijan además `title`, `requestId` (`req-3`) e `instance`. Nota: el filtro registra el error completo en logs internos (fuera de la respuesta HTTP), comportamiento preexistente no modificado.

### RB1-66 — Auditoría automatizada

No se instala `axe` ni `@axe-core/playwright`: no hay autorización de dependencia nueva. La auditoría automatizada de accesibilidad queda como deuda; no se afirma cumplimiento de CAR-11 por parte de Rol B.

### RB1-67 — Trazabilidad y paquete C7

Matriz incluida en `docs/reviews/c7/rol-b.md`, con código/prueba para C-36/C-20/C-23 y marcado pendiente de Rol C/entorno para CAR-11.

### RB1-68 — Regresión local

Ejecutada íntegramente: verde. Durante `contracts:generate` se detectó que el lector de enmiendas de `packages/contracts/scripts/lib/catalog.mjs` trataba cualquier `.md` de `docs/contratos/cambios/` como enmienda de eventos, por lo que la enmienda de CSP añadía una entrada espuria a `events.json`. Se corrigió para que solo se registren archivos que añaden eventos nuevos y se añadió una prueba de no deriva en `contract.test.mjs`. Tras regenerar, `events.json` vuelve a su estado C6 (1 enmienda, 64 eventos) y `contracts:generate` no produce cambios.

### RB1-69 — Deuda y cierre

Deuda externa y de Rol C listada en el acta; sin publicación ni firma.

## 3. Cambios en archivos

- Modificados: `apps/api/src/bootstrap/configure-app.ts`, `apps/api/test/api/security-headers.spec.ts`, `apps/api/src/shared/errors/problem-details.filter.spec.ts`, `packages/contracts/scripts/lib/catalog.mjs` y `packages/contracts/scripts/contract.test.mjs`, `docs/tasks/rol-b/rol-b-it7-plan.md`, `docs/iteraciones.md`, `docs/reviews/c6/rol-b.md`, `docs/tasks/rol-b/rol-b-it6-plan.md` (ajustes de hash C6).
- Nuevos: `docs/tasks/rol-b/rol-b-it7-registro.md`, `docs/reviews/c7/rol-b.md`, `docs/contratos/cambios/cambio-csp-c7.md`.
- Sin cambios: contratos generados, documentos congelados, UI/web, dependencias.

## 4. Evidencia de regresión

| Comando | Resultado |
| --- | --- |
| `pnpm format:check` | ✅ verde |
| `pnpm typecheck` | ✅ verde |
| `pnpm lint` | ✅ verde |
| `pnpm build` | ✅ verde |
| `pnpm test` | ✅ API 33 archivos / 420 pruebas; web 2 / 13 |
| `pnpm test:integration` (PostgreSQL 16 real) | ✅ 6 archivos / 49 pruebas |
| `pnpm arch:check` | ✅ 282 módulos, 1008 dependencias, 0 violaciones |
| `pnpm test:architecture` | ✅ 3 pruebas |
| `pnpm test:contracts` | ✅ 14 pruebas |
| `pnpm contracts:validate` | ✅ 54 operaciones, 4 públicas, 64 eventos |
| `pnpm contracts:generate` | ✅ sin deriva en `packages/contracts` |
| `pnpm contracts:lint` | ✅ 0 errores, 36 advertencias preexistentes |
| `pnpm test:security` | ✅ 6 pruebas |
| `pnpm security:secrets` | ✅ sin hallazgos |

Detalle y matriz de trazabilidad en `docs/reviews/c7/rol-b.md`.
