# Matriz de autorización — Emisora R.A.C. v1.0 (documental, E0)

- **Estado:** propuesta de gobernanza E0; pendiente de aprobación humana. **No reemplaza ni edita** `docs/contratos/matriz-autorizacion-v1.md` (matriz congelada v1.0).
- **Fecha:** 27 de noviembre de 2026
- **Responsable:** Rol B (seguridad, identidad y operación)
- **Alcance:** 16 perfiles (3 existentes + 13 nuevos) y una operación representativa por cada uno de los 31 recursos emisora, más operaciones de exportación y lectura necesarias para cubrir los perfiles y eventos del plan.
- **Fuentes:** `docs/diseno-emisora.md` §§5.1, 5.2, 6, 14 y 18; ADR-0001; ADR-0005; `docs/contratos/cambios/cambio-emisora-contexto.md`; `docs/contratos/cambios/cambio-emisora-eventos.md`.
- **Regla:** se mantiene el guard global, la denegación por defecto, la semántica OR de `x-permission` y los códigos de respuesta de `auth-v1`. No se crea un mecanismo de autorización paralelo.

## 1. Cómo leer la matriz

| Columna | Significado |
| --- | --- |
| **ID** | Identificador estable del caso emisora (EM-01…EM-36). El `operationId` real se fija en E1 y se añade a `EXPECTED_OPERATIONS` (EL-5). |
| **Operación representativa** | Ruta propuesta bajo `/api/v1/emisora/...` y RF asociado. Ninguna es pública. |
| **Permiso (OR)** | Permiso declarado en `x-permission`; el administrador lo satisface por `emisora:*:manage`. |
| **Ámbito** | `global` u `own`. No se introduce un ámbito `group` nuevo para emisora. |
| **Caso permitido / Resultado** | Perfil con sesión vigente y recurso sobre el que opera, con el código esperado. |
| **Caso denegado / Resultado denegado** | Al menos un perfil sin permiso y, para `scope: global`, también el caso sin sesión. |
| **Evento** | Evento de auditoría de la enmienda emisora; `—` = sin evento de dominio propio. |

Convenciones:

1. `401` = sin sesión, token inválido/vencido/revocado o token parcial; `403` = autenticado sin permiso (`PERMISSION_DENIED`); `404` = con permiso pero recurso inexistente o fuera de ámbito (`RESOURCE_NOT_FOUND`); `200/201/204` = caso permitido.
2. La matriz evalúa **un perfil por vez**. Si un usuario tiene varios perfiles vigentes, se aplica la unión (regla 5 de la gramática) y prevalece el resultado más permisivo.
3. `manage` implica las acciones del recurso **que estén en el catálogo**; por eso cada recurso emisora declara `read` y `manage` como mínimo y además las acciones usadas por sus controladores.
4. Toda fila con ámbito `own` exige verificación de propiedad en servidor (`EmisoraOwnershipPolicy`) además del permiso; toda fila con `scope: global` exige caso denegado (EL-5).
5. Las validaciones de negocio (plazos, estados, solapamientos) y CSRF son ortogonales a la autorización y no se recogen en esta tabla.

## 2. Perfiles cubiertos (16)

