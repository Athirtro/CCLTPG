# Plan de trabajo — Iteración 0 (Rol B)

- **Fecha:** 2026-11-16
- **Iteración / compuerta:** Iteración 0 / Compuerta 0
- **Responsable:** Rol B (seguridad, identidad y operación)
- **Estado:** Cerrado — tareas 0–9 completadas; paquete C0 entregado y pendiente de ratificación
- **Regla aplicada:** no se modifican artefactos congelados (`docs/diseno-arquitectonico.md`, `docs/vision-alcance.md`). Toda corrección se registra como propuesta en `docs/contratos/` y requiere ratificación del equipo en C0.

## 1. Objetivo

Cerrar en C0 todo lo que afecta a **contratos de API y modelo de datos** en el ámbito de seguridad, identidad y operación, y dejar como pregunta abierta (PA) con valor por defecto únicamente la configuración fina que se implementa en iteraciones posteriores.

## 2. Entregables

| # | Tarea | Artefacto | Estado |
| --- | --- | --- | --- |
| 0 | Inventario y trazabilidad de la superficie de seguridad | `docs/tasks/rol-b/rol-b-it0-inventario.md` | **Cerrada** (2026-11-16) |
| 1 | Revisión formal de gramática, catálogo y asignación por perfil | `docs/tasks/rol-b/rol-b-it0-revision-permisos.md` | **Cerrada** con reservas (bloqueantes B-01…B-05) |
| 2 | Contrato de autenticación, sesión, errores y CSRF | `docs/contratos/auth-v1.md` + ADR-0002 | **Cerrada** (propuesta para C0) |
| 3 | Matriz de autorización preliminar v0.1 | `docs/contratos/matriz-autorizacion-v1.md` | **Cerrada** (2026-11-16; 48 operaciones, 8 celdas † pendientes de ratificación) |
| 4 | Modelo de auditoría e inmutabilidad | `docs/contratos/modelo-auditoria-v1.md` + `docs/adr/ADR-0004-auditoria-inmutable.md` | **Cerrada** (2026-11-16; 59 eventos, inmutabilidad y pruebas definidas) |
| 5 | Lista de controles de seguridad acordados | `docs/contratos/controles-seguridad-v1.md` | **Cerrada** (2026-11-16; 46 controles) |
| 6 | Criterios de aceptación de seguridad (CAR-07/CAR-12) | `docs/requirements/seguridad.md` | **Cerrada** (2026-11-16; 33 AC-SEC + 15 AC-AUD) |
| 7 | Registro de decisiones (ADR/PA/SUP y adenda R-018…) | `docs/adr/README.md` + `docs/contratos/reconciliacion-c0-rol-b.md` | **Cerrada** (2026-11-16; ADR, D1…D26, R-001…R-031, PA y SUP consolidados) |
| 8 | Revisión cruzada con Rol A y Rol C | `docs/reviews/c0/revision-cruzada.md` + `docs/reviews/c0/cobertura-requisitos.md` | **Cerrada** (2026-11-16; 8 bloqueantes, 7 no bloqueantes y cobertura de los 12 CAR con PA-017) |
| 9 | Paquete de revisión C0 | `docs/reviews/c0/rol-b.md` | **Cerrada** (2026-11-16; entregado, no firmado) |

## 3. Decisiones cerradas por Rol B (C0)

| ID | Decisión | Artefacto |
| --- | --- | --- |
| D1 | Gramática y semántica de permisos aprobadas (R-001), condicionadas a las correcciones B-01…B-05 | Revisión de permisos |
| D2 | Denegación por defecto con lista blanca explícita de rutas públicas | ADR-0001 |
| D3 | Ámbito de grupo del educador evaluado en guard + refuerzo en dominio | ADR-0001 |
| D4 | Matriz de autorización documental en C0 y ejecutable en C2 | ADR-0001 |
| D5 | `actor_perfil` = perfil que autorizó la operación; `X-Perfil-Activo` solo desambigua | ADR-0001 / `auth-v1` |
| D9 | Cifrado de `numero_documento` + índice ciego para unicidad | ADR-0003 |
| D10 | Access token JWT 15 min + denylist; refresh opaco rotativo 7 días | ADR-0002 |
| D11 | Bloqueo tras 5 intentos; desbloqueo solo por administrador | `auth-v1` §8 |
| D12 | CSRF de doble envío para operaciones mutantes; refresh/logout con CSRF + Origin | ADR-0002 / `auth-v1` §7 |
| D13 | Lista cerrada de notificaciones críticas no silenciables | Adenda R-020 |
| D15 | Educador recibe `academic:enrollment:read` con ámbito de grupo (roster) | Adenda R-018 |
| D16 | Permisos de notificaciones corregidos (`update_own`, `preference:read_own`) | Adenda R-020 |
| D17 | Contrato de auth v1.0: MFA, recuperación, password, errores estables | Adenda R-021 / `auth-v1` |
| D18 | Permisos declarados de forma legible por máquina en OpenAPI (`x-permission`) | Adenda R-028 |
| D19 | Cifrado de documento y búsqueda por índice ciego | Adenda R-025 |
| D20 | Adiciones al modelo de identidad (`debe_cambiar_password`, códigos MFA) | Adenda R-027 |
| D21 | `email` permanece en claro como identificador de login, con controles compensatorios; si “contacto” incluye email, se cifra con índice ciego antes de C2 | ADR-0003 / R-025 |
| D22 | El educador recibe `files:document:read_own` para descargar el material que sube (propiedad = `subido_por`) | `matriz-autorizacion-v1` / R-029 |
| D23 | Auditoría de solo inserción, escrita en la misma transacción (fallo cerrado), con corrección por compensación y sin cadena de hashes en v1.0 | ADR-0004 / `modelo-auditoria-v1` |
| D24 | `recurso` = tipo, `recurso_id` + índices, y catálogo de eventos como contrato validado en CI | R-030 / R-031 / `modelo-auditoria-v1` §3 |
| D25 | 46 controles de seguridad con verificación, compuerta y responsable | `controles-seguridad-v1` |
| D26 | 33 criterios de aceptación de CAR-07 y 15 de CAR-12 | `docs/requirements/seguridad.md` |

