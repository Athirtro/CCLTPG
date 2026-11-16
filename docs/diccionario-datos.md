# Diccionario de datos v1 (esquemas `public` y `academic`)

- **Estado:** Borrador de Iteración 0 (Rol A) — derivado del capítulo 7 de `docs/diseno-arquitectonico.md`.
- **Fuente principal:** `docs/diseno-arquitectonico.md` (cap. 7, y referencias en caps. 8, 9, 11, 12, 13).
- **Nota:** este documento no modifica artefactos congelados; registra la interpretación del modelo v1 y marca aspectos por detallar.

## 1. Reglas generales (cap. 7.1)

| Regla | Detalle | Requisito/origen |
| --- | --- | --- |
| Esquemas | `public` (núcleo compartido) y `academic` (negocio). | Diseño cap. 4.2, 7.1 |
| Identificadores | Claves primarias UUIDv7 generadas en la aplicación. | Diseño cap. 6.2, 7.1 |
| Integridad | Claves foráneas con `ON DELETE RESTRICT` salvo indicación contraria. | Diseño cap. 7.1 |
| Aislamiento entre esquemas | Sin claves foráneas entre esquemas; referencias cruzadas como `uuid` validados por el contexto dueño. | Diseño cap. 3.2, 4.2, 7.1 |
| Enumeraciones | Tipos `enum` de PostgreSQL. | Diseño cap. 7.1 |
| Datos sensibles | Columnas marcadas como sensibles se cifran a nivel de aplicación antes de persistir. | Diseño cap. 7.1, 12 |
| Fechas/horas | Almacenamiento en UTC (`timestamptz`). | Diseño cap. 6.2 |
| Borrado | Borrado lógico (`deleted_at`) solo donde el negocio lo exija; auditoría nunca se borra. | Diseño cap. 6.2, 11 |

## 2. Esquema `public`

### 2.1 `public.usuario`
- **Descripción:** cuentas de usuario del sistema.
- **Requisito de origen:** CAR-07, CAR-10 (visión); diseño cap. 4.2, 7.2, 8, 9, 12.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid (UUIDv7) | No | PK |
| `email` | text | No | Único |
| `password_hash` | text | No | Hash Argon2id (cap. 12) |
| `nombre` | text | No | — |
| `estado` | enum | No | `activo`, `inactivo`, `bloqueado` (cap. 9) |
| `mfa_habilitado` | boolean | No | MFA/TOTP (cap. 12) |
| `mfa_secret_cifrado` | text/bytea | Sí | **Sensible** (cifrado a nivel de aplicación) |
| `creado_en` | timestamptz | No | UTC |
| `actualizado_en` | timestamptz | No | UTC |

### 2.2 `public.perfil`
- **Descripción:** perfiles/roles de acceso.
- **Requisito de origen:** CAR-10; diseño cap. 7.2, 8.2.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `codigo` | text | No | Único (p. ej. `estudiante`, `educador`, `administrador`) |
| `nombre` | text | No | — |
| `descripcion` | text | Sí | — |

### 2.3 `public.permiso`
- **Descripción:** catálogo de permisos.
- **Requisito de origen:** CAR-07, CAR-10; diseño cap. 7.2, 8.1.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `codigo` | text | No | Único, gramática `contexto:recurso:acción` (cap. 8) |
| `descripcion` | text | Sí | Catálogo cerrado, versionado por migración |

### 2.4 `public.perfil_permiso`
- **Descripción:** relación perfil-permiso.
- **Requisito de origen:** CAR-10; diseño cap. 7.2.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `perfil_id` | uuid | No | FK → `public.perfil(id)` |
| `permiso_id` | uuid | No | FK → `public.permiso(id)` |
| — | — | — | PK compuesta (`perfil_id`, `permiso_id`) |

### 2.5 `public.usuario_perfil`
- **Descripción:** asignación de perfiles a usuarios (incluye identidades temporales).
- **Requisito de origen:** CAR-07, CAR-10; diseño cap. 7.2, 8.2, 9.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `usuario_id` | uuid | No | FK → `public.usuario(id)` |
| `perfil_id` | uuid | No | FK → `public.perfil(id)` |
| `valid_until` | timestamptz | Sí | Nulo = sin caducidad; soporte identidades temporales |
| `asignado_por` | uuid | Sí | Referencia a actor (detallar en requisitos) |
| `creado_en` | timestamptz | No | UTC |

