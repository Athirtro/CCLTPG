# Paquete de revisión — Compuerta 0 (Rol B)

- **Rol:** B — Seguridad, identidad y operación
- **Compuerta:** C0 — cierre de especificación
- **Fecha de entrega:** 2026-11-16
- **Estado:** **Listo para revisión; no firmado.** La firma de Rol B queda condicionada a las ratificaciones y a los cierres de la §6.
- **Alcance:** contratos de API, autorización, identidad/sesión, cifrado, auditoría, controles y criterios de aceptación de CAR-07 y CAR-12.
- **Regla respetada:** no se modificaron artefactos congelados (`docs/diseno-arquitectonico.md`, `docs/vision-alcance.md`). Toda corrección quedó como propuesta (R-nn) o ADR para ratificación.

## 1. Resumen ejecutivo

Rol B cierra su parte de la especificación de C0 con **nueve entregables**: inventario, revisión de permisos, contrato de auth, matriz de autorización, modelo de auditoría, controles de seguridad, criterios de aceptación, registro de decisiones y revisión cruzada.

Lo que queda **resuelto**:

- Denegación por defecto y matriz de 48 operaciones con ámbito y casos 404.
- Contrato de sesión completo (access JWT, refresh rotativo, CSRF, bloqueo, MFA, recuperación, errores estables).
- Cifrado de documento con índice ciego y tratamiento de las demás columnas sensibles.
- Auditoría inmutable, transaccional, minimizada y consultable por recurso, con catálogo de 59 eventos.
- 46 controles con verificación y compuerta, y 48 criterios de aceptación verificables (33 de CAR-07 + 15 de CAR-12).

Lo que **impide firmar hoy**:

1. Rol A debe reflejar R-025/R-026/R-027/R-030 y el índice ciego en el diccionario.
2. Rol C debe reflejar R-018/R-020/R-021/R-028/R-029/R-031 en el catálogo y el OpenAPI.
3. El equipo debe ratificar R-018…R-031 y los cuatro ADR, y cerrar PA-006.
4. El equipo debe ratificar PA-017 (criterios funcionales de CAR-01…05 y CAR-09) o crear el catálogo de requisitos equivalente.

Ninguna de estas condiciones es un desacuerdo de fondo: son cambios pendientes de formalización en artefactos de otros roles.

## 2. Entregables y evidencia

| # | Entregable | Artefacto | Contenido verificable | Estado |
| --- | --- | --- | --- | --- |
| 0 | Inventario de superficie | `docs/tasks/rol-b/rol-b-it0-inventario.md` | 35 operaciones, 17 vacíos (G-01…G-17), trazabilidad a CAR | Cerrado |
| 1 | Revisión de permisos | `docs/tasks/rol-b/rol-b-it0-revision-permisos.md` | Gramática, catálogo, 9 bloqueantes (B-01…B-09), veredicto | Cerrado con reservas |
| 2 | Contrato de auth | `docs/contratos/auth-v1.md` + `docs/adr/ADR-0002-sesion-tokens-revocacion.md` | Estados, rutas, tokens, CSRF, bloqueo, 22 códigos, AC-B-01…16 | Cerrado (propuesta) |
| 3 | Matriz de autorización | `docs/contratos/matriz-autorizacion-v1.md` | 48 operaciones (35 + 13), reglas E1…E11, casos A-01…A-14, fixture | Cerrado (5 celdas †) |
| 4 | Modelo de auditoría | `docs/contratos/modelo-auditoria-v1.md` + `docs/adr/ADR-0004-auditoria-inmutable.md` | Esquema, 59 eventos, redacción, inmutabilidad, consulta, T-AUD-01…05 | Cerrado (propuesta) |
| 5 | Controles de seguridad | `docs/contratos/controles-seguridad-v1.md` | 46 controles (C-01…C-46), verificación, compuerta, riesgos aceptados | Cerrado |
| 6 | Criterios de aceptación | `docs/requirements/seguridad.md` | 33 AC-SEC + 15 AC-AUD, trazabilidad y definición de terminado | Cerrado |
| 7 | Registro de decisiones | `docs/adr/README.md` + `docs/contratos/reconciliacion-c0-rol-b.md` | ADR, D1…D26, R-001…R-031, PA, SUP y checklist de ratificación | Cerrado |
| 8 | Revisión cruzada | `docs/reviews/c0/revision-cruzada.md` | 8 bloqueantes (RC-A-01…04, RC-C-01…04), 5 contradicciones, checklist | Emitido; pendiente respuesta A/C |

