# Contrato de autenticación, sesión y autorización v1 (propuesta Rol B)

- **Estado:** Propuesta para **Compuerta 0** — Rol B es dueño de la semántica de autenticación y permisos; Rol C la formaliza en `packages/contracts/openapi.json`. No es vinculante hasta ratificación del equipo.
- **Fecha:** 2026-11-16
- **Alcance:** flujos de login/MFA, tokens, refresh, logout, cambio y reset de contraseña, CSRF, cabeceras, límites, bloqueo, errores estables, eventos de auditoría de identidad y contrato de `/me`.
- **Fuentes:** diseño caps. 8, 9, 11, 12, 13, 16; R-005, R-012, R-014, R-021, R-027; ADR-0001, ADR-0002; inventario Rol B (G-05, G-14, G-15).
- **Decisiones relacionadas:** D5, D10, D11, D12, D17, D20 (plan Rol B).

## 1. Principios

1. **El token no concede permisos.** El access token solo identifica usuario y sesión; los permisos se calculan en el servidor en cada solicitud a partir de perfiles vigentes.
2. **Denegación por defecto.** Solo tres rutas son públicas; toda otra ruta exige autenticación y un permiso declarado (ADR-0001).
3. **Sin enumeración de cuentas.** Un fallo de credenciales, cuenta inexistente, inactiva o bloqueada produce la misma respuesta externa.
4. **Secretos fuera del token y de los logs.** Nunca se registran contraseñas, códigos TOTP, códigos de recuperación, refresh tokens ni secretos MFA.
5. **Revocación efectiva.** Logout, reutilización de refresh, cambio de contraseña y transición de estado revocan la familia de tokens; la comprobación de estado del usuario ocurre en cada solicitud.

## 2. Artefactos de sesión

| Artefacto | Formato | Vigencia | Almacenamiento | Revocación |
| --- | --- | --- | --- | --- |
| Access token | JWT firmado `HS256` con `kid` | 15 min | Memoria del cliente; nunca `localStorage` | Denylist por `sid`/`jti` en Redis |
| Refresh token | 32 bytes aleatorios, base64url | 7 días absolutos (sin deslizamiento) | Cookie `__Host-ccltpg_rt` + hash SHA-256 en `public.refresh_token` | Rotación; revocación de familia |
| Token parcial | 32 bytes aleatorios, base64url | 5 min | Hash en Redis con `scope` y `usuario_id` | Un solo uso para `pwd_change`; intentos limitados para `mfa_verify` |
| Token CSRF | 32 bytes aleatorios, base64url | Igual que la familia | Cookie `__Host-ccltpg_csrf` (legible por JS) | Se rota en login; se borra en logout |
| Código de recuperación MFA | 10 códigos de 10 caracteres base32 | Hasta uso o regeneración | Hash Argon2id en `public.codigo_recuperacion_mfa` | Un solo uso; regenerar invalida todos |

### 2.1 Claims del access token

```json
{
  "iss": "ccltpg",
  "aud": "ccltpg-api",
  "sub": "<usuario_id>",
  "sid": "<familia_id>",
  "jti": "<uuidv7>",
  "amr": ["pwd", "totp"],
  "typ": "access",
  "iat": 1763000000,
  "exp": 1763000900
}
```

- **No** incluye email, nombre, perfiles, permisos ni PII.
- `sid` permite revocar la familia completa; `jti` permite revocar un token individual.
- Firma `HS256` con secreto de 32 bytes versionado por `kid` (rotación anual; se aceptan dos `kid` durante la transición).
- `amr` refleja el método real: `["pwd"]` sin MFA, `["pwd","totp"]` con TOTP y `["pwd","recovery"]` con código de recuperación.
- Tolerancia de reloj: 30 s.

### 2.2 Refresh token

- Registro en `public.refresh_token`: `id`, `usuario_id`, `token_hash`, `familia_id`, `expira_en`, `revocado_en`, `reemplazado_por`, `ip`, `user_agent` (modelo vigente, sin cambios).
- **Rotación estricta:** cada uso crea un hijo y marca `reemplazado_por`. Un token ya reemplazado o revocado es **reutilización**: se revoca la familia completa, se añade el `sid` a la denylist y se audita `sesion.refresh_reutilizado`.
- **Sin ventana de gracia en v1.0.** El cliente debe hacer *single-flight* del refresh y compartir el resultado entre pestañas (BroadcastChannel). Se registra PA-015 por si aparecen cierres espurios.
- La rotación se ejecuta en transacción con bloqueo de fila (`SELECT … FOR UPDATE`) para que dos refresh concurrentes no emitan dos hijos válidos.

