# Paquete de revisión — Iteración 7 (Rol C)

- **Fecha:** 25 de noviembre de 2026
- **Iteración:** C7 — Accesibilidad, responsividad y cabeceras (Release 3.0)
- **Rol:** C — Frontend, cliente HTTP y contratos de cliente
- **Estado:** **Parte de Rol C implementada y verificada localmente; compuerta 7 no firmada ni publicada.** Faltan recorrido manual con lector de pantalla, verificación en los tres navegadores y demo con cliente real.
- **Referencias:** `docs/vision-alcance.md` (CAR-11, ON-1), `docs/diseno-arquitectonico.md` §14 y §15, `docs/reviews/c7/rol-b.md`, `docs/contratos/cambios/cambio-csp-c7.md`.
- **Predecesor:** C6 publicada en `948f07a`; la deuda de calidad heredada de Rol C (D89) se corrige en este paquete y **no** se reutiliza como evidencia de C7.

## 1. Alcance revisado

Rol C cierra la delegación de C7/C8 sobre el cliente: auditoría automatizada WCAG 2.1 AA, orden de foco por teclado, estructura para lector de pantalla, matriz responsiva en 360/768/1024/1440 px, regresiones funcionales detectadas durante la revisión y seguimiento de `style-src` en el SPA. No se evalúan TLS, HSTS ni cabeceras de la API (Rol B), ni se firma la compuerta, ni se sustituyen las actas de entorno.

El cliente sigue siendo **solo presentación**: la navegación por permisos oculta u muestra enlaces y acciones, pero la autorización real reside en la API (`/me` + guard de denegación por defecto). No se añadió ninguna comprobación de autoridad en el frontend.

## 2. Matriz CAR-11 — WCAG 2.1 AA

| Criterio | Evidencia Rol C | Estado |
| --- | --- | --- |
| Auditoría automatizada en CI | `axe-core` ya declarado en `apps/web/package.json` desde `c4c906a`; 21 páginas auditadas en `src/accessibility/a11y.test.tsx`, ejecutadas por `pnpm test` en el job `quality` de `.github/workflows/ci.yml` | ✅ Verde local; **autorización formal de la dependencia sigue siendo decisión del equipo** (D95) |
| Nombre, rol y valor de controles | Reglas `label`, `button-name`, `link-name`, `aria-*` y `aria-input-field-name`; `Select` de matrículas asociado mediante `InputLabel` + `labelId` | ✅ 21/21 páginas sin violaciones |
| Estructura semántica | Reglas `page-has-heading-one`, `heading-order`, `landmark-one-main`, `nested-interactive`; orden `h4 → h5` corregido en `Archivos.tsx` | ✅ Verificado por axe |
| Contraste y foco visible | Regla `color-contrast` habilitada + tema MUI con `CssBaseline`; estados de foco de MUI sin `outline: none` global | ✅ Automatizado; ⚠️ **revisión visual manual pendiente** |
| Recorrido con teclado | `src/accessibility/a11y.test.tsx`: `autoFocus` en correo, Tab → contraseña, Tab → botón; comprobación de nombre accesible en botones de `Login` y `VistaEducador` | ✅ Automatizado; ⚠️ recorrido completo de flujos críticos pendiente |
| Lector de pantalla | Encabezados, landmark `main`, etiquetas y nombres accesibles comprobados por axe | ⚠️ **Sin acta de NVDA/Jaws/VoiceOver** (D96): no se afirma recorrido manual ejecutado |
| Responsividad 360/768/1024/1440 | `src/accessibility/responsive.test.tsx`: drawer temporal/permanente simulado con `matchMedia` (§4) | ✅ 4/4 pruebas; ⚠️ **sin verificación en los tres navegadores** (D97) |
| Errores comprensibles desde la API | `Problem Details` de Rol B y mensajes `getErrorMessage` en el cliente | ✅ Rol B verificado; ✅ cliente muestra el `detail` sin HTML |
| Firma / etiqueta `release-3.0` | No se firma ni etiqueta | ⏳ Pendiente de aceptación final |

Una fila ⚠️ o ⏳ **no** cuenta como cumplida para firmar la compuerta.

## 3. Auditoría automatizada