### 2.6 `public.refresh_token`
- **Descripción:** tokens de refresco con rotación y detección de reutilización.
- **Requisito de origen:** CAR-07; diseño cap. 7.2, 12.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `usuario_id` | uuid | No | FK → `public.usuario(id)` |
| `token_hash` | text | No | No almacenar token en claro |
| `familia_id` | uuid | No | Agrupación para revocación por reutilización |
| `expira_en` | timestamptz | No | — |
| `revocado_en` | timestamptz | Sí | — |
| `reemplazado_por` | uuid | Sí | Referencia a token sucesor |
| `ip` | text/inet | Sí | Contexto de seguridad |
| `user_agent` | text | Sí | Contexto de seguridad |

### 2.7 `public.evento_auditoria`
- **Descripción:** registro inmutable de eventos auditables.
- **Requisito de origen:** CAR-12; diseño cap. 4.2, 7.2, 11.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `actor_id` | uuid | Sí | Referencia lógica a usuario/actor |
| `actor_perfil` | text | Sí | Perfil activo en el evento |
| `ip` | text/inet | Sí | — |
| `dispositivo` | text | Sí | — |
| `recurso` | text | No | — |
| `accion` | text | No | — |
| `datos_antes` | jsonb | Sí | Minimización/redacción de sensibles (cap. 11, 13) |
| `datos_despues` | jsonb | Sí | Minimización/redacción de sensibles |
| `ocurrido_en` | timestamptz | No | UTC |
| `request_id` | text | Sí | Correlación (`requestId`) |

**Regla crítica:** solo inserción; sin `UPDATE`/`DELETE` para rol de aplicación y protección por disparador en BD (cap. 11).

### 2.8 `public.archivo`
- **Descripción:** metadatos de archivos almacenados en servicio compatible S3.
- **Requisito de origen:** CAR-01, CAR-03, CAR-04; diseño cap. 4.2, 7.2, 10.2.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `nombre_original` | text | No | — |
| `mime` | text | No | Lista blanca (cap. 10.2) |
| `tamano` | bigint/int | No | Límite configurable (10 MB por defecto) |
| `hash_sha256` | text | No | Deduplicación de objeto físico (cap. 10.2) |
| `ruta_objeto` | text | No | Ubicación en almacén de objetos |
| `subido_por` | uuid | No | Referencia lógica a usuario |
| `estado_escaneo` | enum | No | `pendiente`, `limpio`, `infectado` |
| `creado_en` | timestamptz | No | UTC |

### 2.9 `public.notificacion`
- **Descripción:** notificaciones persistidas por usuario/canal.
- **Requisito de origen:** CAR-09; diseño cap. 4.2, 7.2, 10.3.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `usuario_id` | uuid | No | FK → `public.usuario(id)` |
| `evento` | text | No | Tipo de evento de negocio |
| `canal` | enum | No | `app`, `email` |
| `plantilla_id` | uuid | Sí | FK lógica a `public.plantilla_notificacion` (detallar) |
| `payload` | jsonb | Sí | Datos para renderizado/contexto |
| `estado` | text/enum | No | Valores propuestos (R-009): `pendiente`, `enviada`, `leida`, `fallida` (a confirmar en C0) |
| `leida_en` | timestamptz | Sí | — |
| `enviada_en` | timestamptz | Sí | — |

### 2.10 `public.preferencia_notificacion`
- **Descripción:** preferencias de canal por evento y usuario.
- **Requisito de origen:** CAR-09; diseño cap. 7.2, 10.3.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `usuario_id` | uuid | No | Parte de clave/identidad (unicidad propuesta R-009: `usuario_id`, `evento`, `canal`) |
| `evento` | text | No | — |
| `canal` | enum | No | `app`, `email` |
| `habilitado` | boolean | No | Notificaciones críticas no silenciables (cap. 10.3, R-009) |

### 2.11 `public.plantilla_notificacion`
- **Descripción:** plantillas versionadas de notificación.
- **Requisito de origen:** CAR-09; diseño cap. 7.2, 10.3.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `codigo` | text | No | Identificador de plantilla (único recomendado) |
| `canal` | enum | No | `app`, `email` |
| `asunto` | text | Sí | Aplicable principalmente a correo |
| `cuerpo` | text | No | Contenido/plantilla; versionada por migración |

## 3. Esquema `academic`

### 3.1 `academic.programa_formativo`
- **Descripción:** oferta formativa del centro.
- **Requisito de origen:** CAR-01; diseño cap. 4.2, 7.3, 9.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `nombre` | text | No | — |
| `descripcion` | text | Sí | — |
| `area` | enum | No | `danza`, `musica`, `teatro`, `artes_plasticas` |
| `cupo_maximo` | integer | Sí/No | Definir obligatoriedad según reglas |
| `estado` | enum | No | `borrador`, `publicado`, `archivado` |
| `creado_en` | timestamptz | No | UTC |