## 3. Máquina de estados del login

```text
credenciales válidas
  ├─ debe_cambiar_password ─────────────► password_change_required (token parcial pwd_change)
  ├─ MFA requerido y sin inscribir ─────► mfa_enrollment_required (token parcial mfa_enroll)
  ├─ MFA habilitado ─────────────────────► mfa_required (token parcial mfa_verify)
  └─ resto ──────────────────────────────► authenticated (access + refresh + CSRF)
```

- **MFA requerido** si el usuario tiene perfil `administrador`, `educador` o identidad temporal. Si tiene varios perfiles y alguno lo exige, la sesión completa lo exige.
- **MFA opcional** para estudiante: si lo habilitó, es obligatorio verificarlo; si no, no se le exige.
- Tras `password_change_required`, el flujo continúa a MFA o a sesión completa sin volver a pedir credenciales.
- `debe_cambiar_password` se activa al crear usuario o al resetear contraseña por administrador.

## 4. Flujos

### 4.1 Login sin MFA

1. `POST /auth/login` con email y contraseña.
2. Se verifica Argon2id y estado del usuario; si es correcto y no requiere MFA, se emiten access, refresh y CSRF.
3. Se audita `sesion.credenciales_verificadas` y `sesion.iniciada`.
4. Si la contraseña requiere rehash por parámetros nuevos, se rehasha en el mismo paso.

### 4.2 Login con MFA

1. Credenciales correctas → `status: "mfa_required"` + `sessionToken` parcial.
2. `POST /auth/mfa/verify` con `sessionToken`, `code` y `method: "totp" | "recovery"`.
3. Código correcto → tokens completos; se audita `sesion.mfa_verificada` y `sesion.iniciada`.
4. Código incorrecto → 401 `AUTH_MFA_INVALID_CODE`; al quinto intento se invalida el token parcial y se responde 429 `AUTH_MFA_ATTEMPTS_EXCEEDED`.
5. Un código de recuperación usado se marca como consumido; reutilizarlo es 401 `AUTH_MFA_INVALID_CODE`.

### 4.3 Inscripción MFA

1. Login devuelve `mfa_enrollment_required` con token parcial `mfa_enroll` cuando el MFA es obligatorio y no está inscrito.
2. `POST /auth/mfa/enroll` devuelve `secret` y `otpauthUri` (el QR se genera en el cliente). Respuesta `Cache-Control: no-store`. Acepta el token parcial `mfa_enroll` **o** una sesión completa: un estudiante con MFA opcional puede inscribirse voluntariamente sin pasar por un estado parcial.
3. `POST /auth/mfa/enroll/confirm` con el código TOTP activa `mfa_habilitado`, devuelve tokens completos y **10 códigos de recuperación mostrados una sola vez**. Acepta las mismas credenciales que el paso 2.
4. Si el usuario abandona antes de confirmar, el secreto queda pendiente y se sobrescribe en el siguiente intento; no se habilita MFA.
5. `POST /auth/mfa/recovery-codes` (autenticado + código TOTP **o** código de recuperación válido, que se consume) regenera e invalida los códigos anteriores; se audita.

### 4.4 Refresh y reutilización

1. `POST /auth/refresh` usa la cookie `__Host-ccltpg_rt` y exige CSRF + `Origin` permitido.
2. Token válido → nuevo access + nuevo refresh (rotación) + mismo CSRF de la familia.
3. Token reemplazado/revocado → se revoca la familia, se deniega el `sid` y se responde 401 `AUTH_TOKEN_REUSED`.
4. Token expirado → 401 `AUTH_TOKEN_EXPIRED`; token malformado o con `kid` desconocido → 401 `AUTH_TOKEN_INVALID`.

### 4.5 Logout

1. `POST /auth/logout` acepta access token y/o cookie de refresh.
2. Revoca la familia, añade el `sid` a la denylist hasta el `exp` del access, borra cookies y audita `sesion.cerrada`.
3. Es **idempotente**: repetir la llamada, o llamarla sin token, responde 204 sin efecto. No se filtra si la sesión existía.