`checkAccessibility()` ejecuta `axe.run` sobre el contenedor renderizado con las reglas `color-contrast`, `aria-required-attr`, `aria-allowed-attr`, `aria-input-field-name`, `button-name`, `link-name`, `image-alt`, `label`, `landmark-one-main`, `page-has-heading-one`, `tabindex` y `nested-interactive`. Cualquier violación falla la prueba e imprime la regla y el selector.

Páginas cubiertas (21): `Home`, `Login`, `MfaVerify`, `MfaEnroll`, `PasswordChange`, `Estudiantes`, `Programas`, `Grupos`, `Matriculas`, `Admin`, `Archivos`, `Notificaciones`, `Preferencias`, `Exportaciones`, `MiHorario`, `MisEvaluaciones`, `VistaEducador`, `Kpis`, `Reportes`, `Health` y `NotFound`.

Las páginas de autenticación se renderizan con un token de sesión en memoria de prueba; las páginas académicas con perfiles de estudiante, educador y administrador para ejercitar ramas con y sin permisos. Los avisos `Not implemented: HTMLCanvasElement's getContext()` de jsdom son benignos: proceden de la instrumentación de axe y no afectan al resultado.

### 3.1 Hallazgos corregidos en esta ejecución

| Hallazgo | Corrección |
| --- | --- |
| `aria-input-field-name` en `Matriculas.tsx`: el `Select` tenía un `<Box component="label">` sin asociar | `FormControl` + `InputLabel id` + `Select labelId/id/label` |
| `heading-order` en `Archivos.tsx`: `h4 → h6` sin `h5` | `h5` para «Subir archivo» |
| Prueba de teclado: `getByLabelText` no encontraba el label por el `*` de MUI | Consulta por expresión regular sobre el nombre accesible |
| Prueba responsiva: el drawer modal marca `aria-hidden` el resto de la página | Consulta del botón «Cerrar menú» con `hidden: true`, reflejando el comportamiento modal real |

## 4. Matriz de responsividad (ON-1)

`useMediaQuery(theme.breakpoints.down('md'))` con `md = 900 px` gobierna el tipo de drawer. La prueba simula `window.matchMedia` para cada ancho.

| Ancho | Drawer | Botón hamburguesa | Comprobación |
| --- | --- | --- | --- |
| 360 px | Temporal, cerrado por defecto | Sí («Abrir menú» → «Cerrar menú») | ✅ La apertura muestra «CCLTPG» y el botón de cierre |
| 768 px | Temporal, cerrado por defecto | Sí | ✅ Igual que 360 px |
| 1024 px | Permanente | No | ✅ «CCLTPG» visible sin control de menú |
| 1440 px | Permanente | No | ✅ Igual que 1024 px |

**Límite de la evidencia:** jsdom no calcula diseño real; la matriz verifica la lógica de ruptura, no desbordamientos, saltos de línea ni contraste en pantalla. La verificación en los tres navegadores del entorno de operación sigue pendiente (D97).

## 5. Teclado y lector de pantalla

### 5.1 Recorrido automatizado

| Paso | Resultado |
| --- | --- |
| Carga de `Login` | Foco en «Correo electrónico» (`autoFocus`) |
| Tab | Foco en «Contraseña» |
| Tab | Foco en «Iniciar sesión» |
| Botones de `Login` y `VistaEducador` | Todos tienen texto o `aria-label` |
| Drawer temporal | El contenido principal se marca `aria-hidden` mientras el menú modal está abierto; el cierre se comprueba por su nombre accesible |

### 5.2 Checklist pendiente de ejecución manual (D96)

No se cuenta como ejecutado. Debe realizarse sobre los flujos críticos con NVDA/Jaws/VoiceOver:

1. `Login`: el lector anuncia el nombre del campo, el estado `required`, el error en un `Alert` y el destino del botón.
2. `MiHorario` / `MisEvaluaciones`: lectura de encabezados y tablas con `scope` implícito de `TableCell`.
3. `VistaEducador`: anuncio de nombres reales y de las acciones permitidas según permiso.
4. `Notificaciones` / `Preferencias`: anuncio del cambio de estado tras activar un control.
5. Menú temporal: el foco entra al drawer, puede cerrarse con `Escape` y vuelve al control que lo abrió.