| # | Código | Origen | Permisos representativos |
| --- | --- | --- | --- |
| 1 | `administrador` | existente | Los actuales, más `emisora:*:manage` (entrada aditiva; no se le quita nada) |
| 2 | `educador` | existente | Sin cambios; se usa como caso denegado de emisora |
| 3 | `estudiante` | existente | Sin cambios; se usa como caso denegado de emisora |
| 4 | `jefe_emisora` | nuevo | `emisora:*:manage`, `exports:report:export`, `files:*:create/read` |
| 5 | `programador` | nuevo | `emisora:programacion:manage`, `emisora:rejilla:read`, `emisora:patrocinio:read`, `emisora:promo:read` |
| 6 | `tecnico_grabacion` | nuevo | `emisora:grabacion:manage`, `emisora:audio:manage`, `emisora:proyecto:read`, `emisora:asistencia-cabina:create` |
| 7 | `tecnico_emision` | nuevo | `emisora:programacion:read`, `emisora:promo:manage`, `emisora:patrocinio:manage`, `emisora:planilla:create`, `emisora:transmision:read` |
| 8 | `locutor` | nuevo | `emisora:grabacion:read_own`, `emisora:audio:create`, `files:document:create` |
| 9 | `tecnico_contenidos` | nuevo | `emisora:publicacion:manage`, `emisora:promo:read`, `emisora:audio:read` |
| 10 | `realizador_externo` | nuevo | `emisora:convocatoria:read`, `emisora:proyecto:create/read_own/update_own`, `emisora:informe:create/read_own`, `emisora:rejilla:read` |
| 11 | `comite_programacion` | nuevo | `emisora:proyecto:read`, `emisora:informe:read`, `emisora:rejilla:update`, `emisora:incentivo:update` |
| 12 | `secretario_cultura` | nuevo | `emisora:incentivo:update/export`, `emisora:resolucion:read`, `emisora:inversion:read` |
| 13 | `auxiliar_administrativo` | nuevo | `emisora:tramite:manage`, `emisora:permiso-salida:create`, `emisora:actividad:read` |
| 14 | `contratista_prensa` | nuevo | `emisora:actividad:read`, `emisora:publicacion:create`, `files:document:create` |
| 15 | `ingeniero_mantenimiento` | nuevo | `emisora:equipo:manage`, `emisora:inversion:read`, `emisora:proyeccion:manage` |
| 16 | `operador_transmisor` | nuevo | `emisora:turno:read_own`, `emisora:lectura:create`, `emisora:bitacora:create` |

Los 13 perfiles nuevos viven en `PROFILE_SEEDS`; `seedEmisora` solo carga datos de negocio (I3). `realizador_externo` usa identidad temporal con `valid_until` y MFA según la política vigente para temporales (EM-PA-06).

## 3. Operaciones representativas: permitido y denegado