## 3. Verificación reproducible

Los chequeos se ejecutaron sobre el árbol de trabajo el 2026-11-16. Cualquiera puede repetirlos:

| Qué se verifica | Cómo | Resultado |
| --- | --- | --- |
| Operaciones del OpenAPI histórico C0 | Contar `operationId:` en la propuesta YAML C0 (retirada) | **35** operaciones en **30** rutas |
| Cobertura de la matriz | Comparar los 35 `operationId` con las filas OP-01…OP-35 | **35/35**, 0 faltantes, sin OP duplicados |
| Tamaño de la matriz | Contar filas OP-01…OP-48 | **48** operaciones (35 vigentes + 13 propuestas) |
| Reglas y casos | Contar E1…E11 y A-01…A-14 | **11** reglas, **14** casos de ámbito |
| Controles | Contar filas `C-nn` | **46** (C-01…C-46), sin huecos ni duplicados |
| Criterios | Contar `AC-SEC-nn` y `AC-AUD-nn` | **33** + **15**, sin huecos ni duplicados |
| Catálogo de auditoría | Extraer eventos únicos de `modelo-auditoria-v1` §3 | **59** (58 obligatorios + 1 opcional) |
| Estructura Markdown | Tablas y bloques de código balanceados en los 26 documentos | Sin errores |
| Enlaces internos | Rutas citadas existen | Única excepción: este paquete, ya creado |
| ID de decisiones | D1…D26 (D6–D8 y D14 documentadas en la nota), R-001…R-031, PA-001…PA-016, SUP-001…SUP-013 | Sin IDs duplicados; secuencias R/PA/SUP continuas |

Evidencia de estado del repositorio: todos los cambios de esta iteración están sin comitear; el paquete no depende de artefactos externos.

## 4. Decisiones que se piden ratificar

### 4.1 ADR

| ADR | Qué fija | Consecuencia si no se ratifica |
| --- | --- | --- |
| ADR-0001 | Denegación por defecto, `x-*`, ámbito propio/grupo, 403 vs 404 | No hay contrato de autorización ejecutable en C2 |
| ADR-0002 | Access JWT 15 min + denylist, refresh rotativo 7 días, CSRF, logout | No se puede implementar sesión sin reabrir el diseño |
| ADR-0003 | AES-256-GCM + HMAC-SHA256 para documento; `email` con excepción | El modelo de estudiante no se puede congelar |
| ADR-0004 | Auditoría solo inserción, transaccional, compensación, sin hash chain | No se puede migrar `evento_auditoria` en C2 |

### 4.2 Resoluciones

| Grupo | IDs | Qué cambia | Dueño de la formalización |
| --- | --- | --- | --- |
| Catálogo y rutas | R-018, R-019, R-020, R-029 | Permisos del educador, lecturas académicas, notificaciones, descarga de archivos | Rol C |
| Contrato de auth | R-021 | Rutas MFA/password, `/me`, tokens, errores | Rol C |
| Contrato legible por máquina | R-028, R-031 | `x-*`, catálogo de eventos validado en CI | Rol C |
| Modelo y datos | R-025, R-026, R-027, R-030 | Cifrado, vínculo estudiante–usuario, identidad MFA, auditoría | Rol A |
| Semántica | R-022, R-023, R-024 | Implicaciones, propiedad/ámbito, horarios | Rol B/C |

