# Controles de seguridad acordados v1.0 (propuesta Rol B)

- **Estado:** Propuesta para **ratificación en Compuerta 0**. Lista base de controles, su verificación y la compuerta en que se demuestran.
- **Fecha:** 2026-11-16
- **Responsable:** Rol B (seguridad, identidad y operación)
- **Alcance:** controles de identidad, autorización, protección de datos, auditoría, entrada/archivos, cadena de suministro y operación para el Release 1.0.
- **Fuentes:** diseño caps. 8, 11, 12, 13, 14, 16 y 17; CAR-07, CAR-08, CAR-12; ADR-0001…ADR-0004; `docs/contratos/auth-v1.md`, `docs/contratos/matriz-autorizacion-v1.md`, `docs/contratos/modelo-auditoria-v1.md`, `docs/requirements/seguridad.md`.
- **Regla:** un control sin verificación no cuenta como control. Cada fila declara cómo se demuestra y en qué compuerta; si no se puede verificar, se registra como riesgo aceptado o pregunta abierta.

## 1. Cómo leer esta lista

| Columna | Significado |
| --- | --- |
| **ID** | Identificador estable `C-nn`. |
| **Control** | Qué se hace, en términos verificables. |
| **Riesgo** | Amenaza o fallo que evita. |
| **Verificación** | Prueba, inspección o evidencia que lo demuestra. |
| **Compuerta** | C0 (documento), C1 (esqueleto/CI), C2 (identidad y auditoría), C3 (archivos/notificaciones), C4 (académico), C5 (endurecimiento), C7 (accesibilidad/headers), C8 (privacidad/operación). |
| **Resp.** | A (modelo/datos), B (seguridad/operación), C (contratos/CI). |

Estados: **propuesto** (esta lista), **verificado** (evidencia adjunta en el paquete de la compuerta) o **aceptado con riesgo** (ver §7).

## 2. Identidad y sesión

| ID | Control | Riesgo | Verificación | Compuerta | Resp. |
| --- | --- | --- | --- | --- | --- |
| C-01 | Contraseñas con Argon2id `m=19456 KiB, t=2, p=1`, formato PHC versionado y rehash al iniciar sesión si suben los parámetros. | Robo de credenciales por cracking. | Prueba unitaria de hash/verificación y de rehash; inspección del formato almacenado. | C2 | B |
| C-02 | Política de contraseñas: 12–128 caracteres Unicode, sin reglas de composición, bloqueo de comunes y de la parte local del email, sin rotación periódica. | Contraseñas débiles o reutilizadas. | Pruebas de borde y de lista de comunes; casos de aceptación AC-SEC-04. | C2 | B |
| C-03 | Bloqueo tras 5 fallos de contraseña en 15 minutos; desbloqueo solo administrativo; el login no revela el bloqueo. | Fuerza bruta y enumeración de estados. | Prueba de integración con reloj controlado; verificación de la respuesta uniforme. | C2 | B |
| C-04 | MFA TOTP obligatorio para administrador, educador e identidad temporal; opcional para estudiante, obligatorio si se inscribió. | Suplantación de cuentas privilegiadas. | Prueba por perfil de los cuatro estados de login; matriz de sesión. | C2 | B |
| C-05 | Códigos de recuperación de un solo uso, almacenados con Argon2id, regenerados en bloque; su uso se audita. | Pérdida de acceso y reutilización de códigos. | Prueba de consumo, reutilización (401) y regeneración que invalida los anteriores. | C2 | B |
| C-06 | Access token JWT `HS256` de 15 minutos con `kid`, sin permisos ni PII; `iss`, `aud`, `sid`, `jti`, `amr`, `typ` verificados. | Token de larga vida o con datos filtrados. | Prueba de claims, expiración y firma; inspección del payload. | C2 | B |
| C-07 | Refresh opaco de 7 días, rotación estricta con bloqueo de fila y detección de reutilización que revoca la familia. | Secuestro de sesión persistente. | Prueba de rotación, concurrencia y reutilización; verificación de revocación. | C2 | B |
| C-08 | Revocación efectiva por denylist (`sid`/`jti`) y por estado/vigencia del usuario en cada solicitud (caché ≤ 30 s). | Sesión válida tras desactivación o vencimiento de perfil. | Prueba de desactivación → 401 en ≤ 30 s; prueba de perfil vencido. | C2 | B |
| C-09 | Cookies `__Host-ccltpg_rt` y `__Host-ccltpg_csrf` con `Secure`, `SameSite=Strict`, `Path=/`; refresh `HttpOnly`; sin `Domain`. | Fijación y robo de cookies. | Inspección de `Set-Cookie` en pruebas de contrato. | C2 | B |
| C-10 | CSRF de doble envío en toda operación mutante con sesión; `Origin`/`Referer` y `Sec-Fetch-Site` en pasos sin sesión. | CSRF sobre acciones autenticadas. | Suite de pruebas con token ausente, inválido y válido; AC-SEC-12. | C2 | B |
| C-11 | Throttling por IP y por usuario en login, MFA, refresh, cambio de contraseña y API general, con `Retry-After`. | Fuerza bruta, enumeración y agotamiento. | Prueba de límites con reloj simulado; valores de PA-009. | C2/C5 | B |
| C-12 | Respuestas de autenticación uniformes: inexistente, inactiva, bloqueada y contraseña incorrecta devuelven el mismo 401 y tiempo comparable. | Enumeración de cuentas. | Prueba comparativa de respuestas y de tiempos (umbral definido en C2). | C2 | B |
| C-13 | `debe_cambiar_password` restringe la sesión a `/me`, `/auth/password`, `/auth/logout` y `/auth/refresh`. | Uso indefinido de contraseña temporal. | Prueba de las cuatro rutas permitidas y de una denegada. | C2 | B |

