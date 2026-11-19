# Runbook — reset administrativo de MFA

- **Objetivo:** devolver el acceso a una persona que perdió su dispositivo TOTP y sus códigos de recuperación, sin debilitar el resto de la plataforma.
- **Cuándo usarlo:** dispositivo perdido o robado, cambio de teléfono sin códigos, secreto TOTP corrupto o compromiso del segundo factor.
- **Quién:** administrador con `identity:user:manage`. Toda la operación queda auditada.
- **Regla:** el reset de MFA **no** es un cambio de contraseña y **no** revoca sesiones por sí solo. El procedimiento estándar combina ambos.

## 1. Antes de tocar nada

1. Verificar la identidad de la persona por un canal distinto al correo de la cuenta (presencial, teléfono institucional o jefatura).
2. Abrir un ticket con motivo, aprobador y hora. El `requestId` de la API quedará en la auditoría; el ticket es la justificación humana.
3. Confirmar que la cuenta no está bloqueada por intentos fallidos; si lo está, seguir el procedimiento de desbloqueo (transición a `activo`) en el mismo ticket.
4. Nunca pedir ni aceptar el secreto TOTP, los códigos de recuperación ni la contraseña actual por chat o correo.

## 2. Procedimiento estándar (API)

Requiere una sesión de administrador con `identity:user:manage` y el encabezado `X-CSRF-Token` de esa sesión.

```http
PATCH /api/v1/identity/users/<uuid-usuario>
Content-Type: application/json
X-CSRF-Token: <csrf-de-la-sesion-administradora>
Authorization: Bearer <access-administrador>

{
  "password": "<clave-temporal-12-a-128>",
  "resetMfa": true
}
```

Qué hace la API en una sola llamada:

1. Valida la contraseña temporal contra la política (12–128, no común, sin la parte local del email).
2. Guarda el nuevo hash Argon2id y activa `debe_cambiar_password`.
3. Revoca **todas** las familias de refresh del usuario.
4. Deshabilita MFA, borra el secreto cifrado y elimina los códigos de recuperación.
5. Audita `usuario.password_reseteada` y `usuario.mfa_reset` con `recurso_id`, actor, IP y `request_id`.

La contraseña temporal se entrega en persona o por el canal institucional aprobado. **No se registra en el ticket.**

### Si solo se perdió el segundo factor y la contraseña sigue siendo segura

Se puede enviar solo `{"resetMfa": true}`. En ese caso la API **no** revoca sesiones. Para cortar el acceso:

1. Transición a `inactivo` y de vuelta a `activo` (ambas auditadas como `usuario.desactivado` / `usuario.activado`):

   ```http
   POST /api/v1/identity/users/<uuid-usuario>/transitions
   { "to": "inactivo", "motivo": "reset de MFA - ticket <id>" }

   POST /api/v1/identity/users/<uuid-usuario>/transitions
   { "to": "activo", "motivo": "reset de MFA completado - ticket <id>" }
   ```

   La transición revoca las familias y marca el `sid` en Redis, de modo que el access token deja de aceptarse en la siguiente petición.

2. Alternativa: pedir a la persona que cierre sesión en todos sus dispositivos. El access token vigente caduca en 15 minutos como máximo.

## 3. Verificación

```sql
-- Ejecutar como ccltpg_readonly o ccltpg_migrator.
select id, email, estado, mfa_habilitado, mfa_secret_cifrado is null as sin_secreto,
       debe_cambiar_password
from public.usuario
where id = '<uuid-usuario>';

select count(*) as codigos_restantes
from public.codigo_recuperacion_mfa
where usuario_id = '<uuid-usuario>';

select count(*) as familias_activas
from public.refresh_token
where usuario_id = '<uuid-usuario>' and revocado_en is null;
```

Resultado esperado: `mfa_habilitado = false`, `sin_secreto = true`, `codigos_restantes = 0`, `familias_activas = 0`, `debe_cambiar_password = true`.

Auditoría:

```sql
select accion, actor_id, actor_perfil, ocurrido_en, request_id
from public.evento_auditoria
where recurso_id = '<uuid-usuario>'
  and accion in ('usuario.password_reseteada', 'usuario.mfa_reset', 'usuario.desactivado', 'usuario.activado')
order by ocurrido_en desc;
```

## 4. Flujo que verá la persona

1. `POST /api/v1/auth/login` con la contraseña temporal → `password_change_required` y token parcial `pwd_change`.
2. `POST /api/v1/auth/password` con contraseña actual y nueva → `mfa_enrollment_required` (perfiles con MFA obligatorio) o `authenticated`.
3. `POST /api/v1/auth/mfa/enroll` → secreto y `otpauth://` una sola vez.
4. `POST /api/v1/auth/mfa/enroll/confirm` con el primer TOTP → sesión completa y **10 códigos de recuperación** que se muestran una sola vez.
5. La persona guarda los códigos fuera del teléfono y confirma que puede iniciar sesión.

## 5. Diagnóstico

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| 403 `PERMISSION_DENIED` | Falta `identity:user:manage` | Usar una cuenta administradora |
| 403 `AUTH_CSRF_INVALID` | Falta `X-CSRF-Token` o no coincide con la cookie | Releer el token CSRF de la sesión |
| 400 `VALIDATION_FAILED` | Contraseña temporal fuera de política | Elegir otra de 12–128 y sin la parte local del email |
| 404 `RESOURCE_NOT_FOUND` | UUID incorrecto | Confirmar el identificador en `GET /identity/users` |
| La persona sigue con MFA | Se envió `resetMfa` sin efecto por error de cuerpo | Repetir y verificar `mfa_habilitado` |
| Sesión antigua aún válida | Solo se hizo `resetMfa` | Aplicar el corte de sesiones del §2 |

## 6. Reversión y límites

- No se puede restaurar el secreto anterior: la persona debe inscribir MFA de nuevo.
- Si se descubre que el reset fue fraudulento, tratar el caso como incidente de seguridad: reset de contraseña, revocación de sesiones, revisión de auditoría y notificación según `incidente-seguridad.md`.
- El reset no sustituye la verificación de identidad. Un reset sin ticket es un incidente.