### 4.3 Reversibilidad de las decisiones

| Decisión | Reversibilidad | Costo si se cambia después de C0 |
| --- | --- | --- |
| D2/D4 — denegación por defecto y matriz | Barata | Alto después de C2: cambia el guard, la matriz y las pruebas de todas las rutas |
| D5 — `actor_perfil` como perfil que autoriza | Barata | Alto después de C2: los eventos históricos quedarían con otra semántica |
| D9 — cifrado + índice ciego | Barata | Costosa después de C4: exige migrar y reindexar datos existentes |
| D10 — access 15 min + refresh rotativo | Barata | Media después de C2: afecta clientes y sesiones activas |
| D21 — `email` en claro | Barata | Media: si se cifra después, hay que migrar el identificador de login |
| D23 — auditoría sin cadena de hashes | Barata | Costosa después de C8: exigiría sellar y posiblemente reescribir la traza |
| D24 — `recurso` + `recurso_id` | Barata | Costosa después de C2: los eventos viejos no tendrían `recurso_id` |
| R-029 — propiedad de archivos por `subido_por` | Barata | Media después de C3: cambia la condición de descarga, no el permiso |

**Lectura:** las decisiones de mayor costo irreversible son D9 y D24; por eso se cierran en C0 y no se dejan a C2/C4.

## 5. Cumplimiento del criterio de salida C0

| # | Criterio del plan | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Gramática y catálogo firmados o con objeciones cerradas; PA-006 resuelta | **Condicionado** | Revisión de permisos + `adr/README` §7; falta ratificación del equipo |
| 2 | Matriz de 48 operaciones sin accesos sin declarar | **Cumplido con reservas** | Matriz §7: 35/35 cubiertas; 5 celdas † por R-018/R-020/R-029 |
| 3 | Auditoría con inmutabilidad verificable | **Cumplido (diseño)** | `modelo-auditoria-v1` §5 + ADR-0004; pruebas T-AUD-01…05 definidas para C2 |
| 4 | Controles con verificación y compuerta | **Cumplido** | 46 controles, mapa por compuerta §8 |
| 5 | Criterios de CAR-07 y CAR-12 | **Cumplido** | 33 AC-SEC + 15 AC-AUD con verificación y compuerta |
| 6 | Decisiones registradas; congelados intactos | **Cumplido** | `adr/README`, adenda R-018…R-031; sin cambios en diseño/visión |
| 7 | Paquete C0 entregado y aprobación solicitada | **Cumplido con este documento** | Este paquete + revisión cruzada |

## 6. Bloqueantes y condiciones de firma

| # | Bloqueante | Impacto | Dueño | Compuerta |
| --- | --- | --- | --- | --- |
| 1 | Diccionario sin R-025/R-026/R-027/R-030 (RC-A-01…04) | El modelo no se puede congelar; C2 no puede migrar | Rol A | C0 |
| 2 | Catálogo sin R-018/R-020/R-029 (RC-C-01/02) | La matriz referencia permisos inexistentes | Rol C | C0 |
| 3 | OpenAPI sin `x-*`, rutas de auth y lecturas (RC-C-03/04) | No hay contrato ejecutable ni cobertura bidireccional | Rol C | C0 |
| 4 | PA-006 sin ratificación | La gramática y el catálogo no son v1.0 | Equipo | C0 |
| 5 | R-018…R-031 sin ratificación | Las 5 celdas † y el catálogo de eventos quedan en el aire | Equipo | C0 |
| 6 | PA-004 (acudiente) sin decisión | Bloquea el alcance de identidad temporal | Equipo | Antes de C2 |
| 7 | PA-007 (esquemas OpenAPI incompletos) | Bloquea contratos de detalle, no la seguridad | Rol A/C | C0–C1 |
| 8 | PA-017 (criterios funcionales de CAR-01…05 y CAR-09) sin ratificar | El criterio literal de C0 queda incompleto | Rol A/C / Equipo | C0 |