### 4.6 Cambio y reset de contraseña

| Caso | Ruta | Reglas |
| --- | --- | --- |
| Cambio propio | `POST /auth/password` con access token o token parcial `pwd_change` | Exige contraseña actual; aplica política; revoca las demás familias y conserva la actual; audita sin valores |
| Reset administrativo | `PATCH /identity/users/{id}` con `password` (write-only) y `debeCambiarPassword: true` | Exige `identity:user:manage`; revoca todas las familias; audita; la respuesta nunca devuelve la contraseña |
| Reset MFA | `PATCH /identity/users/{id}` con `resetMfa: true` | Borra secreto y códigos; obliga a reinscribir en el siguiente login; audita |

- Autoservicio de “olvidé mi contraseña” **fuera de v1.0** (PA-012); el reset es administrativo.
- No hay historial de contraseñas en v1.0 (se registra como pendiente para C8).

## 5. Autorización por solicitud

1. Se valida y decodifica el access token; se comprueba `typ`, `iss`, `aud`, `exp`, `sid` en denylist.
2. Se carga el usuario y se verifica `estado = activo` y la vigencia de sus perfiles (`valid_until` nulo o `> now()` en UTC), con caché máxima de 30 s invalidada por versión.
3. Se resuelve el permiso de la ruta y se evalúa contra la **unión** de permisos de los perfiles vigentes, expandiendo comodines e implicaciones.
4. Si el permiso es `*_own`, se resuelve la propiedad con la tabla de R-023. Si es ámbito de grupo, se comprueba la pertenencia.
5. `actor_perfil` = perfil que otorgó el permiso. `X-Perfil-Activo` (opcional) desambigua cuando varios perfiles otorgan el mismo permiso; nunca concede permisos y, si no es vigente, responde 400 `ACTIVE_PROFILE_INVALID`.
6. **Respuestas de ámbito:** permiso ausente → 403 `PERMISSION_DENIED`; permiso presente pero recurso fuera de ámbito → **404 `RESOURCE_NOT_FOUND`** (no se revela existencia); colecciones → filtradas en silencio.

### 5.1 Contrato de `/me`

```json
{
  "userId": "0193…",
  "email": "persona@ccltpg.org",
  "nombre": "Nombre Apellido",
  "estado": "activo",
  "mfaEnabled": true,
  "mustChangePassword": false,
  "profiles": [
    { "codigo": "educador", "nombre": "Educador", "validUntil": null }
  ],
  "activeProfile": "educador",
  "permissions": [
    "academic:attendance:create",
    "academic:attendance:read",
    "academic:enrollment:read",
    "academic:group:read_own",
    "academic:schedule:read_own"
  ]
}
```

- `permissions` se devuelve **expandido y concreto**: sin `*`, sin `manage`, incluyendo las variantes `_own` implicadas. Es solo para construir la interfaz; el servidor no confía en él.
- `profiles` solo incluye perfiles vigentes.
- `activeProfile` es el perfil usado para auditoría en la última resolución; `null` si el usuario no tiene perfiles vigentes.
- Orden lexicográfico determinista para permitir pruebas de contrato.

## 6. Endpoints de autenticación

