# Requisitos de seguridad — CAR-07 y CAR-12

- **Estado:** Propuesta para **Compuerta 0**. Define los criterios de aceptación verificables de los requisitos CAR-07 (seguridad) y CAR-12 (auditoría) del Release 1.0.
- **Fecha:** 2026-11-16
- **Responsable:** Rol B (seguridad, identidad y operación)
- **Fuentes:** `docs/vision-alcance.md` (CAR-07, CAR-12); diseño caps. 8, 11, 12, 13, 14, 17 y 18; `docs/contratos/auth-v1.md` §11 (AC-B-01…AC-B-16); `docs/contratos/matriz-autorizacion-v1.md`; `docs/contratos/modelo-auditoria-v1.md`; `docs/contratos/controles-seguridad-v1.md` (C-01…C-46); ADR-0001…ADR-0004.
- **Regla:** un criterio se considera cumplido solo con la evidencia de su verificación adjunta al paquete de la compuerta. No se acepta “implementado” sin prueba.

## 1. Convenciones

| Término | Significado |
| --- | --- |
| **AC-SEC-nn** | Criterio de aceptación de CAR-07. |
| **AC-AUD-nn** | Criterio de aceptación de CAR-12. |
| **AC-B-nn** | Criterios detallados de autenticación ya definidos en `auth-v1` §11; aquí se elevan a requisito y se complementan. |
| **C-nn** | Control asociado en `controles-seguridad-v1.md`. |
| **Compuerta** | Iteración en la que se demuestra (C1, C2, C3, C4, C5, C7, C8). |
| **Evidencia** | Prueba automatizada, informe, captura de configuración o acta de simulacro, enlazada en `docs/reviews/`. |

Los criterios se escriben en presente verificable (“el sistema rechaza…”, “el evento contiene…”), no como intención. Las metas numéricas provienen del diseño (cap. 14) y de las decisiones cerradas en C0.

## 2. Trazabilidad

| Requisito | Criterios | Controles principales | Artefactos de diseño |
| --- | --- | --- | --- |
| **CAR-07** — autenticación segura con MFA, control de acceso por roles y cifrado TLS | AC-SEC-01…AC-SEC-28 (+ AC-B-01…16) | C-01…C-26, C-33…C-44 | `auth-v1`, ADR-0001/0002/0003, matriz v1.0 |
| **CAR-12** — trazabilidad de inicios de sesión y de creación/modificación de datos con usuario, fecha y hora | AC-AUD-01…AC-AUD-15 | C-27…C-32, C-40, C-41 | `modelo-auditoria-v1`, ADR-0004, matriz v1.0 |

## 3. Criterios de aceptación — CAR-07 (seguridad)

### 3.1 Autenticación y sesión

