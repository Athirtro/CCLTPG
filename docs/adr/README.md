# Registro de decisiones — Compuerta 0

- **Estado:** Índice consolidado de Rol B para **ratificación en Compuerta 0**.
- **Fecha:** 2026-11-16
- **Alcance:** una sola vista de ADR, decisiones (D-nn), resoluciones (R-nn), preguntas abiertas (PA-nn) y supuestos (SUP-nn) que afectan a seguridad, identidad, contratos y operación.
- **Fuente de verdad:** cada fila enlaza al artefacto que contiene la decisión completa; este índice no la reemplaza. Si hay contradicción, prevalece el artefacto enlazado y se corrige el índice.

## 1. Cómo se registra una decisión

| Tipo | Cuándo se usa | Dónde vive | Quién aprueba |
| --- | --- | --- | --- |
| **ADR-nnnn** | Decisión arquitectónica con alternativas y consecuencias | `docs/adr/` | Rol autor + ratificación del equipo en la compuerta |
| **D-nn** | Decisión de alcance tomada por un rol dentro de su ámbito | Plan del rol (`docs/tasks/rol-b/rol-b-it0-plan.md`) | Rol autor; el equipo ratifica solo lo que cambia contratos |
| **R-nn** | Resolución de un conflicto entre documentos o propuesta de cambio | `docs/contratos/reconciliacion-c0.md` (R-001…R-017) y `reconciliacion-c0-rol-b.md` (R-018…R-031) | Equipo en C0; formaliza el rol dueño del artefacto |
| **PA-nn** | Pregunta abierta con valor por defecto | `docs/open-questions.md` | Dueño indicado en su compuerta |
| **SUP-nn** | Supuesto explícito que, si falla, cambia el diseño | `docs/assumptions.md` | Equipo; se revisa al cambiar la premisa |

Reglas:

1. Una decisión no se considera cerrada hasta que su artefacto dueño la refleja y, si cambia un documento congelado, existe solicitud de cambio aprobada.
2. Un ADR aceptado por un rol **no** es vinculante hasta la ratificación de la compuerta; su estado lo dice explícitamente.
3. Los IDs son estables: una decisión retirada se marca obsoleta, no se reutiliza su número.

## 2. ADR

| ADR | Título | Estado | Ámbito | Compuerta de verificación |
| --- | --- | --- | --- | --- |
| [ADR-0001](ADR-0001-autorizacion-denegacion-por-defecto.md) | Autorización con denegación por defecto, ámbito y matriz ejecutable | Aceptada por Rol B; pendiente ratificación C0 | Guard global, `x-*`, ámbito propio/grupo, 403 vs 404 | C0 (diseño), C2 (ejecución), C4 (ámbito académico) |
| [ADR-0002](ADR-0002-sesion-tokens-revocacion.md) | Sesión con access token corto, refresh rotativo y revocación | Aceptada por Rol B; pendiente ratificación C0 | JWT 15 min + denylist, refresh opaco 7 días, CSRF, logout | C2 |
| [ADR-0003](ADR-0003-cifrado-columnas-sensibles.md) | Cifrado de columnas sensibles e índice ciego | Aceptada por Rol B; pendiente ratificación C0 | AES-256-GCM, HMAC-SHA256, `email` en claro con excepción | C2 (identidad), C4 (académico), C8 (privacidad) |
| [ADR-0004](ADR-0004-auditoria-inmutable.md) | Auditoría de solo inserción, transaccional y minimizada | Aceptada por Rol B; pendiente ratificación C0 | Privilegios + disparador, misma transacción, compensación, sin hash chain | C0 (modelo), C2 (pruebas), C8 (retención/sellado) |

## 3. Decisiones de Rol B (C0)