| ID | Operación representativa | Permiso (OR) | Ámbito | Caso permitido | Resultado | Caso denegado (incluye `scope: global`) | Resultado denegado | Evento |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EM-01 | POST /emisora/programacion-diaria (RF-01) | `emisora:programacion:create` | global | `programador`, franja libre | 201 | `estudiante` (sin permiso emisora); sin sesión | 403 / 401 | `programacion.creada` |
| EM-02 | PATCH /emisora/rejilla-anual/{id}/transitions (RF-03.3) | `emisora:rejilla:update` | global | `comite_programacion`, acta adjunta | 200 | `estudiante`; sin sesión | 403 / 401 | `rejilla.aprobada` |
| EM-03 | POST /emisora/convocatorias (RF-03.1) | `emisora:convocatoria:create` | global | `jefe_emisora`, año único | 201 | `estudiante`; sin sesión | 403 / 401 | `convocatoria.abierta` |
| EM-04 | PATCH /emisora/realizadores/{id} (RF-03.4) | `emisora:realizador:update_own` | own | `realizador_externo`, realizador propio | 200 | otro `realizador_externo`; `estudiante` (sin permiso) | 404 / 403 | `realizador.notificado` |
| EM-05 | POST /emisora/proyectos (RF-03.2) | `emisora:proyecto:create` | global | `realizador_externo`, convocatoria abierta y formato adjunto | 201 | `estudiante`; sin sesión | 403 / 401 | `proyecto.recibido` |
| EM-06 | POST /emisora/comites (RF-03.3) | `emisora:comite:create` | global | `jefe_emisora` | 201 | `estudiante`; sin sesión | 403 / 401 | `comite.registrado` |
| EM-07 | POST /emisora/grabaciones (RF-02.1) | `emisora:grabacion:create` | global | `tecnico_grabacion` | 201 | `estudiante`; sin sesión | 403 / 401 | `grabacion.programada` |
| EM-08 | PUT /emisora/grabaciones/{id}/asistencia-cabina (RF-02.2) | `emisora:asistencia-cabina:create` | global | `tecnico_grabacion` | 200 | `estudiante`; sin sesión | 403 / 401 | `asistencia.registrada` |
| EM-09 | POST /emisora/audios (RF-02.4) | `emisora:audio:create` | global | `locutor`, MIME de audio permitido | 201 | `estudiante`; sin sesión | 403 / 401 | `audio.archivado` |
| EM-10 | POST /emisora/informes (RF-03.5) | `emisora:informe:create` | global | `realizador_externo`, ventana oct/nov | 201 | `estudiante`; sin sesión | 403 / 401 | `informe.recibido` |
| EM-11 | PATCH /emisora/incentivos/{id} (RF-03.6) | `emisora:incentivo:update` | global | `secretario_cultura` o `comite_programacion` | 200 | `estudiante`; sin sesión | 403 / 401 | `incentivo.asignado` |
| EM-12 | POST /emisora/resoluciones (RF-03.7) | `emisora:resolucion:create` | global | `jefe_emisora` | 201 | `estudiante`; sin sesión | 403 / 401 | `resolucion.generada` |
| EM-13 | POST /emisora/patrocinios (RF-04) | `emisora:patrocinio:create` | global | `tecnico_emision` | 201 | `estudiante`; sin sesión | 403 / 401 | `patrocinio.aprobado` |
| EM-14 | POST /emisora/promos (RF-05) | `emisora:promo:create` | global | `tecnico_emision` | 201 | `estudiante`; sin sesión | 403 / 401 | `promo.producida` |
| EM-15 | POST /emisora/publicaciones (RF-05) | `emisora:publicacion:create` | global | `contratista_prensa`; `tecnico_contenidos` por `manage` | 201 | `estudiante`; sin sesión | 403 / 401 | `publicacion.realizada` |
| EM-16 | POST /emisora/transmisiones (RF-06) | `emisora:transmision:create` | global | `jefe_emisora` | 201 | `estudiante`; sin sesión | 403 / 401 | `transmision.autorizada` |
| EM-17 | POST /emisora/viaticos (RF-06.6) | `emisora:viatico:create` | global | `jefe_emisora`, transmisión fuera de la ciudad | 201 | `estudiante`; sin sesión | 403 / 401 | `viatico.solicitado` |
| EM-18 | POST /emisora/prestamos-mifi (RF-06.5) | `emisora:prestamo:create` | global | `tecnico_emision`, dos días de antelación | 201 | `estudiante`; sin sesión | 403 / 401 | `prestamo.autorizado` |
| EM-19 | GET /emisora/turnos/{id} (RF-07.1) | `emisora:turno:read_own` | own | `operador_transmisor`, turno propio | 200 | turno de otro operador; `estudiante` (sin permiso) | 404 / 403 | — |
| EM-19b | POST /emisora/turnos (RF-07.1) | `emisora:turno:create` | global | `jefe_emisora` | 201 | `estudiante`; sin sesión | 403 / 401 | `turno.asignado` |
| EM-20 | POST /emisora/lecturas (RF-07.2) | `emisora:lectura:create` | global | `operador_transmisor` | 201 | `estudiante`; sin sesión | 403 / 401 | `lectura.registrada` |
| EM-21 | POST /emisora/bitacora (RF-07.3) | `emisora:bitacora:create` | global | `operador_transmisor` | 201 | `estudiante`; sin sesión | 403 / 401 | `bitacora.registrada` |
| EM-22 | POST /emisora/obras (RF-08.1) | `emisora:obra:create` | global | `jefe_emisora` | 201 | `estudiante`; sin sesión | 403 / 401 | `obra.incluida` |
| EM-23 | POST /emisora/pagos-derechos (RF-08.3) | `emisora:derecho:create` | global | `jefe_emisora`, solo soporte y estado | 201 | `estudiante`; sin sesión | 403 / 401 | `pago.registrado` |
| EM-24 | PUT /emisora/equipos/{id} (RF-09.1) | `emisora:equipo:update` | global | `ingeniero_mantenimiento` | 200 | `estudiante`; sin sesión | 403 / 401 | `equipo.actualizado` |
| EM-25 | POST /emisora/inversiones (RF-09.3) | `emisora:inversion:create` | global | `jefe_emisora`; `secretario_cultura` solo `read` | 201 | `estudiante`; sin sesión | 403 / 401 | `inversion.registrada` |
| EM-26 | POST /emisora/proyecciones (RF-09.2) | `emisora:proyeccion:create` | global | `ingeniero_mantenimiento` | 201 | `estudiante`; sin sesión | 403 / 401 | `proyeccion.generada` |
| EM-27 | POST /emisora/actividades (RF-10.1) | `emisora:actividad:create` | global | `jefe_emisora` | 201 | `estudiante`; sin sesión | 403 / 401 | `actividad.registrada` |
| EM-27b | GET /emisora/actividades (RF-10.1) | `emisora:actividad:read` | global | `contratista_prensa` o `auxiliar_administrativo` | 200 | `estudiante`; sin sesión | 403 / 401 | — |
| EM-28 | POST /emisora/permisos-salida (RF-10.2) | `emisora:permiso-salida:create` | global | `auxiliar_administrativo` | 201 | `estudiante`; sin sesión | 403 / 401 | `permiso.emitido` |
| EM-29 | POST /emisora/tramites (RF-12.1) | `emisora:tramite:create` | global | `auxiliar_administrativo` | 201 | `estudiante`; sin sesión | 403 / 401 | `tramite.radicado` |
| EM-30 | POST /emisora/planillas (RF-11.2) | `emisora:planilla:create` | global | `tecnico_emision` | 201 | `estudiante`; sin sesión | 403 / 401 | `planilla.registrada` |
| EM-31 | POST /emisora/archivos (RF-11.1, RF-12.2) | `emisora:archivo-emisora:create` | global | `tecnico_grabacion` | 201 | `estudiante`; sin sesión | 403 / 401 | `soporte.adjuntado` |
| EM-32 | GET /emisora/incentivos/export (RF-03.6) | `emisora:incentivo:export` | global | `secretario_cultura` | 200 | `estudiante`; sin sesión | 403 / 401 | `reporte.generado` |
| EM-33 | GET /emisora/reportes-obras (RF-08.2) | `emisora:derecho:export` | global | `jefe_emisora` | 200 | `estudiante`; sin sesión | 403 / 401 | `reporte_obra.generado` |
| EM-34 | GET /emisora/resoluciones/{id}/pdf (RF-03.7) | `emisora:resolucion:read` | global | `secretario_cultura` | 200 | `estudiante`; sin sesión | 403 / 401 | — |
| EM-35 | Cualquier operación emisora (comodín) | `emisora:*:manage` | global | `administrador` | 2xx | `educador`, `estudiante` (sin permiso emisora); sin sesión | 403 / 401 | Según la operación |