## 3. Autorización

| ID | Control | Riesgo | Verificación | Compuerta | Resp. |
| --- | --- | --- | --- | --- | --- |
| C-14 | Denegación por defecto con lista blanca pública (`login`, `mfa/verify`, `refresh`); guard global; una ruta sin `x-access` rompe CI. | Ruta protegida por olvido. | Prueba que recorre el OpenAPI y falla si falta la declaración; AC-SEC-14. | C1/C2 | B/C |
| C-15 | Matriz de autorización ejecutable: cada operación con caso permitido y denegado por perfil. | Permisos mal asignados o no probados. | Fixture generado desde `x-*` comparado con la matriz; suite de autorización. | C2 | B |
| C-16 | Ámbito propio y de grupo verificados en el servidor; colecciones filtradas; acceso directo fuera de ámbito → 404. | Fuga de datos entre usuarios o grupos. | Casos A-01…A-14 de la matriz; pruebas de filtrado. | C2/C4 | B |
| C-17 | `actor_perfil` = perfil que otorgó el permiso; `X-Perfil-Activo` solo desambigua y nunca concede. | Auditoría con perfil incorrecto y escalada por cabecera. | Prueba de multiperfil y de perfil no vigente (400). | C2 | B |
| C-18 | `manage` implica solo acciones definidas del recurso; `export` solo donde exista operación; permisos reservados con compuerta. | Permisos implícitos no intencionados. | Prueba de expansión de comodines y de implicaciones. | C2 | C |
| C-19 | El frontend no es autoridad: la navegación se genera desde `/me`, pero cada llamada se autoriza en el backend. | Ocultamiento de UI como único control. | Prueba de llamada directa a la API con usuario sin permiso. | C2/C4 | B/C |

## 4. Protección de datos y criptografía

| ID | Control | Riesgo | Verificación | Compuerta | Resp. |
| --- | --- | --- | --- | --- | --- |
| C-20 | TLS 1.2 o superior, redirección permanente de HTTP a HTTPS y HSTS (`max-age=31536000; includeSubDomains`). | Interceptación de tráfico. | Escaneo de configuración TLS en preproducción; inspección de cabeceras. | C5/C7 | B |
| C-21 | Cifrado AES-256-GCM de `numero_documento`, `direccion` y `telefono`, con nonce por valor, AAD y formato `v1:<kid>:…`. | Lectura de PII en base o respaldos. | Prueba de cifrado/descifrado, de AAD y de rotación de `kid`; inspección de valores en BD. | C2/C4 | A/B |
| C-22 | Índice ciego HMAC-SHA256 único para el documento (`numero_documento_hash`), con normalización documentada; sin búsqueda parcial. | Duplicados y filtración por búsqueda. | Prueba de duplicado (`STUDENT_DUPLICATE`) y de búsqueda exacta; verificación del índice único. | C2/C4 | A/B |
| C-23 | `email` en claro solo como identificador de login, con controles compensatorios (acceso autorizado, auditoría, HMAC en logs y auditoría). | Exposición del identificador. | Prueba de logs sin email completo; revisión de la excepción documentada (ADR-0003). | C2/C7 | B |
| C-24 | Secretos (JWT, cifrado, HMAC, base, Redis, S3) en gestor de secretos; nunca en el repositorio ni en la base; rotación con `kid`. | Filtración de claves. | Escaneo de secretos en CI; inventario de `kid` y procedimiento de rotación. | C1/C5 | B |
| C-25 | Respaldos cifrados, con RPO ≤ 15 min y RTO ≤ 4 h; simulacro de restauración documentado. | Pérdida de datos. | Simulacro en C5 con tiempos medidos; verificación de cifrado del respaldo. | C5/C8 | B |
| C-26 | Staging con datos anonimizados o semilla representativa; prohibido copiar producción sin anonimizar. | Fuga por entornos. | Revisión del procedimiento de carga y de la semilla. | C5 | B |