### 3.2 `academic.grupo`
- **Descripción:** grupo/clase asociado a un programa y periodo.
- **Requisito de origen:** CAR-01, CAR-02, CAR-03; diseño cap. 7.3, 9.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `programa_id` | uuid | No | FK → `academic.programa_formativo(id)` |
| `codigo` | text | No | — |
| `educador_id` | uuid | No | Referencia lógica a `public.usuario` (sin FK cruzada) |
| `salon` | text | Sí | — |
| `estado` | enum | No | `abierto`, `cerrado` |
| `periodo` | text | No | Convención propuesta (R-008): cadena canónica `YYYY-P` (p. ej. `2026-1`), a confirmar en C0 |

### 3.3 `academic.horario_grupo`
- **Descripción:** franjas horarias del grupo.
- **Requisito de origen:** CAR-02; diseño cap. 7.3.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `grupo_id` | uuid | No | FK → `academic.grupo(id)` |
| `dia_semana` | smallint/enum | No | Convención propuesta (R-008): entero ISO 1 (lunes)–7 (domingo), a confirmar en C0 |
| `hora_inicio` | time | No | — |
| `hora_fin` | time | No | Validar `hora_fin > hora_inicio` |
| — | — | — | Validación de solapamiento por educador y por salón (regla de negocio) |

### 3.4 `academic.estudiante`
- **Descripción:** datos de estudiante y consentimiento.
- **Requisito de origen:** CAR-01, CAR-02, CAR-05; diseño cap. 7.3, 13.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `usuario_id` | uuid | Sí/No | Referencia lógica a `public.usuario` (definir obligatoriedad) |
| `tipo_documento` | text/enum | No | — |
| `numero_documento` | text | No | Único |
| `nombres` | text | No | — |
| `apellidos` | text | No | — |
| `fecha_nacimiento` | date | Sí | — |
| `municipio` | text | Sí | Alimenta distribución geográfica (CAR-05) |
| `barrio` | text | Sí | Alimenta distribución geográfica (CAR-05) |
| `direccion` | text | Sí | **Sensible** (cifrado a nivel de aplicación) |
| `telefono` | text | Sí | **Sensible** (cifrado a nivel de aplicación) |
| `acudiente` | text/jsonb | Sí | Estructura a detallar; **sin acceso por defecto** a datos del estudiante (R-007, PA-004 bloqueante antes de C2) |
| `consentimiento_datos` | boolean/jsonb (estructura) | No | Evidencia mínima propuesta (R-006): `aceptado` (bool), `fecha` (timestamptz), `versionAviso` (string), `medio` (string, opcional), conforme cap. 13/Ley 1581 |
| `creado_en` | timestamptz | No | UTC |

### 3.5 `academic.matricula`
- **Descripción:** vínculo estudiante-grupo-periodo con ciclo de vida.
- **Requisito de origen:** CAR-01, CAR-02; diseño cap. 7.3, 9, 10.3.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `estudiante_id` | uuid | No | FK → `academic.estudiante(id)` |
| `grupo_id` | uuid | No | FK → `academic.grupo(id)` |
| `estado` | enum | No | `preinscrita`, `confirmada`, `activa`, `finalizada`, `cancelada`, `retirada` (alineado a cap. 9; R-004) |
| `fecha_matricula` | date/timestamptz | No | — |
| `periodo` | text | No | Convención propuesta (R-008): `YYYY-P`, a confirmar en C0 |
| `creado_en` | timestamptz | No | UTC |
| — | — | — | Única por (`estudiante_id`, `grupo_id`, `periodo`) |

### 3.6 `academic.sesion_clase`
- **Descripción:** sesiones planificadas/ejecutadas de un grupo.
- **Requisito de origen:** CAR-03; diseño cap. 7.3, 9.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `grupo_id` | uuid | No | FK → `academic.grupo(id)` |
| `fecha` | date | No | — |
| `tema` | text | Sí | — |
| `estado` | enum | No | `programada`, `realizada`, `cancelada` |

