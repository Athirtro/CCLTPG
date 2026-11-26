# Seguimiento C7 — autenticación del cliente web

- **Fecha:** 26 de noviembre de 2026
- **Estado:** fix del cliente aplicado y verificado contra la API real; **incidencia de backend pendiente**.
- **Relación:** `docs/contratos/auth-v1.md`, ADR-0002 y `docs/diseno-arquitectonico.md` §15 (token en memoria).
- **Responsables:** Rol C (cliente) y Rol A (API, corrección de la incidencia).

## 1. Fix aplicado en el cliente

El cliente generado por OpenAPI no enviaba credenciales: `login()` devolvía un token que nunca se usaba en las llamadas posteriores, por lo que `/me` respondía `401 AUTH_TOKEN_INVALID` y la SPA parecía no iniciar sesión.

| Cambio | Archivo |
| --- | --- |
| Middleware `onRequest`: `Authorization: Bearer` **solo con token completo**, `x-csrf-token` en mutaciones y `credentials: 'include'` | `apps/web/src/api/client.ts` |
| `setSessionCredentials()` en `login`, `verifyMfa` y limpieza en `logout` | `apps/web/src/contexts/AuthContext.tsx` |
| Aplicación de credenciales tras respuesta 200 de cambio de contraseña e inscripción MFA | `apps/web/src/pages/PasswordChange.tsx`, `apps/web/src/pages/MfaEnroll.tsx` |

El access token sigue **solo en memoria**; el refresh viaja en cookie `__Host-` y el CSRF se replica como cabecera. No se introduce `localStorage`. Al recargar la página se pierde la sesión en memoria y hay que volver a iniciar sesión (no hay refresh silencioso implementado).

El token **parcial** (`sessionToken`) se conserva en el estado de React, pero **nunca** se envía como Bearer: `MfaVerifyDto` lo acepta en el cuerpo y el guard prioriza la cabecera `Authorization` cuando existe, de modo que duplicarlo en ambas posiciones haría fallar la verificación MFA con `401 AUTH_TOKEN_INVALID`.

## 2. Incidencia de backend detectada durante la verificación

Los endpoints de flujo parcial llevan `@AuthenticatedOnly()` + `@PartialScopes(...)`. En `authorization.guard.ts`, esa combinación fuerza la rama Bearer (`partialOnly = false`) **si hay cabecera `Authorization`**; si no la hay, el guard lee `sessionToken` del cuerpo. Por eso el cliente no debe enviar el token parcial como Bearer.

Los DTO no son uniformes:

| Endpoint | DTO | `sessionToken` en el cuerpo | Estado |
| --- | --- | --- | --- |
| `POST /auth/mfa/verify` | `MfaVerifyDto` | Declarado (obligatorio) | ✅ Funciona por cuerpo |
| `POST /auth/mfa/enroll/confirm` | `MfaConfirmDto` | Declarado (opcional) | ✅ Funciona por cuerpo |
| `POST /auth/password` | `ChangePasswordDto` | **No declarado** (whitelist) | ❌ `400 VALIDATION_FAILED` |

Resultado: el primer acceso de una cuenta con `debe_cambiar_password=true` no puede completarse por HTTP; inscripción y verificación MFA sí. La incidencia de cambio de contraseña no tiene arreglo solo en el cliente.

### Evidencia ejecutada

| Prueba | Resultado |
| --- | --- |
| `POST /auth/login` con token parcial + `POST /auth/password` con Bearer | `401 AUTH_TOKEN_INVALID` |
| `POST /auth/password` con `sessionToken` en el cuerpo | `400 VALIDATION_FAILED` (`property sessionToken should not exist`) |
| Revisión de `authorization.guard.ts`, `MfaVerifyDto` y `MfaConfirmDto` | confirma qué flujos funcionan por cuerpo |

### Corrección propuesta para Rol A

Añadir `sessionToken?: string` a `ChangePasswordDto` con la misma validación que `MfaConfirmDto`, y añadir una prueba HTTP de integración que encadene login parcial → cambio de contraseña → sesión completa. No hace falta cambiar el guard ni los DTO de MFA.

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
| Flujo HTTP de cambio de contraseña en primer acceso | ⏳ **Pendiente de Rol A** (incidencia §2) |
| Inscripción/verificación MFA por cuerpo | ✅ Soporte verificado por DTO y guard; ⚠️ sin recorrido end-to-end con TOTP real |
| Renovación silenciosa con refresh cookie | ⏳ **Pendiente**: fuera del alcance de este fix |

Una fila ⏳ **no** cuenta como cumplida para firmar C7/C8.