Notas:

- EM-04, EM-19 y los casos de la sección 4 son los únicos con ámbito `own`; el resto es `global` y, por tanto, lleva caso denegado explícito en la propia fila.
- EM-32 y EM-33 documentan la pareja de eventos exigida por el plan: el evento de dominio emisora y el transversal `reporte.generado` de Exportaciones.
- EM-35 describe la concesión aditiva del administrador: no sustituye a los casos específicos, los cubre por implicación de `manage`.

## 4. Regla de propiedad y casos obligatorios

### 4.1 `*_own` con `EmisoraOwnershipPolicy`

El permiso se comprueba primero y la propiedad después. `EmisoraOwnershipPolicy` es un puerto en `shared/integration/ownership.port.ts`, implementado en `emisora/infrastructure`; resuelve el principal mediante `IdentityDirectory` (usuario vigente, `valid_until`) **sin SQL contra `public`**. Las reglas de propiedad son:

| Recurso | Columna de propiedad | Caso permitido | Caso denegado obligatorio | Resultado denegado |
| --- | --- | --- | --- | --- |
| `realizador` | `realizador.usuario_id` | `realizador_externo` con `update_own` sobre su fila | Otro realizador con el mismo permiso | 404 `RESOURCE_NOT_FOUND` |
| `proyecto` | vía `realizador.usuario_id` | `realizador_externo` con `read_own`/`update_own` sobre su proyecto | Proyecto de otro realizador | 404 |
| `informe` | vía `realizador.usuario_id` | `realizador_externo` con `read_own` sobre su informe | Informe de otro realizador | 404 |
| `grabacion` | responsable de cabina (`usuario_id`) | `locutor` con `grabacion:read_own` sobre su grabación | Grabación de otro locutor | 404 |
| `turno` | `turno_operador.usuario_id` | `operador_transmisor` con `turno:read_own` sobre su turno | Turno de otro operador | 404 |