| Método y ruta | Acceso | Cuerpo / cookie | Éxito | Errores principales | CSRF | Auditoría |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /auth/login` | Público | `email`, `password` | 200 `LoginResponse` (`status`) | 401 `AUTH_INVALID_CREDENTIALS`, 429 `AUTH_RATE_LIMITED` | `Origin`/`Referer` | sí |
| `POST /auth/mfa/verify` | Token parcial `mfa_verify` | `sessionToken`, `code`, `method?` | 200 `TokenResponse` | 401 `AUTH_MFA_SESSION_INVALID`, 401 `AUTH_MFA_INVALID_CODE`, 429 `AUTH_MFA_ATTEMPTS_EXCEEDED` | `Origin`/`Referer` | sí |
| `POST /auth/refresh` | Cookie `__Host-ccltpg_rt` | cookie | 200 `TokenResponse` | 401 `AUTH_TOKEN_REUSED`, 401 `AUTH_TOKEN_INVALID`, 401 `AUTH_TOKEN_EXPIRED`, 403 `AUTH_CSRF_INVALID` | cookie + header | solo reutilización |
| `POST /auth/logout` | Access y/o cookie | — | 204 siempre | — | cookie + header | sí (si revoca) |
| `GET /me` | Autenticado | — | 200 `MeResponse` | 401 | — | no |
| `POST /auth/mfa/enroll` | Token parcial `mfa_enroll` o sesión completa | — | 200 `MfaEnrollResponse` | 401 `AUTH_MFA_SESSION_INVALID`, 409 `AUTH_MFA_ALREADY_ENABLED` | `Origin`/`Referer` | sí |
| `POST /auth/mfa/enroll/confirm` | Token parcial `mfa_enroll` o sesión completa | `sessionToken?`, `code` | 200 `TokenResponse` + `recoveryCodes` | 401 `AUTH_MFA_INVALID_CODE`, 409 `AUTH_MFA_ALREADY_ENABLED` | `Origin`/`Referer` | sí |
| `POST /auth/mfa/recovery-codes` | Autenticado + TOTP o código de recuperación | `code` | 200 `RecoveryCodesResponse` | 401 `AUTH_MFA_INVALID_CODE`, 409 `AUTH_MFA_NOT_ENABLED` | sí | sí |
| `POST /auth/password` | Autenticado o `pwd_change` | `currentPassword`, `newPassword` | 200 siguiente estado / 204 | 400 `AUTH_CURRENT_PASSWORD_INVALID`, 400 `AUTH_PASSWORD_POLICY_VIOLATION`, 403 `AUTH_PASSWORD_CHANGE_REQUIRED` | sí (salvo `pwd_change`) | sí |

`LoginResponse`:

```json
{
  "status": "authenticated | password_change_required | mfa_required | mfa_enrollment_required",
  "sessionToken": "…",
  "accessToken": "…",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "csrfToken": "…",
  "mustChangePassword": false,
  "profiles": [{ "codigo": "educador", "validUntil": null }]
}
```

Campos según `status`: `sessionToken` solo en los tres estados parciales; `accessToken`, `tokenType`, `expiresIn` y `csrfToken` solo en `authenticated` (o tras completar MFA/cambio). `mustChangePassword` y `profiles` acompañan siempre.

`TokenResponse` = `accessToken`, `tokenType`, `expiresIn`, `csrfToken`, `mustChangePassword`, `profiles`.

`POST /auth/password` responde **204** cuando el cambio se hace con una sesión completa y **200** con el siguiente estado (`mfa_required`, `mfa_enrollment_required` o `authenticated`) cuando se hace con un token parcial `pwd_change`.

## 7. Cookies, CSRF, CORS y cabeceras

### 7.1 Cookies

| Cookie | Atributos | Propósito |
| --- | --- | --- |
| `__Host-ccltpg_rt` | `Secure; HttpOnly; SameSite=Strict; Path=/` (sin `Domain`) | Refresh token |
| `__Host-ccltpg_csrf` | `Secure; SameSite=Strict; Path=/` (legible por JS) | Doble envío CSRF |

El prefijo `__Host-` impide fijación desde subdominios. El refresh se envía a todas las rutas bajo el mismo host; su alcance lógico lo impone el servidor (solo `/auth/refresh` y `/auth/logout` lo consumen).

### 7.2 CSRF

- **Doble envío:** el cliente lee `__Host-ccltpg_csrf` y envía `X-CSRF-Token`; el servidor compara ambos en tiempo constante.
- Obligatorio en `POST`, `PUT`, `PATCH` y `DELETE`, incluidas `refresh`, `logout`, `mfa/recovery-codes` y `password`.
- `login`, `mfa/verify` y `mfa/enroll*` **sin sesión previa** no tienen cookie CSRF: se exige `Origin`/`Referer` permitido y `Sec-Fetch-Site: same-origin`. Con sesión completa (inscripción voluntaria), se exige además `X-CSRF-Token`.
- Faltante o inválido → 403 `AUTH_CSRF_INVALID` (no se procesa la operación).
- El token CSRF es estable durante la familia; se rota al iniciar sesión y se borra al cerrar.

### 7.3 CORS y cabeceras

- Producción **same-origin** (SPA y API bajo el mismo host). Sin CORS abierto; en desarrollo, allowlist explícita `http://localhost:5173` con `credentials: true`.
- Cabeceras base: `Strict-Transport-Security: max-age=31536000; includeSubDomains` (solo HTTPS), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Cache-Control: no-store` en respuestas de auth.
- CSP base (valores exactos en PA-010): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests`.
- TLS 1.2 o superior; redirección permanente de HTTP a HTTPS.