## 7. Riesgos aceptados (con control compensatorio)

| Riesgo | Control | Registro |
| --- | --- | --- |
| Un solo perfil administrador concentra identidad, académico, auditoría y archivos | MFA obligatorio, auditoría inmutable, roles de BD, revisión en C8 | PA-014 |
| Auditoría sin cadena de hashes: un DBA privilegiado podría alterar filas | Privilegios, disparador, WAL archivado, resumen firmado; reevaluar en C8 | PA-016 / ADR-0004 |
| `email` en claro por ser identificador de login | Acceso autorizado, HMAC en logs/auditoría, sin búsqueda parcial | ADR-0003 / R-025 |
| Sin autoservicio de recuperación de contraseña | Reset administrativo auditado | PA-012 |
| Sin ventana de gracia en refresh | *Single-flight* en cliente y monitoreo de cierres espurios | PA-015 |
| Retención sin plazo legal definitivo | ≥ 5 años por defecto y anonimización | PA-011 |

## 8. Revisión cruzada — resultado

`docs/reviews/c0/revision-cruzada.md` emite **8 hallazgos bloqueantes** y **7 no bloqueantes**:

- **Rol A:** documento cifrado + hash (RC-A-01), `recurso_id` e índices de auditoría (RC-A-02), columnas/tabla de identidad MFA (RC-A-03), vínculo `usuario_id` (RC-A-04).
- **Rol C:** dos permisos de notificaciones (RC-C-01), asignaciones del educador (RC-C-02), extensiones `x-*` (RC-C-03), rutas nuevas (RC-C-04).

No hay objeciones de fondo a las decisiones de Rol B; las respuestas pendientes son de formalización.

## 9. Guion de demostración reproducible

La compuerta C0 es documental; la demostración consiste en verificar que las decisiones son localizables y ejecutables, no en levantar servicios.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Abrir `docs/reviews/c0/rol-b.md` y `docs/adr/README.md` | Se entiende el alcance, las decisiones y lo que falta sin leer todo el repositorio |
| 2 | Contar operaciones en la propuesta YAML C0 (retirada; histórico): 35 `operationId` | 35 operaciones |
| 3 | Abrir `docs/contratos/matriz-autorizacion-v1.md` §4–§5 | 48 operaciones con permiso, ámbito, 401/403/404 y evento |
| 4 | Abrir `docs/contratos/modelo-auditoria-v1.md` §5 y ADR-0004 | Privilegios, disparador y pruebas T-AUD-01…05 listas para C2 |
| 5 | Abrir `docs/requirements/seguridad.md` §3–§4 | 33 AC-SEC + 15 AC-AUD, cada uno con verificación y compuerta |
| 6 | Abrir `docs/reviews/c0/revision-cruzada.md` §2–§3 | 8 bloqueantes con dueño y corrección concreta |
| 7 | Ejecutar los chequeos de estructura (`check_md`, `check_docs`) | Tablas, enlaces y codificación sin errores |
| 8 | Recorrer `docs/adr/README.md` §7 | Checklist de ratificación con casillas pendientes |

## 10. Autoevaluación contra la lista anti-deriva (diseño §19.2)

