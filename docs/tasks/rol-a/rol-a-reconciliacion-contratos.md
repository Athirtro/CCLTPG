# Reconciliación Rol A — contratos, modelo y brechas C0–C8

- **Fecha:** 2026-11-24
- **Rol:** A (Backend, dominio y datos)
- **Estado:** Borrador de regularización para revisión de equipo. No modifica artefactos congelados.
- **Alcance:** R-001..R-017 (Rol A, It0), R-018..R-031 (adenda Rol B), RC-A/RC-C (revisión cruzada C0), y estado observado en contratos/código.

## 1. Resumen ejecutivo

| Área | Estado | Riesgo | Acción recomendada |
| --- | --- | --- | --- |
| R-001..R-017 (Rol A) | Documentadas; parcialmente absorbidas por implementación/contratos | Medio | Confirmar ratificación formal C0 y cerrar items abiertos. |
| R-018..R-031 (Rol B) | Propuestas en adenda; muchas reflejadas en `packages/contracts/openapi.json`/matriz | Alto | Ratificación cruzada A/B/C; evitar asumir como congeladas sin acta. |
| Diccionario de datos | Desalineado con RC-A-01..04 y modelo de seguridad/auditoría propuesto | Alto | Actualizar `docs/diccionario-datos.md` mediante propuesta aprobada de Rol A. |
| Canonicidad OpenAPI | Ambigua entre `packages/contracts/openapi.json` y `packages/contracts/openapi.json` | Alto | Definir fuente canónica, regla de generación y control de ruptura en CI. |
| Implementación C0–C8 | Presente en repo; evidencia local de integración faltante | Medio | Ejecutar `test:integration` y `up/down/up` en Docker; recopilar evidencia CI. |

## 2. Estado R-001..R-017 (propuesta Rol A)

| R | Tema | Estado observado | Evidencia | Acción |
| --- | --- | --- | --- | --- |
| R-001 | Gramática y semántica de permisos | **Parcial** | `gramatica-y-catalogo-permisos-v1.md`, matriz auth, `x-permission` en OpenAPI generado | Ratificar PA-006; confirmar implicaciones `manage/export/read/update`. |
| R-002 | Catálogo cerrado y asignación por perfil | **Parcial** | Catálogo/matriz/OpenAPI existen; adenda B agrega permisos/asignaciones | Reconciliar catálogo base con R-018/R-020/R-022/R-029. |
| R-003 | `exports`/`analytics` sin endpoints funcionales en v1.0 | **Divergente / requiere decisión** | `packages/contracts/openapi.json` incluye `/analytics/kpis`, `/exports`, `/reports/catalog` y `/reports/{reportCode}/generate` con permisos `analytics:kpi:read`, `exports:report:export/create`; módulos `apps/api/src/modules/analytics` y `exports` existen. | Confirmar si R-003 fue reemplazada por decisiones C6 (enmienda formal) o si debe limitarse exposición en v1.0. Registrar decisión en acta C0/C6. |
| R-004 | Estados/transiciones de matrícula | **Parcial** | Diseño y reconciliación lo definen; falta confirmar en diccionario/migraciones/contrato vigente | Verificar enums/transiciones implementadas y pruebas. |
| R-005 | Transiciones de usuario por endpoint dedicado | **Parcial** | Contrato auth/identity evolucionó; verificar ruta/semántica final | Confirmar en `openapi.json` y código identity. |
| R-006 | Consentimiento de datos estructurado | **Pendiente en diccionario** | Diccionario aún describe `consentimiento_datos` genérico | Proponer esquema mínimo estructurado y migración/dominio. |
| R-007 | Acudiente sin acceso por defecto | **Abierto** | PA-004 sigue abierta | Mantener bloqueo antes de C2 para alcance acudiente. |
| R-008 | Convención `periodo` y `dia_semana` | **Pendiente de formalización** | Diccionario marca propuesta; contratos/código deben confirmarse | Confirmar convención única y validar en dominio/BD/API. |
| R-009 | Estados/unicidad/criticidad notificaciones | **Parcial** | Adenda R-020 extiende; módulo notifications existe | Verificar modelo final, unicidad `(usuario_id,evento,canal)` y eventos críticos. |
| R-010 | Idempotencia asistencia masiva | **Parcial** | Módulo academic B existe; requiere verificación de contrato/prueba | Confirmar semántica PUT/idempotencia y cobertura de prueba. |
| R-011 | Ámbito propio/grupo | **Parcial** | R-023 detalla tabla de ámbito; guards implementados en código | Verificar casos 403/404/filtrado en pruebas de integración. |
| R-012 | Códigos de error estables | **Parcial** | OpenAPI y filtros de errores existen | Confirmar catálogo completo y mapeo Problem Details. |
| R-013 | Canonicidad OpenAPI y `packages/contracts` | **Abierto** | Coexisten YAML propuesto y `packages/contracts/openapi.json` generado | Decisión C0/C1: fuente canónica, generación, diff de ruptura. |
| R-014 | Vigencia perfiles/revocación sesiones | **Parcial** | Identity/auth implementados; requiere verificación contra reglas finales | Confirmar revocación al expirar/desactivar y cobertura de pruebas. |
| R-015 | Ubicación `docs/reviews/` | **Aplicado de facto** | Existe `docs/reviews/c0..c8` | Confirmar cierre de PA-001. |
| R-016 | `.gitignore` artefactos agentes | **Aplicado** | `.gitignore` actualizado; entregables docs versionados | Confirmar cierre de PA-008. |
| R-017 | Idioma identificadores | **Aplicado de facto** | Permisos/códigos en inglés, dominio en español | Confirmar formalización C0. |