Un recurso ajeno devuelve **404**, nunca 403, para no revelar existencia. Una colección `*_own` se filtra en silencio y devuelve 200 vacía. Un perfil sin el permiso `*_own` devuelve 403 aunque el recurso sea propio; una identidad temporal vencida (`valid_until`) se trata como sin sesión (401) o perfil no vigente, sin conceder propiedad.

### 4.2 Casos denegados obligatorios para `scope: global`

Para **cada** fila de la sección 3 con ámbito `global`, el fixture de autorización debe incluir al menos estos tres casos:

| ID | Caso | Esperado |
| --- | --- | --- |
| EM-GLB-01 | Perfil sin ningún permiso emisora (por ejemplo `estudiante` o `educador`) con sesión vigente | 403 `PERMISSION_DENIED` |
| EM-GLB-02 | Sin sesión, token inválido/vencido/revocado o token parcial | 401 |
| EM-GLB-03 | `X-Perfil-Activo` que no otorga el permiso cuando el usuario tiene varios perfiles | 400 `ACTIVE_PROFILE_INVALID` |

EL-5 (`authorization-matrix.spec.ts`) verifica, para cada `operationId` emisora con `scope: global`, un caso permitido **y** un caso denegado. No se añaden excepciones al guard: la denegación por defecto de ADR-0001 rige también para emisora.

## 5. Cobertura y verificación

| Verificación | Resultado esperado |
| --- | --- |
| Perfiles en la matriz | **16** (3 existentes + 13 nuevos) |
| Recursos emisora con operación representativa | **31** de 31 |
| Operaciones `own` con caso de propiedad ajena | **5** reglas en §4.1, todas con 404 |
| Operaciones `global` con caso permitido y denegado | **Todas** (EL-5) |
| Operaciones sin permiso declarado | **0** |
| Permisos nuevos sin perfil que los conceda | **0** (el administrador cubre `emisora:*:manage`) |
| Rutas públicas emisora | **0**; `public-routes.json` intacto |

Criterios de aceptación antes de E1:

1. Toda fila tiene caso permitido y caso denegado con código esperado.
2. Todo permiso `*_own` lleva verificación de `EmisoraOwnershipPolicy` y un caso ajeno con 404.
3. Todo `scope: global` lleva los casos EM-GLB-01…EM-GLB-03.
4. Los `operationId` reales se añaden a `EXPECTED_OPERATIONS` cuando las rutas se generen en E1, sin relajar ninguna prueba existente.
5. Esta matriz documental y el fixture ejecutable se revisan juntos en cada fase; una divergencia rompe la compuerta.