| # | Pregunta | Respuesta en C0 |
| --- | --- | --- |
| 1 | ¿Algún código accedió al esquema de otro contexto? | No aplica: no hay código en Iteración 0. |
| 2 | ¿Toda ruta nueva está protegida y probada? | Sí en diseño: las 48 operaciones tienen permiso/ámbito; la prueba ejecutable es C2. |
| 3 | ¿Toda operación que cambia estado emite evento? | Sí: matriz con `x-audit-event` y catálogo de 59 eventos; las lecturas propias están justificadas. |
| 4 | ¿Todo estado nuevo tiene máquina documentada? | Sí para matrícula, usuario, programa, grupo y sesión (diseño cap. 9 + R-004/R-005). |
| 5 | ¿Migraciones `up`/`down`/`up`? | No aplica aún; se exige en C1/C2 (C-42). |
| 6 | ¿Se modificó un artefacto congelado? | No: diseño y visión intactos; los cambios son propuestas R-nn. |
| 7 | ¿Dependencia fuera del stack aprobado? | No: el stack es el del diseño cap. 5; no se añadió ninguna. |
| 8 | ¿Lógica de pagos o contabilidad? | No: fuera de alcance (SUP-002). |
| 9 | ¿Reglas sin trazabilidad? | No: cada decisión enlaza R-nn, PA-nn o CAR-07/CAR-12. |
| 10 | ¿Solo inserción a nivel de base? | Sí en diseño: privilegios + disparador (ADR-0004 §5); se prueba en C2. |
| 11 | ¿Pruebas omitidas o debilitadas? | No aplica: no hay suite todavía; los criterios prohíben omitirlas en C2. |
| 12 | ¿Documentación, OpenAPI y diccionario coinciden? | **Todavía no**: por eso la revisión cruzada bloquea C0; se corrige con RC-A/RC-C. |

## 11. Qué no se hizo

- No se implementó código, migraciones, Docker ni CI (C1/C2).
- No se modificaron el diccionario, el catálogo ni el OpenAPI: son propiedad de Rol A y Rol C y los cambios están pedidos en R-nn y en la revisión cruzada.
- No se modificaron documentos congelados.
- No se firmó ninguna excepción de seguridad ni se aceptó un riesgo nuevo sin registro.
- No se completó el catálogo de requisitos funcionales ni los catálogos de notificaciones, reportes y KPIs: son entregables de otros roles (ver `docs/reviews/c0/estado-cierre.md`).

## 12. Solicitud de firma

Se solicita al equipo la siguiente decisión en C0:

| Firmante | Qué aprueba | Estado |
| --- | --- | --- |
| **Rol A** | R-025, R-026, R-027, R-030 y RC-A-01…04 aplicados en el diccionario | ☐ Pendiente |
| **Rol C** | R-018, R-019, R-020, R-021, R-028, R-029, R-031 y RC-C-01…04 aplicados en catálogo/OpenAPI | ☐ Pendiente |
| **Equipo** | ADR-0001…0004, R-022…R-024, PA-006, PA-017 y checklist de `adr/README` §7 | ☐ Pendiente |
| **Rol B** | Este paquete, condicionado al cierre de la §6 | ☐ Pendiente |

**Declaración de Rol B:** los artefactos son internamente consistentes y trazables a CAR-07/CAR-12. No solicito firma incondicional: solicito que se ratifiquen las decisiones y que Rol A y Rol C apliquen los cambios bloqueantes. Cuando la §6 esté cerrada, este paquete se puede firmar sin reservas.

## 13. Anexos

| Anexo | Ruta |
| --- | --- |
| Inventario | `docs/tasks/rol-b/rol-b-it0-inventario.md` |
| Revisión de permisos | `docs/tasks/rol-b/rol-b-it0-revision-permisos.md` |
| Contrato de auth | `docs/contratos/auth-v1.md` |
| Matriz de autorización | `docs/contratos/matriz-autorizacion-v1.md` |
| Modelo de auditoría | `docs/contratos/modelo-auditoria-v1.md` |
| Controles de seguridad | `docs/contratos/controles-seguridad-v1.md` |
| Criterios de aceptación | `docs/requirements/seguridad.md` |
| ADR | `docs/adr/ADR-0001…0004` y `docs/adr/README.md` |
| Resoluciones | `docs/contratos/reconciliacion-c0.md` y `reconciliacion-c0-rol-b.md` |
| Revisión cruzada | `docs/reviews/c0/revision-cruzada.md` |
| Cobertura de requisitos | `docs/reviews/c0/cobertura-requisitos.md` |
| Estado de cierre | `docs/reviews/c0/estado-cierre.md` |
| Plan de trabajo | `docs/tasks/rol-b/rol-b-it0-plan.md` |