## 5. Auditoría

| ID | Control | Riesgo | Verificación | Compuerta | Resp. |
| --- | --- | --- | --- | --- | --- |
| C-27 | Cobertura de eventos: toda operación con `x-audit-event` emite el evento; las que no se auditan están justificadas en la matriz. | Acciones sin trazabilidad. | Prueba de contrato evento por operación; CI valida el catálogo (R-031). | C2 | B/C |
| C-28 | Inmutabilidad en base: `ccltpg_app` sin `UPDATE`/`DELETE`/`TRUNCATE` y disparador que rechaza DML directo. | Alteración de la traza. | Pruebas T-AUD-01…T-AUD-05 del modelo de auditoría. | C2 | B |
| C-29 | Escritura en la misma transacción; si falla la auditoría, se revierte la operación (fallo cerrado). | Evento perdido o posterior al cambio. | Prueba con inserción forzada a fallar; verificación de rollback y 503. | C2 | B |
| C-30 | Redacción por lista blanca: sin contraseñas, tokens, códigos, documento, teléfono, dirección ni texto libre; email como HMAC. | Fuga de PII en la auditoría. | Prueba de grep sobre fixtures; revisión de payloads por evento. | C2 | B |
| C-31 | Corrección solo por evento compensatorio con justificación; nunca `UPDATE`. | Pérdida de confianza en la traza. | Prueba de `auditoria.correccion` y de rechazo de `UPDATE`. | C2 | B |
| C-32 | Consulta de auditoría solo con `audit:event:read`, paginada, con rango máximo y meta-auditada. | Uso indebido del histórico. | Prueba de 403 sin permiso y de evento `auditoria.consultada`. | C2 | B |

## 6. Entrada, aplicación y archivos