| ID | Criterio verificable | Verificación | Compuerta | Control |
| --- | --- | --- | --- | --- |
| AC-SEC-01 | Solo `POST /auth/login`, `POST /auth/mfa/verify` y `POST /auth/refresh` son públicos; cualquier otra operación sin autenticación responde 401. | Prueba de contrato que recorre el OpenAPI y llama sin token. | C2 | C-14 |
| AC-SEC-02 | Un intento con email inexistente, cuenta inactiva, cuenta bloqueada o contraseña incorrecta produce la misma respuesta (401 `AUTH_INVALID_CREDENTIALS`), sin revelar el motivo. | Prueba de cuatro casos comparando cuerpo y código. | C2 | C-12 |
| AC-SEC-03 | Las contraseñas se almacenan con Argon2id `m=19456 KiB, t=2, p=1`, en formato PHC versionado, y se rehashean al iniciar sesión si los parámetros suben. | Prueba unitaria de hash y de rehash; inspección del registro. | C2 | C-01 |
| AC-SEC-04 | Se aceptan contraseñas de 12 a 128 caracteres Unicode; se rechazan las de la lista de comunes y las que contienen la parte local del email; no se exige composición ni rotación periódica. | Pruebas de borde y de lista; AC-B-10. | C2 | C-02 |
| AC-SEC-05 | Cinco fallos de contraseña en 15 minutos bloquean la cuenta; el login sigue respondiendo 401; el desbloqueo es administrativo y se audita. | Prueba de integración con reloj controlado; verificación del evento. | C2 | C-03 |
| AC-SEC-06 | MFA es obligatorio para administrador, educador e identidad temporal; el estudiante puede inscribirlo y, si lo hace, es obligatorio verificarlo. | Prueba de los cuatro estados de login por perfil; AC-B-06. | C2 | C-04 |
| AC-SEC-07 | La inscripción MFA entrega 10 códigos de recuperación una sola vez; cada código es de un solo uso y regenerarlos invalida los anteriores. | Prueba de consumo, reutilización (401) y regeneración. | C2 | C-05 |
| AC-SEC-08 | El access token dura 900 segundos, se firma con `HS256` y `kid`, y no contiene email, nombre, perfiles, permisos ni PII. | Inspección del payload y prueba de expiración; AC-B-03. | C2 | C-06 |
| AC-SEC-09 | El refresh token dura 7 días absolutos, rota en cada uso y, si se reutiliza uno revocado o reemplazado, se revoca la familia completa y se audita `sesion.refresh_reutilizado`. | Prueba de rotación, concurrencia y reutilización; AC-B-04. | C2 | C-07 |
| AC-SEC-10 | Logout revoca la familia, borra ambas cookies y responde 204 incluso si se repite o se llama sin token. | Prueba de idempotencia; AC-B-05. | C2 | C-08 |
| AC-SEC-11 | Un usuario desactivado, bloqueado o con todos sus perfiles vencidos pierde acceso en 30 segundos o menos, y sus familias de tokens quedan revocadas. | Prueba de transición de estado y de perfil vencido; AC-B-12. | C2 | C-08 |
| AC-SEC-12 | Las cookies de refresh y CSRF usan prefijo `__Host-`, `Secure`, `SameSite=Strict`, `Path=/`; la de refresh es `HttpOnly` y ninguna declara `Domain`. | Inspección de `Set-Cookie` en la suite de contrato. | C2 | C-09 |
| AC-SEC-13 | Toda operación mutante con sesión exige `X-CSRF-Token` válido; sin él responde 403 `AUTH_CSRF_INVALID` y no ejecuta el cambio. | Suite con token ausente, inválido y válido; AC-B-08. | C2 | C-10 |
| AC-SEC-14 | Los límites de login, MFA, refresh, cambio de contraseña y API general devuelven 429 con `Retry-After` y el código estable correspondiente. | Prueba de límites con reloj simulado; AC-B-09. | C2 | C-11 |
| AC-SEC-15 | Con `debe_cambiar_password` activo solo se permite `GET /me`, `POST /auth/password`, `POST /auth/logout` y `POST /auth/refresh`; el resto responde 403 `AUTH_PASSWORD_CHANGE_REQUIRED`. | Prueba de ruta permitida y denegada; AC-B-14. | C2 | C-13 |

### 3.2 Autorización

| ID | Criterio verificable | Verificación | Compuerta | Control |
| --- | --- | --- | --- | --- |
| AC-SEC-16 | Toda operación declara `x-access`, `x-permission`, `x-scope` y `x-audit-event`; una operación sin declaración hace fallar la prueba de contrato. | Job de CI sobre el OpenAPI; AC-B-01. | C1/C2 | C-14 |
| AC-SEC-17 | Cada operación de la matriz tiene al menos un caso permitido y uno denegado; el denegado por permiso responde 403 `PERMISSION_DENIED`. | Fixture ejecutable generado desde `x-*`; AC-B-02. | C2 | C-15 |
| AC-SEC-18 | El acceso a un recurso propio o de grupo ajeno responde 404 `RESOURCE_NOT_FOUND`; las colecciones se filtran sin revelar el total ajeno. | Casos A-01…A-14 de la matriz; AC-B-13. | C2/C4 | C-16 |
| AC-SEC-19 | `actor_perfil` corresponde al perfil que otorgó el permiso; `X-Perfil-Activo` no concede permisos y un perfil no vigente responde 400 `ACTIVE_PROFILE_INVALID`. | Prueba de usuario multiperfil y de perfil ajeno; AC-B-11. | C2 | C-17 |
| AC-SEC-20 | La expansión de `manage`, `read`, `update` y `read_own` es determinista y se limita a las acciones definidas del recurso; no se conceden permisos de exportación inexistentes. | Prueba de tabla de expansión; revisión del catálogo. | C2 | C-18 |
| AC-SEC-21 | La navegación del frontend se construye desde `/me`, pero una llamada directa sin permiso se rechaza en el backend con 403 o 404 según corresponda. | Prueba de API con usuario sin permiso, sin pasar por la UI. | C2/C4 | C-19 |
| AC-SEC-22 | El endpoint `/me` devuelve permisos expandidos y concretos (sin `*` ni `manage`), solo de perfiles vigentes, y las banderas `mfaEnabled` y `mustChangePassword`. | Prueba de contrato de `/me`; AC-B-11. | C2 | C-17 |

### 3.3 Protección de datos

