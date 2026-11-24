# Enmienda CAR-2026-11-23-01 — Directivas CSP exactas de la API (C7)

- **Fecha:** 23 de noviembre de 2026
- **Estado:** ratificada por la orden de inicio de la Iteración 7 (decisión D91, opción A).
- **Documento base:** `docs/contratos/auth-v1.md` §7.3 y PA-010 (congelados; **no se modifican**).
- **Motivo:** PA-010 pedía fijar en C7 las directivas CSP exactas compatibles con MUI/emotion. El valor por defecto de C1 no era ejecutable de forma inequívoca y la API solo sirve JSON; C-36 exige verificación de cabeceras.

## 1. Directivas declaradas

| Directiva | Valor exacto | Justificación |
| --- | --- | --- |
| `default-src` | `'none'` | La API no carga recursos propios por defecto. |
| `base-uri` | `'none'` | No se usa `<base>`; evita inyección de base. |
| `frame-ancestors` | `'none'` | La API no debe incrustarse. |
| `form-action` | `'none'` | La API no envía formularios HTML. |
| `object-src` | `'none'` | Sin plugins. |
| `script-src` | `'self'` | Compatible con Swagger UI en el mismo origen. |
| `script-src-attr` | `'none'` | Prohíbe manejadores inline. |
| `style-src` | `'self' 'unsafe-inline'` | Necesario para MUI/emotion (styles inyectados). |
| `img-src` | `'self' data: blob:` | Swagger y miniaturas/data URL. |
| `font-src` | `'self'` | Sin fuentes de terceros. |
| `connect-src` | `'none'` | La API no realiza conexiones desde el navegador. |
| `upgrade-insecure-requests` | (vacía) | Fuerza HTTPS en recursos incrustados. |

**Prohibido:** `unsafe-eval`. No se añaden orígenes externos ni `data:` en `script-src`.

La cabecera serializada se compone con Helmet y se comprueba carácter por carácter en
`apps/api/test/api/security-headers.spec.ts`; la configuración canónica está en
`CSP_DIRECTIVES` de `apps/api/src/bootstrap/configure-app.ts`.

## 2. Compatibilidad con el contrato base

El §7.3 de `auth-v1.md` permanecía como valor por defecto de C1 con `default-src 'self'` y
`connect-src 'self'`. Esta enmienda sustituye esos dos valores por `'none'` porque el
despliegue real de la API (JSON + Swagger local) no necesita más. El resto coincide con la
base documentada. `style-src 'self' 'unsafe-inline'` se mantiene deliberadamente: es el
mínimo compatible con MUI/emotion y su eliminación exige cambiar el frontend, fuera de Rol B.

## 3. Cierre de PA-010

PA-010 queda **cerrada en C7** para la API con el valor de esta enmienda. El seguimiento de
`style-src` en el cliente real sigue siendo responsabilidad de Rol C (no se prescribe aquí).
`docs/open-questions.md` y `docs/contratos/auth-v1.md` no se editan: la resolución se registra
en este archivo y en `docs/reviews/c7/rol-b.md`.

## Fuentes

- `docs/tasks/rol-b/rol-b-it7-plan.md` (D91, RB1-62).
- `docs/contratos/controles-seguridad-v1.md` (C-36).
- `docs/open-questions.md` (PA-010).