> **D6, D7, D8 y D14** (inmutabilidad de auditoría, redacción, meta-auditoría y retención) quedan cerradas con ADR-0004 y `modelo-auditoria-v1` §§4–9. D6/D7/D8 requieren la migración de C2 (R-030); D14 mantiene la retención como PA-011 con valor por defecto (≥ 5 años).

## 4. Decisiones que requieren aprobación del equipo

- **PA-006 / cap. 8:** ratificar la gramática y el catálogo como versión v1.0 y tramitar solicitud de cambio si se enmienda el diseño.
- **R-018 / R-019 / R-020 / R-021 / R-028 / R-029 / R-030 / R-031:** cambios de catálogo, rutas, extensiones de contrato y modelo de auditoría.
- **PA-004 / acudiente:** se mantiene sin acceso por defecto; bloqueante antes de C2 para ese alcance.
- **R-003:** `exports`/`analytics` presentes en catálogo y sin endpoints hasta C6.
- **PA-011:** plazos de retención de auditoría y PII (valor por defecto hasta C8).
- **PA-016:** sellado criptográfico de auditoría (valor por defecto: sin cadena hasta C8).

## 5. Criterio de salida de C0 (Rol B)

1. Gramática y catálogo firmados o con objeciones cerradas; PA-006 resuelta.
2. Matriz v0.1 con las **48 operaciones** (35 vigentes + 13 propuestas): ninguna sin acceso o permiso declarado, con caso permitido y denegado, columna de ámbito y casos 404 fuera de ámbito.
3. Modelo de auditoría con inmutabilidad verificable en base de datos: **cumplido** en `modelo-auditoria-v1.md` §5 (privilegios + disparador + pruebas T-AUD-01…05); la migración se ejecuta en C2.
4. Lista de controles de seguridad con verificación y compuerta asignada: **cumplida** en `controles-seguridad-v1.md` (46 controles).
5. Criterios de aceptación de CAR-07 y CAR-12 escritos: **cumplidos** en `docs/requirements/seguridad.md` (33 + 15).
6. Decisiones registradas; artefactos congelados intactos o con solicitud de cambio.
7. Paquete de revisión C0 entregado y aprobación humana solicitada antes de C1.
8. Cierre global: las 5 condiciones P0 de `docs/reviews/c0/estado-cierre.md` §4 están cumplidas. **No cumplidas a la fecha**: dependen de Rol A, Rol C y la ratificación del equipo.

## 6. Traspaso a otros roles

| Rol | Qué debe hacer | Evidencia |
| --- | --- | --- |
| Rol A | Aplicar RC-A-01…04 en `docs/diccionario-datos.md` | Revisión cruzada cerrada |
| Rol C | Aplicar RC-C-01…04 en catálogo y OpenAPI | 48 operaciones cubiertas |
| Equipo | Ratificar ADR, R-018…R-031 y PA-006; confirmar PA-001/003/005 | Acta de C0 |
| Rol A/C | Resolver el catálogo de requisitos funcionales: ratificar PA-017 o crear el catálogo formal | `docs/reviews/c0/cobertura-requisitos.md` |

## 7. Qué no se hizo

- No se implementó código, migraciones, Docker ni CI (corresponden a C1/C2).
- No se modificó el OpenAPI ni el catálogo de permisos: las correcciones se registran como propuestas para que Rol C las formalice y el equipo las ratifique.
- No se modificaron documentos congelados.