| ID | Criterio verificable | Verificación | Compuerta | Control |
| --- | --- | --- | --- | --- |
| AC-SEC-23 | Todo el tráfico usa TLS 1.2 o superior; HTTP redirige de forma permanente a HTTPS y se envía HSTS. | Escaneo de configuración TLS en preproducción; inspección de cabeceras. | C5/C7 | C-20 |
| AC-SEC-24 | `numero_documento`, `direccion` y `telefono` se almacenan cifrados con AES-256-GCM y AAD; el documento se busca solo por `numero_documento_hash` (HMAC-SHA256 único). | Prueba de cifrado, de AAD, de duplicado y de búsqueda exacta. | C2/C4 | C-21/C-22 |
| AC-SEC-25 | Un documento duplicado se rechaza con `STUDENT_DUPLICATE` sin exponer el valor almacenado; no existe búsqueda parcial ni ordenamiento por documento. | Prueba de alta duplicada y de intento de búsqueda parcial (400). | C4 | C-22 |
| AC-SEC-26 | Los logs y los errores no contienen contraseñas, tokens, códigos, secretos ni PII sensible; el email aparece como HMAC cuando se registra. | Prueba de grep sobre logs y fixtures; AC-B-15. | C2 | C-40 |
| AC-SEC-27 | Los archivos se limitan a 10 MB, respetan la lista blanca de MIME, se escanean y se ponen en cuarentena si están infectados; nunca se ejecutan desde el almacén. | Pruebas de tipo, tamaño, nombre y EICAR; verificación de cuarentena. | C3 | C-35 |
| AC-SEC-28 | Los secretos viven en el gestor de secretos, no en el repositorio ni en la base; la rotación usa `kid` y acepta dos claves durante la transición. | Escaneo de secretos en CI; procedimiento de rotación revisado. | C1/C5 | C-24 |

### 3.4 Resistencia y operación

| ID | Criterio verificable | Verificación | Compuerta | Control |
| --- | --- | --- | --- | --- |
| AC-SEC-29 | Los errores usan Problem Details con `code` estable y `requestId`, sin trazas, SQL ni PII. | Pruebas de error por operación; revisión del serializador. | C2 | C-39 |
| AC-SEC-30 | Las operaciones de creación con efectos secundarios son idempotentes con `Idempotency-Key`; la misma clave con cuerpo distinto responde 409 `IDEMPOTENCY_KEY_REUSED`. | Prueba de repetición y de conflicto. | C2/C4 | C-38 |
| AC-SEC-31 | El rol de aplicación no puede ejecutar DDL ni modificar el esquema; las migraciones se ejecutan con el rol de migración y se prueban `up`/`down`/`up`. | Inspección de privilegios; pipeline de migraciones. | C1/C2 | C-41/C-42 |
| AC-SEC-32 | Las dependencias y las imágenes se escanean; no quedan vulnerabilidades críticas abiertas al cierre de la compuerta sin excepción firmada. | Informe de CI adjunto al paquete de revisión. | C1/C5 | C-43/C-44 |
| AC-SEC-33 | Existen runbooks de despliegue, reversión, respaldo/restauración, incidente de seguridad y break-glass, probados al menos una vez. | Revisión documental y acta de simulacro. | C5/C8 | C-46 |

## 4. Criterios de aceptación — CAR-12 (auditoría)

