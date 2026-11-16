# ADR-0001 — Autorización con denegación por defecto, ámbito y matriz ejecutable

- **Estado:** Aceptada por Rol B (2026-11-16); requiere ratificación del equipo en Compuerta 0.
- **Fecha:** 2026-11-16
- **Decisores:** Rol B (autor); Rol A y Rol C (revisión); aprobación humana en C0.
- **Trazabilidad:** diseño cap. 8; R-001, R-002, R-011, R-017, R-023, R-028; PA-002, PA-006; inventario G-07, G-08, G-13, G-16; `docs/contratos/auth-v1.md` §5.

## Contexto

El capítulo 8 exige un guard global con denegación por defecto, permisos declarados por ruta y verificación de propiedad por fila. La propuesta de Rol C añade `update_own`, un catálogo cerrado y la matriz de autorización como artefacto. El contrato API tiene 35 operaciones y varias rutas con semántica OR (`manage` o `read_own`). El ámbito de grupo del educador (PA-002) no estaba resuelto y el OpenAPI solo declara permisos en prosa.

## Decisión

1. **Denegación por defecto con lista blanca explícita.** Solo `POST /auth/login`, `POST /auth/mfa/verify` y `POST /auth/refresh` son públicos (más los pasos parciales de MFA, que exigen token parcial). Toda otra operación declara permiso; si no lo declara, el guard rechaza y una prueba falla.
2. **Declaración legible por máquina.** Cada operación lleva `x-access` (valores `public`, `partial`, `authenticated`, `permission`), `x-permission` (arreglo con semántica OR), `x-scope` (valores `global`, `own`, `group`) y `x-audit-event`. CI verifica que ninguna operación quede sin declaración.
3. **Guard global + resolución de ámbito.** El guard evalúa permiso y luego ámbito. El ámbito de grupo del educador se implementa como condición en el guard (visible en la matriz) y se refuerza en el dominio donde haya agregados.
4. **Propiedad por recurso.** Se aplica la tabla de R-023: `usuario_id`, `estudiante.usuario_id`, `matricula → estudiante.usuario_id`, `grupo.educador_id`, `sesion → grupo.educador_id`, `archivo.subido_por`, `notificacion.usuario_id`.
5. **Respuestas de ámbito.** Permiso ausente → 403 `PERMISSION_DENIED`; recurso fuera de ámbito → 404 `RESOURCE_NOT_FOUND`; colecciones → filtradas en silencio.
6. **`actor_perfil`.** Es el perfil que otorgó el permiso. `X-Perfil-Activo` solo desambigua cuando varios perfiles lo otorgan; nunca concede permisos.
7. **Matriz doble.** En C0 es documental (`docs/contratos/matriz-autorizacion-v1.md`); en C2 es un fixture ejecutable: una fila = operación + perfil + ámbito + resultado esperado (2xx/403/404) + evento de auditoría.

## Alternativas consideradas

| Alternativa | Motivo de rechazo |
| --- | --- |
| Autorización solo en el dominio | La regla no sería visible en la matriz ni uniforme entre módulos; más riesgo de fuga |
| Middleware manual por controlador | Fácil de olvidar; no garantiza denegación por defecto |
| Permisos embebidos en el JWT | Quedan obsoletos al vencer un perfil; la revocación exigiría rotar tokens |
| Motor externo (CASL, OPA) | Fuera de las decisiones tecnológicas registradas; se puede evaluar en C8 |
| Devolver 403 para recursos fuera de ámbito | Revela la existencia del recurso y permite enumeración |

## Consecuencias

- **Positivas:** cobertura verificable, matriz generable, reglas de ámbito explícitas, menor riesgo de fuga.
- **Negativas:** costo de mantener la tabla de propiedad y la matriz; consultas adicionales para resolver grupo/propiedad (mitigable con índices y caché).
- **Operativas:** una ruta nueva sin declaración rompe CI; un cambio de ámbito exige actualizar matriz y pruebas.
- **Deuda:** la matriz documental y el fixture pueden divergir; se mitiga generando el fixture desde el mismo origen en C2.

## Cumplimiento

- C0: aprobar R-023 y R-028; crear la matriz v0.1.
- C1: extender el OpenAPI con las extensiones y la verificación en CI.
- C2: matriz ejecutable con casos permitidos y denegados para las 35 operaciones.