## 3. Estado R-018..R-031 (adenda Rol B)

| R | Tema | Estado observado | Impacto Rol A | Acción Rol A |
| --- | --- | --- | --- | --- |
| R-018 | `academic:enrollment:read` a educador | Probable en matriz/OpenAPI/código | Modelo de autorización/consultas | Verificar alcance por grupo y no exposición de PII extra. |
| R-019 | Rutas de lectura académica | Probable en contratos/código | Endpoints/dominio | Verificar propiedad de datos y consistencia con diccionario. |
| R-020 | Permisos de notificaciones/preferencias | Probable en catálogo/OpenAPI | Modelo notificaciones | Verificar unicidad, criticidad y estados (R-009). |
| R-021 | Contrato auth v1.0 | Presente en docs/código | Identidad/sesiones | Revisar alineación con diccionario y migraciones public. |
| R-022 | Alcance implicaciones/permisos reservados | Documentado | Catálogo/guardas | Verificar que permisos reservados no expongan operaciones. |
| R-023 | Propiedad y ámbito | Documentado | Consultas y autorización fila | Revisar implementación en repositorios/servicios academic/notifications/files. |
| R-024 | Horarios como subrecurso de grupo | Propuesto | Modelo academic/contrato | Confirmar decisión PA-013 y reflejo en diccionario/migraciones. |
| R-025 | Cifrado documento + hash ciego | **Brecha en diccionario** (RC-A-01) | PII, unicidad, búsqueda | Actualizar diccionario y verificar migración/código. |
| R-026 | `estudiante.usuario_id` opcional único | **Brecha en diccionario** (RC-A-04) | Vínculo cuenta-estudiante | Actualizar diccionario y verificar índice parcial/servicio. |
| R-027 | Columnas/tabla MFA y password | **Brecha en diccionario** (RC-A-03) | Modelo identidad | Actualizar diccionario y confirmar migraciones. |
| R-028 | Extensiones OpenAPI `x-*` | Observado en `openapi.json` | Contrato/CI | Confirmar generación canónica y cobertura CI. |
| R-029 | `files:document:read_own` a educador | Propuesto en adenda | Autorización archivos | Verificar regla `subido_por = sub` y pruebas. |
| R-030 | Auditoría consultable por recurso (`recurso_id`) | **Brecha en diccionario** (RC-A-02) | Modelo auditoría | Actualizar diccionario e índices; verificar migraciones/código. |
| R-031 | Catálogo de eventos como contrato | Presente en contratos/scripts CI | Auditoría/contratos | Confirmar eventos obligatorios cubiertos y proceso de cambio. |

## 4. Hallazgos de revisión cruzada C0 relevantes para Rol A