| ID | Criterio verificable | Verificación | Compuerta | Control |
| --- | --- | --- | --- | --- |
| AC-AUD-01 | Toda operación con `x-audit-event` emite exactamente ese evento; las operaciones sin evento están justificadas en la matriz (lecturas propias). | Prueba de contrato evento por operación; CI contra el catálogo. | C2 | C-27 |
| AC-AUD-02 | Login exitoso, login fallido, verificación MFA, agotamiento de intentos, logout y reutilización de refresh generan su evento con actor (o nulo justificado), IP y `requestId`. | Suite de autenticación con inspección de la tabla. | C2 | C-27 |
| AC-AUD-03 | Las altas y modificaciones de usuario, perfil, programa, grupo, estudiante, matrícula, clase, asistencia y evaluación generan evento con `recurso_id` y diferencias. | Pruebas por módulo; consulta por `recurso_id`. | C2/C4 | C-27 |
| AC-AUD-04 | Toda descarga de archivo y toda consulta de PII (listados de estudiantes) genera evento antes de responder. | Prueba de descarga y de listado; verificación de orden (evento antes de la respuesta). | C2/C3 | C-27 |
| AC-AUD-05 | Todo evento contiene `actor_id`, `actor_perfil`, `recurso`, `recurso_id` (cuando aplica), `accion`, `ocurrido_en` en UTC y `request_id`. | Validación de esquema sobre una muestra completa de eventos. | C2 | C-27 |
| AC-AUD-06 | `UPDATE`, `DELETE` y `TRUNCATE` sobre `public.evento_auditoria` fallan tanto para `ccltpg_app` como por SQL directo con un rol privilegiado. | Pruebas T-AUD-01…T-AUD-05 del modelo de auditoría. | C2 | C-28 |
| AC-AUD-07 | Una corrección se registra como `auditoria.correccion` con `justificacion` y referencia al evento original; no existe ruta ni privilegio para editar el pasado. | Prueba de compensación; inspección de privilegios. | C2 | C-31 |
| AC-AUD-08 | La auditoría no contiene contraseñas, hashes, tokens, códigos TOTP o de recuperación, secretos MFA, documento, teléfono, dirección ni texto libre. | Prueba de grep y revisión de payloads por evento. | C2 | C-30 |
| AC-AUD-09 | Los campos sensibles modificados se representan como `{"cambiado": true}` y el email como HMAC; un payload mayor de 8 KB se sustituye por resumen y hash. | Pruebas de redacción y de truncamiento. | C2 | C-30 |
| AC-AUD-10 | El evento se escribe en la misma transacción que el cambio; si la inserción falla, la operación se revierte y responde 503. | Prueba con fallo forzado de inserción; verificación de rollback. | C2 | C-29 |
| AC-AUD-11 | Solo `audit:event:read` accede a `GET /audit/events`; sin el permiso responde 403 y con filtros fuera de rango responde 400. | Pruebas de autorización y de validación de filtros. | C2 | C-32 |
| AC-AUD-12 | Cada consulta de auditoría genera `auditoria.consultada` con los filtros aplicados y el número de resultados, sin copiar las filas consultadas. | Prueba de meta-auditoría. | C2 | C-32 |
| AC-AUD-13 | El catálogo de eventos es la fuente única: `x-audit-event` debe existir en el catálogo y todo evento obligatorio debe estar referenciado por al menos una operación. | Job de CI bidireccional; R-031. | C1/C2 | C-27 |
| AC-AUD-14 | Un evento se puede correlacionar con los logs estructurados y la traza mediante `requestId`, y con el usuario mediante `actor_id`. | Prueba de correlación extremo a extremo de una operación. | C2/C5 | C-40 |
| AC-AUD-15 | La auditoría se conserva al menos 5 años (valor por defecto de PA-011), no se borra desde la aplicación y la restauración de respaldos sigue el procedimiento de excepción documentado. | Revisión de la política de retención y simulacro de restauración. | C5/C8 | C-25/C-46 |

## 5. Definición de terminado en seguridad por compuerta

| Compuerta | Se considera terminada cuando… |
| --- | --- |
| **C0** | CAR-07 y CAR-12 tienen criterios aprobados; matriz, modelo de auditoría, controles y ADR están ratificados; no hay operaciones sin declaración. |
| **C1** | El pipeline verifica `x-*`, migraciones y escaneos (secretos, dependencias); los roles de base existen con privilegios mínimos. |
| **C2** | AC-SEC-01…22 y AC-AUD-01…13 tienen evidencia; la matriz ejecutable pasa al 100 %; la inmutabilidad está probada. |
| **C3** | AC-SEC-27 y AC-AUD-04 (archivos) tienen evidencia; contratos de archivos y notificaciones congelados. |
| **C4** | AC-SEC-18/24/25/30 y AC-AUD-03 (académico) tienen evidencia. |
| **C5** | AC-SEC-23/28/31/32/33 y AC-AUD-15 tienen evidencia; prueba de carga, TLS, restauración y alertas. |
| **C7** | Cabeceras, CSP y TLS verificados en el entorno de preproducción. |
| **C8** | Retención, anonimización, riesgos aceptados y revisión de PA-011/PA-016 cerrados. |

Regla de bloqueo: si un criterio de seguridad de la compuerta no tiene evidencia, la compuerta **no se aprueba**, aunque la funcionalidad esté completa.

## 6. Mantenimiento y no objetivos

- Los criterios solo cambian por solicitud de cambio aprobada; se versionan con el contrato.
- La numeración es estable: un criterio retirado se marca como obsoleto, no se reutiliza su ID.
- **No objetivos de este documento:** rendimiento (CAR-06), disponibilidad y respaldo como metas de infraestructura (CAR-08, salvo lo que afecta a seguridad), accesibilidad (CAR-11) y diseño visual. Se cubren en sus propios artefactos.
- Los valores numéricos de throttling (PA-009), CSP (PA-010), retención (PA-011) y sellado de auditoría (PA-016) tienen valor por defecto y se ajustan en su compuerta sin reabrir CAR-07/CAR-12.

## 7. Qué no se hizo

- No se implementaron pruebas ni controles (C1/C2).
- No se fijaron herramientas concretas de DAST/SCA ni umbrales de severidad; se proponen en C1/C5.
- No se sustituye el catálogo de requisitos funcionales: este documento cubre únicamente CAR-07 y CAR-12.
