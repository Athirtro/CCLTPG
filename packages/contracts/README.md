# packages/contracts

**Propósito:** artefactos machine-readable del contrato API v1 y del catálogo de eventos de auditoría, con verificación automática en CI.

## Contenido

| Archivo | Origen | ¿Se versiona? |
| --- | --- | --- |
| `openapi.json` | Generado desde los controladores/DTOs de `apps/api` (`@nestjs/swagger`) | Sí, como artefacto generado |
| `events.json` | Generado desde `docs/contratos/modelo-auditoria-v1.md` §3 | Sí, como artefacto generado |
| `public-routes.json` | Lista blanca **manual** de rutas con `x-access=public` | Sí, revisión obligatoria |
| `spectral.yaml` | Reglas de lint del contrato | Sí, manual |
| `scripts/` | Generadores, validador y pruebas | Sí, manual |

La fuente canónica es el **código** de la API (D28 aplicado como A, pendiente de ratificación formal). Los JSON son artefactos derivados: no se editan a mano.

## Comandos

Desde la raíz:

```bash
pnpm contracts:generate   # regenera openapi.json y events.json
pnpm contracts:validate   # R-028, R-031 y allowlist pública
pnpm contracts:lint       # reglas Spectral
pnpm test:contracts       # pruebas del validador y paridad cliente ↔ contrato
```

`client-contract.test.mjs` comprueba que toda operación usada por
`apps/web/src/api/client.ts` existe en `openapi.json` y que, para esas
operaciones, los parámetros `query` y los cuerpos JSON/multipart coinciden en
ambos sentidos. El contrato puede incluir operaciones que el SPA no consume
(salud, auditoría, administración de identidad). Así una corrección "solo del
cliente" no puede divergir silenciosamente del contrato generado desde la API.

## Reglas del contrato

Toda operación debe declarar:

| Extensión | Valores | Regla |
| --- | --- | --- |
| `x-access` | `public`, `partial`, `partial_or_session`, `authenticated`, `permission` | Obligatoria |
| `x-permission` | Arreglo de permisos | Obligatorio; vacío salvo `x-access=permission` |
| `x-scope` | `global`, `own`, `group`, `mixed` | Obligatoria |
| `x-audit-event` | Evento del catálogo o `-` | Obligatoria |
| `x-partial-scope` | `mfa_verify`, `mfa_enroll`, `pwd_change` | Obligatoria si el acceso es parcial |
| `x-error-codes` | Arreglo de códigos propios | Obligatorio, aunque esté vacío |
| `x-audit-exempt` | Justificación | Obligatoria en operaciones mutantes con `x-audit-event: "-"` |

El validador comprueba además:

1. `operationId` único.
2. Que `x-audit-event` exista en el catálogo (R-031).
3. Que toda operación pública esté en `public-routes.json` y viceversa (C-14).
4. Que `events.json` no derive del catálogo documental, en ambos sentidos.
5. Que una operación no pública declare esquema de seguridad.

## Flujo en CI

```text
código (controladores + ApiContract)
  -> contracts:generate
  -> git diff --exit-code -- packages/contracts   (detecta deriva)
  -> contracts:validate
  -> contracts:lint
  -> test:contracts
```

Si un cambio añade una ruta pública, CI falla hasta que se revise y actualice `public-routes.json`. Es intencional: la lista blanca no se amplía por accidente.

## Estado actual

- 45 rutas y 54 operaciones documentadas; 28 declaran `requestBody` y 11 parámetros `query`.
- 4 operaciones públicas, todas en `public-routes.json`.
- 64 eventos en el catálogo de auditoría.
- `/metrics` no forma parte del contrato ni de la allowlist pública.

## Referencias

- `packages/contracts/openapi.json` (contrato canónico generado desde `apps/api`)
- `docs/contratos/modelo-auditoria-v1.md` (catálogo de eventos)
- `docs/contratos/matriz-autorizacion-v1.md` (R-028/R-031)
- `docs/contratos/controles-seguridad-v1.md` (C-14, C-27, C-41)
- `docs/runbook/operacion.md`