| ID | Decisión | Artefacto | Estado |
| --- | --- | --- | --- |
| D1 | Gramática y semántica de permisos aprobadas, condicionadas a B-01…B-05 | `rol-b-it0-revision-permisos.md` | Cerrada con reservas; ratificación C0 |
| D2 | Denegación por defecto con lista blanca pública explícita | ADR-0001 | Cerrada |
| D3 | Ámbito de grupo evaluado en guard y reforzado en dominio | ADR-0001 | Cerrada |
| D4 | Matriz documental en C0 y ejecutable en C2 | ADR-0001 / `matriz-autorizacion-v1.md` | Cerrada |
| D5 | `actor_perfil` = perfil que autorizó; `X-Perfil-Activo` solo desambigua | ADR-0001 / `auth-v1.md` | Cerrada |
| D6 | Inmutabilidad de auditoría por privilegios y disparador | ADR-0004 §5 | Cerrada; migración en C2 |
| D7 | Redacción por lista blanca y minimización de payloads | ADR-0004 §5 / `modelo-auditoria-v1.md` §4 | Cerrada |
| D8 | Meta-auditoría de la consulta y acceso solo con `audit:event:read` | `modelo-auditoria-v1.md` §7 | Cerrada |
| D9 | Cifrado de `numero_documento` + índice ciego para unicidad | ADR-0003 | Cerrada |
| D10 | Access JWT 15 min + denylist; refresh opaco rotativo 7 días | ADR-0002 | Cerrada |
| D11 | Bloqueo tras 5 fallos; desbloqueo solo administrativo | `auth-v1.md` §8 | Cerrada |
| D12 | CSRF de doble envío; refresh/logout con CSRF + `Origin` | ADR-0002 / `auth-v1.md` §7 | Cerrada |
| D13 | Lista cerrada de notificaciones críticas no silenciables | R-020 | Cerrada; ratificación C0 |
| D14 | Retención de auditoría ≥ 5 años como valor por defecto | PA-011 / `modelo-auditoria-v1.md` §8 | Abierta (PA-011, C8) |
| D15 | Educador recibe `academic:enrollment:read` con ámbito de grupo | R-018 | Cerrada; ratificación C0 |
| D16 | Permisos de notificaciones corregidos (`update_own`, `preference:read_own`) | R-020 | Cerrada; ratificación C0 |
| D17 | Contrato de auth v1.0: estados, MFA, recuperación, errores estables | R-021 / `auth-v1.md` | Cerrada; ratificación C0 |
| D18 | Permisos legibles por máquina en OpenAPI (`x-*`) | R-028 | Cerrada; ratificación C0 |
| D19 | Cifrado de documento y búsqueda por índice ciego | R-025 / ADR-0003 | Cerrada; diccionario en C0 |
| D20 | Adiciones al modelo de identidad (`debe_cambiar_password`, códigos MFA) | R-027 | Cerrada; diccionario en C0 |
| D21 | `email` en claro como login con controles compensatorios | ADR-0003 / R-025 | Cerrada con excepción documentada |
| D22 | Educador recibe `files:document:read_own` (propiedad = `subido_por`) | R-029 | Cerrada; ratificación C0 |
| D23 | Auditoría transaccional, compensación y sin cadena de hashes en v1.0 | ADR-0004 | Cerrada |
| D24 | `recurso` = tipo, `recurso_id` + índices, catálogo de eventos como contrato | R-030 / R-031 | Cerrada; ratificación C0 |
| D25 | 46 controles de seguridad con verificación y compuerta | `controles-seguridad-v1.md` | Cerrada |
| D26 | 33 criterios CAR-07 + 15 de CAR-12 | `docs/requirements/seguridad.md` | Cerrada |

## 4. Resoluciones (R-nn)

| ID | Tema | Dueño de la formalización | Estado | Bloquea C0 |
| --- | --- | --- | --- | --- |
| R-001…R-002 | Gramática, catálogo y asignaciones | Rol C | Aprobadas para documentar; pendiente ratificación C0 | Sí (PA-006) |
| R-003 | `exports`/`analytics` sin endpoints en v1.0 | Rol C | Aprobada para documentar | No |
| R-004…R-006 | Matrícula, transiciones de usuario, consentimiento | Rol A | Aprobadas para documentar | Parcial (modelo) |
| R-007 | Acudiente sin acceso por defecto | Equipo | Bloqueada (PA-004) | No, bloquea C2 |
| R-008…R-014 | Convenciones, notificaciones, idempotencia, ámbito, errores, contratos, vigencia | Rol A/C | Aprobadas para documentar | Parcial |
| R-015…R-017 | Ubicación de revisiones, `.gitignore`, idioma de identificadores | Equipo | Aprobadas para documentar | No |
| R-018 | Roster y matrículas del educador | Rol C | Propuesta | Sí † |
| R-019 | Rutas de lectura académica | Rol C | Propuesta | Sí † |
| R-020 | Semántica y asignación de notificaciones | Rol C | Propuesta | Sí † |
| R-021 | Contrato de autenticación v1.0 | Rol C | Propuesta | Sí † |
| R-022 | Alcance de implicaciones y permisos reservados | Rol C | Propuesta | No (semántica) |
| R-023 | Resolución de propiedad y ámbito | Rol B/C | Propuesta | Sí (criterio) |
| R-024 | Horarios como subrecurso de grupo | Rol A/C | Propuesta | No (C4) |
| R-025 | Cifrado de documento e índice ciego | Rol A | Propuesta | Sí (modelo) |
| R-026 | Vínculo estudiante–usuario | Rol A | Propuesta | Sí (modelo) |
| R-027 | Modelo de identidad para MFA y contraseña | Rol A | Propuesta | Sí (modelo) |
| R-028 | Contrato legible por máquina en OpenAPI | Rol C | Propuesta | Sí † |
| R-029 | Descarga de archivos por el educador | Rol C | Propuesta | Sí † |
| R-030 | Modelo de auditoría consultable por recurso | Rol A | Propuesta | Sí (modelo) |
| R-031 | Catálogo de eventos como contrato | Rol C | Propuesta | Sí (contrato) |