### 3.7 `academic.asistencia`
- **Descripción:** registro de asistencia por sesión y matrícula.
- **Requisito de origen:** CAR-03; diseño cap. 7.3.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `sesion_id` | uuid | No | FK → `academic.sesion_clase(id)` |
| `matricula_id` | uuid | No | FK → `academic.matricula(id)` |
| `estado` | enum | No | `presente`, `ausente`, `tarde`, `excusa` |
| `registrado_por` | uuid | No | Referencia lógica a usuario educador |
| `registrado_en` | timestamptz | No | UTC |
| — | — | — | Única por (`sesion_id`, `matricula_id`) |

### 3.8 `academic.indicador_evaluacion`
- **Descripción:** indicadores cualitativos por programa.
- **Requisito de origen:** CAR-03; diseño cap. 7.3.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `programa_id` | uuid | No | FK → `academic.programa_formativo(id)` |
| `nombre` | text | No | — |
| `descripcion` | text | Sí | — |
| `escala` | text/jsonb | Sí | Definición de escala/valores a detallar |

### 3.9 `academic.evaluacion_cualitativa`
- **Descripción:** evaluación de una matrícula sobre un indicador en un periodo.
- **Requisito de origen:** CAR-03; diseño cap. 7.3.

| Campo | Tipo lógico | Nulo | Restricciones / Notas |
| --- | --- | --- | --- |
| `id` | uuid | No | PK |
| `matricula_id` | uuid | No | FK → `academic.matricula(id)` |
| `indicador_id` | uuid | No | FK → `academic.indicador_evaluacion(id)` |
| `periodo` | text | No | Convención propuesta (R-008): `YYYY-P`, a confirmar en C0 |
| `valor` | text | No | Según `escala` del indicador (validación de negocio) |
| `observacion` | text | Sí | — |
| `evaluado_por` | uuid | No | Referencia lógica a usuario |
| `evaluado_en` | timestamptz | No | UTC |
| — | — | — | Única por (`matricula_id`, `indicador_id`, `periodo`) |

## 4. Índices mínimos (cap. 7.4)

| Índice / estructura | Tabla(s) | Propósito / origen |
| --- | --- | --- |
| `usuario(email)` | `public.usuario` | Búsqueda/autenticación |
| `estudiante(numero_documento)` | `academic.estudiante` | Unicidad/consulta |
| `matricula(estudiante_id, periodo)` | `academic.matricula` | Consulta por estudiante y periodo |
| `matricula(grupo_id, estado)` | `academic.matricula` | Control de cupos/estado por grupo |
| `asistencia(sesion_id)` | `academic.asistencia` | Consulta por sesión |
| `evento_auditoria(ocurrido_en)` | `public.evento_auditoria` | Consulta temporal |
| `evento_auditoria(actor_id, ocurrido_en)` | `public.evento_auditoria` | Consulta por actor |
| `notificacion(usuario_id, leida_en)` | `public.notificacion` | Bandeja/estado de lectura |
| Vistas materializadas (KPIs de mayor costo) | `public` (vistas de lectura) / analítica | Rendimiento de dashboards (CAR-05, cap. 7.4) |

## 5. Resumen de relaciones (cap. 7.5)

- `public.usuario` — `public.perfil` mediante `public.usuario_perfil`.
- `public.perfil` — `public.permiso` mediante `public.perfil_permiso`.
- `academic.programa_formativo` agrupa `academic.grupo` (contiene `academic.horario_grupo` y `academic.sesion_clase`).
- `academic.estudiante` se vincula a `academic.grupo` mediante `academic.matricula`.
- Cada `academic.sesion_clase` genera `academic.asistencia` por matrícula.
- Cada `academic.matricula` recibe `academic.evaluacion_cualitativa` sobre `academic.indicador_evaluacion`.
- Referencias cruzadas de esquema (`grupo.educador_id`, `estudiante.usuario_id`, `archivo.subido_por`, etc.) son **identificadores lógicos** sin FK entre esquemas.

## 6. Aspectos por detallar (no resueltos en cap. 7)

- Tipos físicos exactos y longitudes (text/varchar, enum names) y nulabilidad precisa donde el diseño no lo fija.
- Estrategia de cifrado a nivel de aplicación para columnas sensibles (formato, campos adicionales como nonce/tag si aplica) — cap. 12.
- Estructura de `consentimiento_datos` (evidencia de fecha/versión de aviso de privacidad) — cap. 13.
- Estructura de `acudiente` y su relación con identidades temporales/acceso — PA-004.
- Valores/semántica del `estado` de `notificacion` y claves únicas de `preferencia_notificacion`/`plantilla_notificacion`.
- Convención de `dia_semana` y formato de `periodo`.
- Borrado lógico (`deleted_at`) por tabla, solo si el negocio lo exige.