| ID | Hallazgo | Estado en diccionario actual | Prioridad | Acción propuesta |
| --- | --- | --- | --- | --- |
| RC-A-01 | `numero_documento` no puede ser único directo con ciphertext no determinista; falta `numero_documento_hash` | **Implementado en esquema/código; abierto en diccionario** | P0 | Migración `academic/0007_create_academic_core.ts` define `numero_documento_hash` (único, check hex). Código en `kysely-student.repository.ts`. Falta actualizar `docs/diccionario-datos.md` y ratificar R-025. |
| RC-A-02 | `evento_auditoria` sin `recurso_id` e índices de consulta por recurso/request | **Implementado en esquema/código; abierto en diccionario** | P0 | Migración `public/0002_create_evento_auditoria.ts` incluye `recurso_id` e índice `(recurso, recurso_id, ocurrido_en)`. Código en `audit` módulo. Falta actualizar diccionario y ratificar R-030. |
| RC-A-03 | Faltan `debe_cambiar_password`, `password_actualizado_en`, `codigo_recuperacion_mfa` | **Implementado parcialmente en esquema/código; abierto en diccionario** | P0 | Migración `public/0003_complete_identity_model.ts` agrega `debe_cambiar_password` y tabla `codigo_recuperacion_mfa`. Verificar `password_actualizado_en` y reflejar en diccionario; ratificar R-027. |
| RC-A-04 | `estudiante.usuario_id` sin regla nulo/único cuando existe | **Abierto en diccionario; verificar esquema/código** | P0 | Definir en diccionario nulo permitido + único parcial; confirmar índice parcial en migraciones academic y comportamiento `/me/student`. |
| RC-A-05..08 | Notas PII email, propiedad archivo, unicidad/criticidad preferencias, homogeneidad refs lógicas | **Abierto/Parcial** | P1 | Incorporar en actualización de diccionario tras ratificación. |

## 5. Divergencias contractuales a resolver

1. **Fuente canónica OpenAPI:** `packages/contracts/openapi.json` (propuesta histórica) vs `packages/contracts/openapi.json` (artefacto actual, 54 operaciones, con `x-*`). Se recomienda declarar canónico el generado y mantener YAML solo como referencia histórica/propuesta, o retirar/etiquetar claramente.
2. **R-003 vs estado actual:** la propuesta original decía "sin endpoints funcionales exports/analytics en v1.0 hasta C6". El repo actual incluye módulos/contratos de exports/analytics; debe registrarse enmienda formal o confirmarse alcance real.
3. **Diccionario vs implementación:** el diccionario está en estado It0; el esquema implementado evolucionó hasta C8. Se requiere actualización controlada por Rol A con trazabilidad a R/RC/ADR.
4. **Catálogo de permisos:** base R-001/R-002 y adenda R-018/R-020/R-022/R-029 deben consolidarse en una sola vista ratificada.

## 6. Plan de cierre propuesto (Rol A)

| Prioridad | Tarea | Entregable | Dependencia |
| --- | --- | --- | --- |
| P0 | Ejecutar integración en Docker/CI y registrar evidencia | **Hecho localmente**: test:integration 6/49 PASS; migrador up/down/up PASS por esquema en BD limpia | Docker/CI |
| P0 | Proponer actualización diccionario para RC-A-01..04 | PR/doc de propuesta Rol A + diff claro | Ratificación R-025..R-027,R-030 |
| P0 | Solicitar decisión de canonicidad OpenAPI | Nota en open-questions/ADR/acta C0 | Equipo A/B/C |
| P1 | Consolidar reconciliación R-001..R-031 en matriz única | Actualización de este documento o anexo | Ratificación equipo |
| P1 | Matriz trazabilidad Rol A CAR-01..CAR-12 | **Hecho**: `docs/tasks/rol-a/rol-a-trazabilidad-c8.md` | Baseline estable |
| P2 | Revisión de consultas/rendimiento y evidencia de carga/restauración | Registro Rol A It7/It8 | Entorno de pruebas |

## 7. Regla de no-deriva

- No se editaron `docs/diseno-arquitectonico.md` ni `docs/vision-alcance.md`.
- No se aplicaron cambios de modelo/contrato sin marcar como propuesta pendiente de ratificación.
- No se declararon PASS pruebas de integración no ejecutadas.
- Las brechas se registran con ID de fuente (R/RC/PA/ADR) para solicitud de cambio formal.