## 8. Límites, bloqueo y contraseñas

### 8.1 Límites por defecto (PA-009)

| Operación | Límite | Clave |
| --- | --- | --- |
| Login | 10 / 15 min | IP |
| Login | 5 / 15 min | hash de email |
| MFA verify | 5 / 5 min | token parcial |
| MFA verify | 10 / 15 min | usuario |
| Refresh | 60 / min | IP |
| Cambio de contraseña | 5 / hora | usuario |
| Códigos de recuperación | 3 / hora | usuario |
| API autenticada (general) | 300 / min | usuario |

Respuesta 429 con `Retry-After` y código `AUTH_RATE_LIMITED` en rutas de autenticación o `RATE_LIMITED` en el resto de la API.

### 8.2 Bloqueo de cuenta

- 5 fallos de contraseña en 15 min para un usuario existente → transición de sistema `activo → bloqueado`, revocación de familias y auditoría `usuario.bloqueado`.
- El login sigue respondiendo 401 `AUTH_INVALID_CREDENTIALS` (sin revelar bloqueo).
- **Desbloqueo solo por administrador** mediante `POST /identity/users/{id}/transitions { "to": "activo" }`; se audita `usuario.desbloqueado`.
- **Riesgo de bloqueo malicioso:** un tercero puede provocar el bloqueo con intentos fallidos. Se mitiga con límite por IP, alertas al administrador y desbloqueo asistido; la alternativa de auto-desbloqueo exigiría una transición adicional y se evalúa en C8 (PA-014).
- Fallos de MFA **no** bloquean la cuenta (evita denegación de servicio): invalidan el token parcial y se limitan por IP/usuario.
- Contador en Redis con TTL; no requiere columnas nuevas.

### 8.3 Política de contraseñas

- Argon2id: `m=19456 KiB`, `t=2`, `p=1`, sal de 16 bytes, hash de 32 bytes (mínimo OWASP). Formato PHC autocontenido y versionado; rehash al iniciar sesión si los parámetros suben.
- Longitud 12–128 caracteres Unicode; sin reglas de composición; bloqueo de contraseñas comunes y de la parte local del email.
- Sin rotación periódica obligatoria; cambio ante compromiso.
- Contraseña inicial y de reset: la define el administrador (campo write-only), debe cumplir la política, se fuerza `debe_cambiar_password = true` y nunca se registra ni se devuelve en la respuesta.

## 9. Errores estables de autenticación

| Código | HTTP | Cuándo | Clave de mensaje (frontend) |
| --- | --- | --- | --- |
| `AUTH_INVALID_CREDENTIALS` | 401 | Credenciales incorrectas, cuenta inexistente, inactiva o bloqueada | `errors.auth.invalidCredentials` |
| `AUTH_TOKEN_INVALID` | 401 | Token malformado, firma inválida o `kid` desconocido | `errors.auth.sessionExpired` |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token vencido | `errors.auth.sessionExpired` |
| `AUTH_TOKEN_REVOKED` | 401 | `sid`/`jti` en denylist | `errors.auth.sessionExpired` |
| `AUTH_TOKEN_REUSED` | 401 | Refresh ya reemplazado o revocado | `errors.auth.sessionExpired` |
| `AUTH_MFA_SESSION_INVALID` | 401 | Token parcial ausente, vencido o consumido | `errors.auth.mfaExpired` |
| `AUTH_MFA_INVALID_CODE` | 401 | TOTP o código de recuperación incorrecto | `errors.auth.mfaInvalid` |
| `AUTH_MFA_ATTEMPTS_EXCEEDED` | 429 | 5 intentos fallidos en el token parcial | `errors.auth.mfaBlocked` |
| `AUTH_MFA_ALREADY_ENABLED` | 409 | Se intenta inscribir MFA ya habilitado | `errors.auth.mfaEnabled` |
| `AUTH_MFA_NOT_ENABLED` | 409 | Se regeneran códigos sin MFA habilitado | `errors.auth.mfaDisabled` |
| `AUTH_PASSWORD_CHANGE_REQUIRED` | 403 | Sesión completa con `debe_cambiar_password` | `errors.auth.passwordChangeRequired` |
| `AUTH_CURRENT_PASSWORD_INVALID` | 400 | Contraseña actual incorrecta | `errors.auth.currentPassword` |
| `AUTH_PASSWORD_POLICY_VIOLATION` | 400 | No cumple longitud/lista de comunes | `errors.auth.passwordPolicy` |
| `AUTH_CSRF_INVALID` | 403 | Token CSRF ausente o no coincide | `errors.auth.csrf` |
| `AUTH_RATE_LIMITED` | 429 | Límite de tasa de autenticación excedido | `errors.auth.rateLimited` |
| `RATE_LIMITED` | 429 | Límite general de API excedido | `errors.common.rateLimited` |
| `ACTIVE_PROFILE_INVALID` | 400 | `X-Perfil-Activo` no vigente o ajeno | `errors.auth.profile` |
| `PERMISSION_DENIED` | 403 | Permiso ausente | `errors.auth.forbidden` |
| `RESOURCE_NOT_FOUND` | 404 | Recurso inexistente **o fuera de ámbito** | `errors.common.notFound` |
| `VALIDATION_FAILED` | 400 | Cuerpo/parámetros inválidos | `errors.common.validation` |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Clave de idempotencia repetida con cuerpo distinto | `errors.common.idempotency` |
| `SERVICE_UNAVAILABLE` | 503 | Dependencia de autenticación no disponible (fallo cerrado) | `errors.common.unavailable` |

