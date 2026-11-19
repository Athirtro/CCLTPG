# Runbook — revocación de sesiones y familias

- **Objetivo:** cortar el acceso de una persona o de un dispositivo concreto sin esperar a que caduquen los tokens.
- **Cuándo usarlo:** dispositivo perdido o robado, sospecha de token comprometido, cierre de una relación laboral, incidente de seguridad o cambio de contraseña administrativo.
- **Quién:** la propia persona (logout o cambio de contraseña) o un administrador con `identity:user:manage`.
- **Regla:** el refresh se revoca de inmediato en la base; el access token deja de aceptarse en la siguiente petición si se marca el `sid` o si la cuenta deja de estar `activo`. Sin esas marcas, el access token vive como máximo 900 s.

## 1. Modelo de sesión

| Pieza | Dónde vive | Vigencia | Cómo se revoca |
| --- | --- | --- | --- |
| Access token (JWT) | Cliente (memoria) | 900 s | Marca `deny:sid`/`deny:jti` en Redis o cuenta no `activo` |
| Refresh token (opaco) | Cookie `__Host-ccltpg_rt` | 7 días absolutos | `revocado_en` en `refresh_token`, por familia |
| Token parcial | Redis | 300 s | Se consume o se invalida al completar el flujo |
| CSRF | Cookie `__Host-ccltpg_csrf` | Sesión | Se rota con el refresh |

- `sid` del JWT = `familia_id` de la familia de refresh.
- Una familia agrupa todas las rotaciones de un mismo inicio de sesión.
- `revokeFamily` marca la familia completa; reutilizar un refresh revocado dispara `sesion.refresh_reutilizado` y revoca la familia entera.

## 2. Casos y procedimiento

### 2.1 Cerrar la sesión actual

```http
POST /api/v1/auth/logout
X-CSRF-Token: <csrf-de-la-sesion>
Authorization: Bearer <access>

```

- Revoca la familia, borra `__Host-ccltpg_rt` y `__Host-ccltpg_csrf`, y responde **204**.
- Es idempotente: sin token o repetida, también responde 204.
- Audita `sesion.cerrada`.
- Sin sesión no exige CSRF.

### 2.2 Cortar todas las sesiones de una persona (recomendado)

```http
PATCH /api/v1/identity/users/<uuid-usuario>
Content-Type: application/json
X-CSRF-Token: <csrf-de-la-sesion-administradora>
Authorization: Bearer <access-administrador>

{ "password": "<clave-temporal-12-a-128>" }
```

- Revoca todas las familias, fuerza cambio de contraseña y audita `usuario.password_reseteada`.
- Si no se quiere cambiar la contraseña, usar la transición de estado del §2.3.

### 2.3 Corte inmediato sin cambiar credenciales

```http
POST /api/v1/identity/users/<uuid-usuario>/transitions
{ "to": "inactivo", "motivo": "revocación de sesiones - ticket <id>" }

POST /api/v1/identity/users/<uuid-usuario>/transitions
{ "to": "activo", "motivo": "acceso restablecido - ticket <id>" }
```

- Mientras la cuenta no está `activo`, `resolvePrincipal` rechaza el access token, revoca las familias y marca el `sid` en Redis.
- Al reactivar, la persona debe iniciar sesión de nuevo; los refresh revocados no se recuperan.
- Ambas transiciones se auditan (`usuario.desactivado`, `usuario.activado`).

### 2.4 Revocar una familia concreta (break-glass)

No hay endpoint para elegir una familia. Si la API no está disponible o se necesita precisión quirúrgica:

```sql
-- Ejecutar como ccltpg_migrator, con ticket aprobado.
begin;

update public.refresh_token
set revocado_en = now()
where familia_id = '<uuid-familia>'
  and revocado_en is null;

insert into public.evento_auditoria
  (id, actor_id, actor_perfil, ip, dispositivo, recurso, recurso_id, accion,
   datos_antes, datos_despues, request_id)
values
  (gen_random_uuid(), '<uuid-operador>', 'administrador', null, 'runbook',
   'usuario', '<uuid-usuario>', 'sesion.revocada',
   jsonb_build_object('origen', 'break_glass'),
   jsonb_build_object('familia_id', '<uuid-familia>', 'motivo', 'ticket <id>'),
   'runbook-revocacion-<ticket>');

commit;
```

Y marcar el `sid` en Redis para cortar el access token:

```bash
redis-cli SET "ccltpg:auth:deny:sid:<uuid-familia>" 1 EX 900
```

> No usar `KEYS *` en producción. Si hace falta un barrido, usar `SCAN` con `MATCH ccltpg:auth:deny:sid:*` y revisar antes de borrar.

### 2.5 Tokens parciales

Los tokens parciales (`mfa_verify`, `mfa_enroll`, `pwd_change`) viven 300 s y su clave es el SHA-256 del token. No hay índice por usuario, así que no se pueden listar ni borrar por persona. Caducan solos; si se sospecha compromiso, completar el flujo o esperar la ventana y volver a iniciar sesión.

## 3. Verificación

```sql
select familia_id, count(*) as tokens, count(*) filter (where revocado_en is null) as activos
from public.refresh_token
where usuario_id = '<uuid-usuario>'
group by familia_id
order by familia_id;
```

- Familias activas esperadas: **0** tras el corte.
- `POST /api/v1/auth/refresh` con la cookie antigua debe responder 401 `AUTH_TOKEN_REUSED`.
- `GET /api/v1/me` con el access antiguo debe responder 401 `AUTH_TOKEN_REVOKED` en la siguiente petición si se marcó el `sid` o la cuenta no está `activo`; si solo se revocó el refresh, el access sigue hasta 15 min.

Auditoría esperada:

```sql
select accion, actor_id, recurso_id, ocurrido_en, request_id
from public.evento_auditoria
where accion in ('sesion.cerrada', 'sesion.revocada', 'sesion.refresh_reutilizado')
order by ocurrido_en desc
limit 20;
```

## 4. Diagnóstico

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `refresh` responde 401 `AUTH_TOKEN_REUSED` | Token rotado, revocado o familia cortada | Es el comportamiento esperado |
| `refresh` responde 401 `AUTH_TOKEN_INVALID` | Cookie ausente, manipulada o de otro entorno | Revisar cookie y dominio |
| `refresh` responde 403 `AUTH_CSRF_INVALID` | Falta `X-CSRF-Token` | Reenviar cabecera y cookie CSRF |
| El access sigue funcionando tras revocar refresh | Solo se revocó la familia; no se marcó el `sid` | Aplicar §2.3 o esperar 900 s |
| Logout responde 204 pero la cookie sigue | El navegador no aplicó `Set-Cookie` de borrado | Revisar `Secure`/`__Host-` y que el sitio sea HTTPS |
| Redis no responde | Dependencia caída | La API responde 503; restablecer Redis antes de continuar |

## 5. Límites

- No existe una lista de sesiones activas por usuario en la API; el operador consulta `refresh_token` con el rol de lectura.
- La revocación de Redis (`deny:sid`) es por familia, no por usuario. Para cortar todo, usar `PATCH` con contraseña o transición de estado.
- Un access token robado sigue siendo válido hasta 900 s si no se marca el `sid`. Es el precio de no consultar Redis en cada petición; el diseño lo acota con el TTL.