Los puntos 1–4 tienen soporte estructural verificado por axe; el punto 5 depende del comportamiento del modal de MUI y requiere comprobación en navegador real.

## 6. Sesión y permisos

- El access token de verificación MFA vive **solo en memoria** (`useState`); se eliminaron las lecturas y escrituras de `localStorage` (`docs/diseno-arquitectonico.md` §15, `docs/contratos/auth-v1.md`, ADR-0002).
- `AuthProvider` deriva usuario y permisos de `GET /me` al montar; por eso una recarga reconstruye la navegación. Las props `initialUser` / `initialSessionToken` existen únicamente para pruebas.
- `initialUser` evita la llamada real a `/me` en pruebas; sin él, `loadMe()` se ejecuta al montar. `logout()` limpia el estado local y llama a `POST /auth/logout`, tolerando errores de red.
- Se restauró la ruta `/estado` (`pages/Health.tsx`), enlazada desde `SideDrawer`; se retiró el enlace a `/registro` porque el contrato no define registro público.

## 7. Seguimiento de CSP en el cliente

La enmienda `docs/contratos/cambios/cambio-csp-c7.md` fija la CSP de la **API**. El SPA se sirve como documento HTML y necesita su propia cabecera, configurada en el servidor web/CDN de despliegue. MUI/emotion inyecta estilos en tiempo de ejecución, por lo que, mientras no se migre a nonces/hashes, esa cabecera debe mantener `style-src 'self' 'unsafe-inline'` y **nunca** `unsafe-eval`. El detalle y la condición de salida están en `docs/contratos/cambios/seguimiento-csp-cliente-c7.md`. No se modifica la enmienda ratificada ni el contrato canónico.

## 8. Demo con cliente real

**Pendiente; no se marca como ejecutada.** El guion definido para C5/C6 (`docs/tasks/rol-b/rol-b-it6-plan.md`) es: reporte → exportación → KPI → notificación → auditoría, con el cliente real contra la API y datos de prueba. Requiere entorno con PostgreSQL/Redis, credenciales de los tres perfiles y navegador; este paquete solo deja el cliente conectado y verificado con pruebas automatizadas.

## 9. Verificación ejecutada

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @ccltpg/web test` | ✅ 3 archivos, 31/31 pruebas (21 axe + 3 teclado + 4 responsive + 3 de `api/health`) |
| `pnpm format:check` | ✅ verde |
| `pnpm typecheck` | ✅ verde (API y web) |
| `pnpm lint` | ✅ verde (API y web) |
| `pnpm build` | ✅ verde (API + web; aviso de chunk > 500 kB, deuda conocida) |
| `pnpm arch:check` | ✅ 282 módulos, 1008 dependencias, 0 violaciones |
| `pnpm test:architecture` | ✅ 3/3 |
| `pnpm test:security` | ✅ 6/6 |
| `pnpm test:contracts` | ✅ 14/14 |

La regresión local no sustituye la evidencia externa: CI de GitHub (se verifica tras el push), TLS/preproducción, k6, Docker/MinIO y simulacro de respaldo/restauración.

## 10. Deuda que se arrastra

1. **D95:** `axe-core` ya está declarado y corre en CI, pero falta la autorización formal de la dependencia.
2. **D96:** recorrido manual con lector de pantalla sobre flujos críticos (§5.2).
3. **D97:** verificación responsiva en los tres navegadores del entorno de operación (§4).
4. **Demo:** recorrido reporte → exportación → KPI → notificación → auditoría con cliente real (§8).
5. **CSP cliente:** cabecera del SPA y migración futura a nonces/hashes (§7).
6. **Entorno / Rol B:** actas TLS, escaneo de entorno, simulacro de respaldo, k6 y firma de compuertas; no son responsabilidad de Rol C.
7. **C7/C8:** no se firman, no se etiqueta `release-3.0` y no se publican.

## 11. Conclusión

La parte de Rol C de C7 tiene auditoría axe sobre 21 páginas, teclado y responsividad automatizados, regresiones funcionales corregidas y trazabilidad de la sesión en memoria. **La compuerta no se cierra**: permanecen pendientes el acta manual de lector de pantalla, la verificación en navegadores reales y la demo con cliente real, además de la evidencia externa de Rol B/entorno. Este paquete no firma ni etiqueta la release.