**Reglas:** `ProblemDetails` con `code` estable y `requestId`; nunca se incluyen trazas, SQL, tokens ni PII en `detail`. Los códigos de autenticación se congelan en C0 junto al formato de errores.

## 10. Auditoría de identidad

| Acción | Cuándo | `datos_antes` / `datos_despues` permitidos | Redacción |
| --- | --- | --- | --- |
| `sesion.credenciales_verificadas` | Credenciales correctas antes de MFA | `amr` previsto | Sin contraseña |
| `sesion.iniciada` | Sesión completa emitida | `amr`, perfiles vigentes | Sin tokens |
| `sesion.fallida` | Credenciales incorrectas o cuenta no válida | `motivo` interno, `ip`, `user_agent` | Email como HMAC; sin contraseña |
| `sesion.mfa_verificada` | TOTP/recuperación correctos | `metodo` | Sin código ni secreto |
| `sesion.mfa_fallida` | Código incorrecto | `metodo`, número de intento | Sin código |
| `sesion.refresh_reutilizado` | Reutilización detectada | `familia_id`, `ip`, `user_agent` | Sin token |
| `sesion.cerrada` | Logout o revocación | `familia_id`, `motivo` | Sin token |
| `usuario.bloqueado` / `usuario.desbloqueado` | Transición de estado | `motivo`, `intentos` | Sin PII adicional |
| `usuario.password_cambiada` / `usuario.password_reseteada` | Cambio o reset | `sesiones_revocadas` | Sin contraseña |
| `usuario.mfa_inscrita` / `usuario.mfa_recovery_regenerada` / `usuario.mfa_recovery_usada` | Ciclo MFA | `metodo` | Sin secreto ni códigos |
| `auditoria.consultada` | Consulta de auditoría | filtros aplicados | Sin PII de terceros |

- Login exitoso con refresh: **no** se audita cada refresh (solo reutilización/revocación) para evitar ruido.
- Los eventos de fallo usan `actor_id` nulo si el usuario no existe; el email se guarda como HMAC con clave separada.
- La sesión y el `request_id` permiten correlacionar logs estructurados y trazas.

## 11. Criterios de aceptación (C2)

