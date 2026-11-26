# Seguimiento C7 — autenticación del cliente web

- **Fecha:** 26 de noviembre de 2026
- **Estado:** fix del cliente aplicado y verificado contra la API real; **incidencia de backend pendiente**.
- **Relación:** `docs/contratos/auth-v1.md`, ADR-0002 y `docs/diseno-arquitectonico.md` §15 (token en memoria).
- **Responsables:** Rol C (cliente) y Rol A (API, corrección de la incidencia).

## 1. Fix aplicado en el cliente

El cliente generado por OpenAPI no enviaba credenciales: `login()` devolvía un token que nunca se usaba en las llamadas posteriores, por lo que `/me` respondía `401 AUTH_TOKEN_INVALID` y la SPA parecía no iniciar sesión.

| Cambio | Archivo |
| --- | --- |
| Middleware `onRequest`: `Authorization: Bearer`, `x-csrf-token` en mutaciones y `credentials: 'include'` | `apps/web/src/api/client.ts` |
| `setSessionCredentials()` en `login`, `verifyMfa` y limpieza en `logout` | `apps/web/src/contexts/AuthContext.tsx` |
| Aplicación de credenciales tras respuesta 200 de cambio de contraseña e inscripción MFA | `apps/web/src/pages/PasswordChange.tsx`, `apps/web/src/pages/MfaEnroll.tsx` |

El access token sigue **solo en memoria**; el refresh viaja en cookie `__Host-` y el CSRF se replica como cabecera. No se introduce `localStorage`. Al recargar la página se pierde la sesión en memoria y hay que volver a iniciar sesión (no hay refresh silencioso implementado).

## 2. Incidencia de backend detectada durante la verificación

Los endpoints de flujo parcial (`POST /auth/password`, `POST /auth/mfa/enroll`, `POST /auth/mfa/enroll/confirm`) llevan `@AuthenticatedOnly()` + `@PartialScopes(...)`. En `authorization.guard.ts`, esa combinación fuerza la rama Bearer (`partialOnly = false`), así que el `sessionToken` parcial solo se acepta como `Authorization: Bearer`. Pero:

- Como Bearer, `resolvePrincipal()` lo rechaza → `401 AUTH_TOKEN_INVALID`.
- En el cuerpo, `ChangePasswordDto` / `MfaConfirmDto` tienen whitelist y no declaran `sessionToken` → `400 VALIDATION_FAILED` (`property sessionToken should not exist`).

Resultado: el primer acceso de una cuenta con `debe_cambiar_password=true` o con inscripción MFA obligatoria no puede completarse por HTTP. No tiene arreglo solo en el cliente.

### Evidencia ejecutada

| Prueba | Resultado |
| --- | --- |
| `POST /auth/login` con token parcial + `POST /auth/password` con Bearer | `401 AUTH_TOKEN_INVALID` |
| `POST /auth/password` con `sessionToken` en el cuerpo | `400 VALIDATION_FAILED` |
| Revisión de `authorization.guard.ts` y DTOs | confirma la contradicción anterior |

### Corrección propuesta para Rol A

Alinear guard y DTO: aceptar el token parcial en el cuerpo (whitelist) **o** resolverlo como Bearer parcial antes de exigir una sesión completa. Debe cubrir `pwd_change`, `mfa_enroll` y `mfa_verify`, con prueba HTTP de integración que encadene login parcial → cambio/verificación → sesión completa.

## 3. Cuenta de demostración local

Para ver el sitio sin depender de la incidencia anterior se creó una identidad local (no versionada) con perfil `estudiante`, `mfa_habilitado=false` y `debe_cambiar_password=false`:

- `estudiante@ccltpg.org` / `LocalDemo`
- `POST /api/v1/auth/login` → `status=authenticated`, `accessToken` y `csrfToken`.
- `GET /api/v1/me` con Bearer → 200, perfil `estudiante`, 9 permisos.

La cuenta `admin@ccltpg.org` permanece con MFA obligatorio por su perfil; por eso no sirve para la demo HTTP local.

## 4. Estado de las compuertas de Rol C

| Elemento | Estado |
| --- | --- |
| Envío de Bearer/CSRF desde el cliente | ✅ Verificado contra API real y proxy de Vite |
| `lint`, `typecheck`, `format:check`, `build` | ✅ Verificados tras el fix |
| Pruebas axe (21 páginas), teclado y responsive 360/768/1024/1440 | ✅ 31/31, sin cambios funcionales |
| Flujo HTTP de cambio de contraseña / inscripción MFA | ⏳ **Pendiente de Rol A** (incidencia §2) |
| Renovación silenciosa con refresh cookie | ⏳ **Pendiente**: fuera del alcance de este fix |

Una fila ⏳ **no** cuenta como cumplida para firmar C7/C8.