† La matriz tiene 5 celdas marcadas que dependen de R-018, R-020 o R-029 (OP-22, OP-30, OP-32, OP-33, OP-34). Si una resolución cae, la matriz se recalcula antes de firmar C0.

## 5. Preguntas abiertas (PA-nn)

| PA | Tema | Valor por defecto | Dueño / compuerta | ¿Bloquea C0? |
| --- | --- | --- | --- | --- |
| PA-001 | Ubicación de paquetes de revisión | `docs/reviews/` | Equipo / C0 | Sí (confirmación) |
| PA-002 | Ámbito de grupo: guard o dominio | Guard + refuerzo en dominio | Equipo / C4 | No (criterio en C0) |
| PA-003 | Idioma de identificadores | Inglés permisos/códigos; español dominio | Equipo / C0 | Sí (confirmación) |
| PA-004 | Acudiente / identidad temporal | Sin acceso por defecto | Equipo / antes de C2 | No, bloquea C2 |
| PA-005 | Regeneración del cliente de API | En cada compuerta de contrato | Equipo / C0–C1 | Sí (proceso) |
| PA-006 | Ratificación de gramática y catálogo | Propuesta formal como v1.0 | Equipo / C0 | **Sí** |
| PA-007 | Detalle de esquemas OpenAPI | Completar en el contrato | Rol A/C / C0–C1 | Parcial |
| PA-008 | `.gitignore` de artefactos de agentes | Ignorar solo artefactos locales | Equipo / C0 | No |
| PA-009 | Valores de throttling | Tabla de `auth-v1` §8.1 | Rol B / C3–C5 | No |
| PA-010 | Directivas CSP | CSP base de `auth-v1` §7.3 | Rol B/C / C1–C7 | No |
| PA-011 | Retención de auditoría y PII | Auditoría ≥ 5 años | Rol B / C8 | No |
| PA-012 | Autoservicio de recuperación | Fuera de v1.0 (reset administrativo) | Rol B/C / C8 | No |
| PA-013 | Horarios: subrecurso o endpoints propios | Subrecurso de grupo (R-024) | Rol A/C / C4 | No |
| PA-014 | Separación de funciones administrativas | Un perfil administrador con MFA | Equipo / C8 | No |
| PA-015 | Ventana de gracia de refresh | Sin gracia; *single-flight* | Rol B/C / C2 | No |
| PA-016 | Sellado criptográfico de auditoría | Sin cadena de hashes | Rol B / C8 | No |
| PA-017 | Criterios funcionales de CAR-01…05 y CAR-09 | Caps. 7–10/R-003/R-009/R-020; AC antes de C3/C4/C6 | Rol A/C / C1 | **Sí** (satisface el criterio de C0) |

## 6. Supuestos (SUP-nn)

| SUP | Supuesto | Estado | Revisión |
| --- | --- | --- | --- |
| SUP-001…SUP-007 | Alcance web, exclusiones, sin integración con la Alcaldía, metas de disponibilidad, RPO/RTO, navegadores modernos | Vigentes | Al cambiar alcance o infraestructura |
| SUP-008 | Antimalware con interfaz y stub inicial | Vigente | C3 |
| SUP-009 | Gramática, catálogo y API v1 son propuestas hasta C0 | Vigente hasta C0 | C0 |
| SUP-010 | Paquetes de revisión en `docs/reviews/` | Provisional (PA-001) | C0 |
| SUP-011 | Artefactos de agentes no se versionan; entregables sí | Provisional (PA-008) | C0 |
| SUP-012 | SPA y API same-origin en producción | Vigente | Al cambiar despliegue |
| SUP-013 | Redis disponible; su caída es fallo cerrado (503) | Vigente | C2/C5 |

## 7. Checklist de ratificación C0

- [ ] Ratificar ADR-0001, ADR-0002, ADR-0003 y ADR-0004.
- [ ] Ratificar R-018, R-019, R-020, R-021, R-028, R-029, R-030 y R-031.
- [ ] Aceptar R-022…R-027 y confirmar la actualización del diccionario por Rol A (R-025/R-026/R-027/R-030).
- [ ] Cerrar PA-006 y confirmar PA-001, PA-003, PA-005.
- [ ] Ratificar PA-017 (criterios funcionales de CAR-01…05 y CAR-09) o crear el catálogo de requisitos equivalente.
- [ ] Confirmar que las 5 celdas † de la matriz quedan habilitadas.
- [ ] Aprobar el catálogo de 59 eventos de auditoría (R-031).
- [ ] Aprobar los 46 controles y los 48 criterios de aceptación como base de C1/C2.
- [ ] Registrar la solicitud de cambio si se enmienda el cap. 8 del diseño.

> Detalle completo de las resoluciones de Rol B: `docs/contratos/reconciliacion-c0-rol-b.md`. Detalle de las resoluciones de equipo: `docs/contratos/reconciliacion-c0.md`.
