# Runbook — cambio de contraseña forzado

- **Objetivo:** renovar una contraseña y obligar a la persona a elegir una nueva en el siguiente acceso.
- **Cuándo usarlo:** primer acceso, sospecha de credencial comprometida, reset administrativo, baja de una persona o política de onboarding.
- **Quién:** la propia persona o un administrador con `identity:user:manage`.
- **Regla:** no existe rotación periódica obligatoria. El cambio se fuerza por evento, no por calendario.

## 1. Política vigente

- Longitud: **12 a 128** caracteres Unicode.
- Se rechazan contraseñas comunes y las que contienen la parte local del email.
- No se exige composición (mayúsculas, símbolos, dígitos).
- Se almacena con Argon2id `m=19456 KiB, t=2, p=1`, PHC v2.
- El cambio revoca las demás familias de sesión; la familia actual se conserva cuando el cambio se hace con sesión completa.

## 2. Cambio por la propia persona

### 2.1 Con sesión completa

```http
POST /api/v1/auth/password
Content-Type: application/json
X-CSRF-Token: <csrf-de-la-sesion>
Authorization: Bearer <access>

{
  "currentPassword": "<actual>",
  "newPassword": "<nueva-12-a-128>"
}
```

- Respuesta **204**.
- Conserva la familia actual y revoca las demás.
- Audita `usuario.password_cambiada` con el número de sesiones revocadas.

### 2.2 Con token parcial `pwd_change` (primer acceso o reset)

1. `POST /api/v1/auth/login` → `password_change_required` y `sessionToken`.
2. `POST /api/v1/auth/password` con `currentPassword`, `newPassword` y el token parcial en `Authorization: Bearer <sessionToken>` (o en el cuerpo, según el contrato del cliente).
3. La respuesta es el siguiente estado:
   - `mfa_enrollment_required` si el perfil exige MFA y aún no está inscrito.
   - `mfa_required` si ya tiene MFA y debe verificar.
   - `authenticated` con sesión completa si no aplica MFA.
4. Si hay MFA, continuar con `POST /api/v1/auth/mfa/enroll` y `/enroll/confirm`, o `/mfa/verify`.

## 3. Cambio forzado por administrador

```http
PATCH /api/v1/identity/users/<uuid-usuario>
Content-Type: application/json
X-CSRF-Token: <csrf-de-la-sesion-administradora>
Authorization: Bearer <access-administrador>

{ "password": "<clave-temporal-12-a-128>" }
```

Qué hace la API:

1. Valida la clave temporal contra la política completa (incluye lista de comunes y parte local del email).
2. Guarda el hash Argon2id.
3. Activa `debe_cambiar_password`.
4. Revoca **todas** las familias de refresh del usuario.
5. Audita `usuario.password_reseteada` con `sesiones_revocadas` y `forzado: true`.

La clave temporal se entrega en persona o por el canal institucional aprobado y **nunca** se registra en el ticket, el chat o el correo.

### Si la API no está disponible (break-glass)

Requiere ticket aprobado y el rol `ccltpg_migrator`. El hash se genera con la misma configuración de la API:

```bash
cd apps/api
node --input-type=module -e "import argon2 from 'argon2'; console.log(await argon2.hash(process.argv[1], { type: argon2.type, memoryCost: 19456, timeCost: 2, parallelism: 1 }))" '<clave-temporal>'
```

```sql
begin;

update public.usuario
set password_hash = '<hash-phc>',
    debe_cambiar_password = true,
    actualizado_en = now()
where id = '<uuid-usuario>';

update public.refresh_token
set revocado_en = now()
where usuario_id = '<uuid-usuario>' and revocado_en is null;

insert into public.evento_auditoria
  (id, actor_id, actor_perfil, ip, dispositivo, recurso, recurso_id, accion,
   datos_antes, datos_despues, request_id)
values
  (gen_random_uuid(), '<uuid-operador>', 'administrador', null, 'runbook',
   'usuario', '<uuid-usuario>', 'usuario.password_reseteada',
   jsonb_build_object('origen', 'break_glass'),
   jsonb_build_object('forzado', true, 'motivo', 'ticket <id>'),
   'runbook-password-<ticket>');

commit;
```

Después del break-glass, verificar que el login devuelve `password_change_required` y que las familias activas son cero.

## 4. Verificación

```sql
select id, email, estado, debe_cambiar_password, actualizado_en
from public.usuario
where id = '<uuid-usuario>';

select count(*) as familias_activas
from public.refresh_token
where usuario_id = '<uuid-usuario>' and revocado_en is null;
```

- `debe_cambiar_password = true` tras el reset administrativo.
- `familias_activas = 0` tras el reset administrativo o el cambio con token parcial.
- El login con la clave temporal devuelve `password_change_required`.
- La auditoría muestra `usuario.password_reseteada` (admin) o `usuario.password_cambiada` (persona), exactamente una vez por operación.

## 5. Diagnóstico

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| 401 `AUTH_CURRENT_PASSWORD_INVALID` | Contraseña actual incorrecta | Confirmar con la persona; si se perdió, usar reset administrativo |
| 400 `AUTH_PASSWORD_POLICY_VIOLATION` | Clave corta, común o con la parte local del email | Elegir otra; el detalle indica la violación |
| 403 `AUTH_PASSWORD_CHANGE_REQUIRED` | La cuenta debe cambiar contraseña y la ruta no está permitida | Usar `POST /auth/password`, `GET /me`, `POST /auth/logout` o `POST /auth/refresh` |
| 429 `AUTH_RATE_LIMITED` | Más de 5 cambios por hora para el usuario | Esperar el `Retry-After` |
| El login sigue pidiendo cambio | Se actualizó el hash sin limpiar `debe_cambiar_password` | Repetir el procedimiento estándar |
| La sesión antigua sigue activa | Solo se cambió el hash por SQL | Revocar familias y marcar el `sid` (§4 de `revocacion-sesiones.md`) |

## 6. Límites y comunicación

- No hay recuperación por correo en C2: si la persona olvidó la contraseña, se usa el reset administrativo.
- No se envía la clave temporal por correo electrónico ni por mensajería no aprobada.
- No se reutiliza una clave temporal entre personas ni entre resets.
- Un cambio de contraseña no sustituye la revocación de sesiones si se sospecha compromiso; seguir `revocacion-sesiones.md`.