1. **AC-B-01:** solo `login`, `mfa/verify`, `refresh` son públicos; cualquier otra ruta sin permiso declarado responde 401/403 y existe una prueba que falla si se añade una ruta sin declaración.
2. **AC-B-02:** cada operación de la matriz tiene caso permitido y caso denegado, incluido el ámbito propio y el de grupo.
3. **AC-B-03:** el access token dura 900 s, no contiene permisos ni PII, y un `sid` revocado se rechaza en la siguiente solicitud.
4. **AC-B-04:** el refresh rota; reutilizar un token revocado revoca la familia y audita el evento.
5. **AC-B-05:** logout revoca la familia, borra cookies y es idempotente (204).
6. **AC-B-06:** MFA es obligatorio para administrador/educador/identidad temporal; la inscripción y los códigos de recuperación funcionan y son de un solo uso.
7. **AC-B-07:** 5 fallos de contraseña bloquean la cuenta; el login no revela el bloqueo; el desbloqueo administrativo se audita.
8. **AC-B-08:** toda operación mutante sin CSRF válido responde 403 `AUTH_CSRF_INVALID`.
9. **AC-B-09:** los límites devuelven 429 con `Retry-After`.
10. **AC-B-10:** Argon2id con parámetros versionados; rehash en login; política de longitud y lista de comunes.
11. **AC-B-11:** `/me` devuelve permisos expandidos solo de perfiles vigentes y flags `mfaEnabled`/`mustChangePassword`.
12. **AC-B-12:** un perfil vencido o usuario inactivo/bloqueado pierde acceso y sus familias se revocan en ≤ 30 s (o de inmediato si hay transición).
13. **AC-B-13:** el educador no accede a grupos/matrículas ajenos; colecciones filtradas, acceso directo 404.
14. **AC-B-14:** `debe_cambiar_password` bloquea todo salvo `/me`, `/auth/password`, `/auth/logout` y `/auth/refresh`.
15. **AC-B-15:** no hay contraseñas, tokens, códigos ni secretos en logs, auditoría ni respuestas de error (prueba de grep sobre fixtures).
16. **AC-B-16:** cabeceras de seguridad presentes en todas las respuestas; cookies con atributos exigidos; HTTP redirige a HTTPS.

## 12. Cambios solicitados al contrato OpenAPI (Rol C)

1. Añadir `securitySchemes.cookieAuth` (`apiKey`, cookie `__Host-ccltpg_rt`) y usarlo en `refresh`/`logout` junto con `bearerAuth`.
2. Sustituir `LoginResponse` por la unión discriminada `status` descrita en §6; completar `TokenResponse` y `MeResponse`.
3. Añadir las rutas `POST /auth/mfa/enroll`, `/auth/mfa/enroll/confirm`, `/auth/mfa/recovery-codes` y `/auth/password`, con sus esquemas.
4. Añadir respuestas 400/401/403/409/429/503 a las operaciones de autenticación, con `Retry-After` donde aplique.
5. Añadir el parámetro `X-CSRF-Token` a las operaciones mutantes y documentar la cookie CSRF.
6. Añadir `x-access` (valores `public`, `partial`, `partial_or_session`, `authenticated`, `permission`), `x-partial-scope` para los scopes parciales aceptados, `x-permission` (arreglo, semántica OR), `x-scope` (valores `global`, `own`, `group`, `mixed`) y `x-audit-event` a todas las operaciones (R-028).
7. Declarar `X-Perfil-Activo` como parámetro opcional en operaciones autenticadas.
8. Documentar la semántica 403 vs 404 y los nuevos códigos de error en `ProblemDetails` (lista `x-error-codes` o enum).

## 13. Preguntas abiertas con valor por defecto

| ID | Pregunta | Valor por defecto | Compuerta |
| --- | --- | --- | --- |
| PA-009 | Valores definitivos de throttling | Tabla de §8.1; ajustar tras prueba de carga en C5 | C3/C5 |
| PA-010 | Directivas CSP exactas (MUI/emotion) | CSP base de §7.3; revisar `style-src` en C1/C7 | C1/C7 |
| PA-011 | Plazos de retención de auditoría y PII | Auditoría ≥ 5 años; PII mientras dure la relación + plazo institucional; supresión por anonimización | C8 |
| PA-012 | Autoservicio de recuperación de contraseña | Fuera de v1.0; reset administrativo | C8 |
| PA-013 | Endpoints de horarios | Subrecurso de grupo; se definen en C4 (R-024) | C4 |
| PA-014 | Separación de funciones administrativas | Un solo perfil administrador en v1.0 con MFA, auditoría y roles de BD; revisar en C8 | C8 |
| PA-015 | Ventana de gracia para refresh | Sin gracia; cliente con *single-flight*; revisar si hay cierres espurios | C2 |

## 14. Qué no se hizo

- No se modificó el OpenAPI ni el catálogo: los cambios son solicitudes a Rol C (R-021, R-028).
- No se implementó autenticación, middleware, guard, Redis ni migraciones (C1/C2).
- No se definió el inventario de datos personales ni los plazos de retención (C8); solo valores por defecto.