| ID | Control | Riesgo | Verificación | Compuerta | Resp. |
| --- | --- | --- | --- | --- | --- |
| C-33 | Validación de entrada en el borde (esquemas, tipos, longitudes, enums) y rechazo con `VALIDATION_FAILED`. | Datos corruptos e inyección. | Pruebas de contrato y de casos límite. | C2/C4 | C |
| C-34 | Consultas parametrizadas mediante Kysely; prohibido concatenar SQL con entrada del usuario. | Inyección SQL. | Revisión de código y prueba de arquitectura; análisis estático. | C1/C4 | A/C |
| C-35 | Carga de archivos: 10 MB, lista blanca de MIME, nombre saneado, escaneo antivirus y cuarentena; sin ejecución desde el almacén. | Malware y cargas abusivas. | Pruebas de tipo, tamaño, nombre y archivo infectado (EICAR); verificación de cuarentena. | C3 | B/C |
| C-36 | Controles de cabeceras: `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP/CORP, CSP sin `unsafe-eval`. | XSS, clickjacking y fugas de contexto. | Inspección de cabeceras en pruebas E2E; escaneo en C7. | C2/C7 | B/C |
| C-37 | CORS cerrado en producción (same-origin); allowlist explícita solo en desarrollo con `credentials: true`. | Robo de sesión entre orígenes. | Prueba de `Origin` no permitido; revisión de configuración. | C2 | B |
| C-38 | Idempotencia en creaciones con efectos secundarios mediante `Idempotency-Key`; cuerpo distinto con la misma clave → 409. | Duplicados por reintentos. | Pruebas de repetición y de conflicto. | C2/C4 | C |
| C-39 | Errores en Problem Details con `code` estable y `requestId`, sin trazas, SQL ni PII. | Fuga de información interna. | Pruebas de respuestas de error; revisión de serializadores. | C2 | C |
| C-40 | Logs estructurados sin secretos ni PII sensible; email como HMAC; `requestId` en todas las líneas. | Fuga por observabilidad. | Prueba de grep sobre logs de la suite; revisión de la configuración. | C2/C5 | B |

## 7. Cadena de suministro y operación

| ID | Control | Riesgo | Verificación | Compuerta | Resp. |
| --- | --- | --- | --- | --- | --- |
| C-41 | Roles de base de datos: `ccltpg_migrator` (DDL), `ccltpg_app` (DML sin DDL ni privilegios sobre auditoría), `ccltpg_readonly` (vistas analíticas). | Escalada y daño accidental. | Inspección de privilegios; prueba de que la app no puede alterar el esquema ni la auditoría. | C1/C2 | B |
| C-42 | Migraciones reversibles, probadas `up`/`down`/`up`, con respaldo previo y procedimiento de reversión. | Despliegue fallido sin retorno. | Pipeline de migraciones sobre base vacía y sobre instantánea de la compuerta anterior. | C1/C5 | A/C |
| C-43 | Escaneo de dependencias (SCA) y de imágenes de contenedor; sin vulnerabilidades críticas abiertas al cierre de compuerta. | Dependencia vulnerable. | Informe de CI adjunto al paquete de revisión; política de excepción firmada. | C1/C5 | C |
| C-44 | Escaneo de secretos en el repositorio y en el historial; bloqueo de credenciales en commits. | Clave filtrada. | Job de CI y prueba con un secreto de ejemplo. | C1 | C |
| C-45 | Observabilidad: logs con `requestId`, trazas OpenTelemetry, métricas y alertas por errores de autenticación, auditoría y latencia. | Incidente no detectado. | Revisión de dashboards y de reglas de alerta; simulacro de alerta. | C5 | B |
| C-46 | Runbooks de despliegue, reversión, respaldo/restauración, incidente de seguridad y break-glass; acceso a producción restringido y registrado. | Respuesta improvisada. | Revisión documental y simulacro; registro de accesos. | C5/C8 | B |

## 8. Mapa de controles por compuerta

| Compuerta | Controles que se demuestran | Evidencia mínima |
| --- | --- | --- |
| **C0** | C-14, C-15 (diseño), C-27, C-28 (diseño), C-46 (borrador) | ADR, matriz, modelo de auditoría, esta lista y criterios de aceptación aprobados |
| **C1** | C-24 (escaneo), C-34, C-41 (roles), C-42, C-43, C-44 | Pipeline verde, migraciones `up/down/up`, informe SCA, escaneo de secretos |
| **C2** | C-01…C-19, C-21…C-23, C-27…C-32, C-36…C-40 | Suite de auth, matriz ejecutable, pruebas de inmutabilidad y redacción |
| **C3** | C-35, C-38 (archivos/notificaciones) | Pruebas de carga, MIME, cuarentena e idempotencia |
| **C4** | C-16 (ámbito académico), C-21/C-22, C-33, C-38 | Pruebas de matrícula, asistencia, evaluación y duplicados |
| **C5** | C-11 (ajuste), C-20, C-24 (rotación), C-25, C-40, C-42, C-43, C-45, C-46 | Prueba de carga, TLS, simulacro de restauración y de alerta |
| **C7** | C-20, C-23, C-36 | Escaneo de cabeceras, CSP y accesibilidad |
| **C8** | C-25, C-26, C-46, PA-011, PA-016 | Retención, anonimización, revisión de riesgos aceptados |

## 9. Riesgos aceptados y excepciones

| Riesgo | Control compensatorio | Registro |
| --- | --- | --- |
| Un solo perfil administrador concentra identidad, académico, auditoría y archivos. | MFA obligatorio, auditoría inmutable, roles de BD y revisión en C8. | PA-014 |
| Auditoría sin cadena de hashes: un DBA con privilegios podría alterar filas. | Acceso restringido, disparador, WAL archivado y resumen firmado periódico; reevaluar en C8. | PA-016 / ADR-0004 |
| `email` en claro por ser identificador de login. | Acceso autorizado, HMAC en logs/auditoría, sin búsqueda parcial; cifrado con `email_hash` si el equipo no acepta la excepción. | ADR-0003 / R-025 |
| Sin autoservicio de recuperación de contraseña. | Reset administrativo auditado y soporte del centro. | PA-012 |
| Sin ventana de gracia para refresh. | *Single-flight* en el cliente y monitoreo de cierres espurios. | PA-015 |
| Retención de auditoría y PII sin plazo legal definitivo. | Valor por defecto ≥ 5 años y anonimización. | PA-011 |

## 10. Mantenimiento

- Un control se marca **verificado** solo con evidencia enlazada en el paquete de revisión de la compuerta.
- Si un control cambia de mecanismo, se actualiza esta lista y se registra la decisión; no se elimina el control sin sustituto.
- La lista se revisa en cada compuerta; los controles de C8 se cierran antes del Release 1.0.
- La omisión de un control crítico (C-14, C-15, C-28, C-29, C-41) bloquea la compuerta.

## 11. Qué no se hizo

- No se implementaron controles ni pruebas: la lista es documental (C0).
- No se fijaron herramientas concretas de SCA/DAST ni umbrales de severidad; se proponen en C1/C5.
- No se sustituyen los requisitos de aceptación (`docs/requirements/seguridad.md`), que definen el resultado observable.
