# ADR-0002 — Sesión, tokens, revocación y CSRF

- **Estado:** Aceptada por Rol B (2026-11-16); requiere ratificación del equipo en Compuerta 0 y detalle de contrato por Rol C.
- **Fecha:** 2026-11-16
- **Decisores:** Rol B (autor); Rol C (formalización OpenAPI); aprobación humana en C0.
- **Trazabilidad:** diseño caps. 8, 11, 12; R-012, R-014, R-021; D10/D12; inventario G-05, G-14, G-15; `docs/contratos/auth-v1.md`.

## Contexto

El diseño fija access token de 15 minutos, refresh rotativo de 7 días en cookie `httpOnly`, detección de reutilización y revocación de familia, MFA TOTP obligatorio para administrador/educador y CSRF de doble envío. No define formato del access token, mecanismo de revocación inmediata, contrato de sesión parcial de MFA, ni cómo se protege el refresh. La revocación debe ser efectiva cuando expira un perfil o se desactiva un usuario (R-014).

## Decisión

1. **Access token JWT `HS256` con `kid`, 15 min.** Claims mínimos: `iss`, `aud`, `sub`, `sid`, `jti`, `amr`, `typ`, `iat`, `exp`. Sin permisos ni PII. Secreto de 32 bytes en gestor de secretos, rotación anual con dos `kid` aceptados durante la transición.
2. **Refresh opaco de 32 bytes, 7 días absolutos.** Hash SHA-256 en `public.refresh_token`; cookie `__Host-ccltpg_rt` (`Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`). Rotación estricta con bloqueo de fila; reutilización → revocación de familia + denylist + auditoría.
3. **Sin ventana de gracia en v1.0.** El cliente hace *single-flight* del refresh y comparte el resultado entre pestañas; se registra PA-015 por si aparecen cierres espurios.
4. **Token parcial para MFA y cambio de contraseña.** 32 bytes, 5 min, hash en Redis, `scope` (`mfa_verify|mfa_enroll|pwd_change`), límite de intentos.
5. **Revocación inmediata por `sid`.** Logout, reutilización, cambio de contraseña y transiciones de estado añaden el `sid` a una denylist en Redis con TTL igual a la vida del access token. La comprobación de estado y vigencia de perfiles ocurre en cada solicitud (caché ≤ 30 s invalidada por versión).
6. **CSRF de doble envío.** Cookie `__Host-ccltpg_csrf` legible por JS + header `X-CSRF-Token` en toda operación mutante; `Origin`/`Referer` para login y pasos parciales sin sesión. El token es estable por familia y se rota al iniciar sesión.
7. **Fallo cerrado.** Si Redis (denylist/caché de sesión) no está disponible, las solicitudes autenticadas se rechazan con 503 `SERVICE_UNAVAILABLE` en lugar de aceptar tokens posiblemente revocados.

## Alternativas consideradas

| Alternativa | Motivo de rechazo |
| --- | --- |
| Access token opaco con introspección en BD | Latencia y carga por solicitud; el JWT corto + denylist cubre la revocación |
| JWT `RS256` | El sistema es un monolito modular; no hay consumidores externos que requieran clave pública. Reevaluar si aparece un servicio separado |
| Access token de 1 hora | Ventana de revocación demasiado amplia para datos académicos y PII |
| Refresh deslizante indefinido | Sesiones eternas; dificulta retención y respuesta a incidentes |
| Guardar access/refresh en `localStorage` | Expuesto a XSS; el diseño exige memoria + cookie `httpOnly` |
| Ventana de gracia para refresh | Añade estado y debilita la detección; se prefiere *single-flight* en el cliente |
| CSRF solo con `SameSite` | El diseño exige doble envío; defensa en profundidad ante navegadores antiguos |

## Consecuencias

- **Positivas:** revocación efectiva, tokens sin permisos obsoletos, refresh no expuesto a JS, CSRF explícito y probable.
- **Negativas:** dependencia de Redis para autenticación; el cliente debe implementar *single-flight*; el logout debe ser idempotente y limpiar cookies.
- **Operativas:** rotación de secreto JWT y de claves de cifrado; monitoreo de reutilización de refresh y de bloqueos.
- **Compatibilidad:** el refresh se envía a todas las rutas del host por el prefijo `__Host-`; el servidor solo lo consume en `/auth/refresh` y `/auth/logout`.

## Cumplimiento

- C0: aprobar contrato `auth-v1` y errores; R-021.
- C1: declarar `cookieAuth`, `X-CSRF-Token` y `429` en OpenAPI.
- C2: pruebas de rotación, reutilización, logout idempotente, revocación por estado, CSRF y límites.
