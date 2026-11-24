# Propuesta Rol A — actualización `docs/diccionario-datos.md` (v1.1 borrador)

- **Fecha:** 2026-11-24
- **Rol:** A (Backend, dominio y datos)
- **Estado:** Propuesta pendiente de ratificación C0/equipo. No modifica artefactos congelados.
- **Objetivo:** alinear el diccionario con el esquema/código observado y con hallazgos RC-A-01..04 / R-025..R-027, R-030.

## 1. Contexto

El diccionario `docs/diccionario-datos.md` quedó en estado "Borrador de Iteración 0". El repositorio avanzó hasta C8 y las migraciones/código ya incorporan varios cambios de seguridad/modelo. Esta propuesta documenta los ajustes necesarios para que el diccionario sea una fuente confiable para Rol A.

## 2. Cambios propuestos (P0)

### RC-A-01 / R-025 — `academic.estudiante.numero_documento`

**Estado observado:** migración `academic/0007_create_academic_core.ts` ya crea `numero_documento_hash text not null` con unique + check hex; código usa `numeroDocumentoHash`.

**Cambio propuesto en diccionario:**
- Reemplazar definición actual de `numero_documento` como `text` único por:
  - `numero_documento` (text/ciphertext, **Sensible**, cifrado app AES-256-GCM, formato `v1:<kid>:...`), nulo según regla de negocio.
  - `numero_documento_hash` (text, No nulo, único, HMAC-SHA256 hex de 64 chars) para igualdad/deduplicación.
- Eliminar índice `estudiante(numero_documento)`; agregar `estudiante(numero_documento_hash)` único.
- Nota: sin búsqueda parcial ni ordenamiento por documento.

### RC-A-02 / R-030 — `public.evento_auditoria`

**Estado observado:** migración `public/0002_create_evento_auditoria.ts` incluye `recurso_id uuid` e índice `(recurso, recurso_id, ocurrido_en)`.

**Cambio propuesto en diccionario:**
- Agregar `recurso_id` (uuid, Sí nulo en consultas de colección, referencia lógica al recurso afectado).
- Documentar `recurso` como tipo lógico del recurso (no instancia).
- Confirmar/agregar índices: `(recurso, recurso_id, ocurrido_en)`, `(accion, ocurrido_en)`, `(request_id)`.
- Documentar `actor_perfil` como perfil que otorgó el permiso efectivo.

### RC-A-03 / R-027 — identidad/MFA/password

**Estado observado:** migración `public/0003_complete_identity_model.ts` agrega `usuario.debe_cambiar_password` y tabla `codigo_recuperacion_mfa`. No se observó `password_actualizado_en` en migraciones/código.

**Cambio propuesto en diccionario:**
- Agregar a `public.usuario`: `debe_cambiar_password` (boolean, No nulo, default false).
- Agregar `password_actualizado_en` (timestamptz, Sí nulo) **solo si se confirma en migración/código o se aprueba su incorporación**; mientras tanto marcar como "propuesto por R-027, pendiente de evidencia de implementación".
- Agregar tabla `public.codigo_recuperacion_mfa`:
  - `id` uuid PK
  - `usuario_id` uuid FK lógica/real según convención del esquema
  - `codigo_hash` text, No nulo
  - `usado_en` timestamptz, Sí nulo
  - `creado_en` timestamptz, No nulo
  - Índice `(usuario_id, usado_en)`.
- Nota: códigos Argon2id, de un solo uso, regenerados en bloque.

### RC-A-04 / R-026 — `academic.estudiante.usuario_id`

**Estado observado:** migración `academic/0007_create_academic_core.ts` define `usuario_id uuid` nullable y unique index parcial `where usuario_id is not null`.

**Cambio propuesto en diccionario:**
- Cambiar `usuario_id` de "Sí/No, definir obligatoriedad" a: "Sí nulo permitido; **único cuando existe** (índice parcial). Referencia lógica a `public.usuario(id)`. No se crea cuenta automáticamente."
- Documentar comportamiento `/me/student`: 404 `RESOURCE_NOT_FOUND` si no hay vínculo.

## 3. Cambios propuestos (P1)

| ID | Cambio | Fuente |
| --- | --- | --- |
| RC-A-05 | Documentar `public.usuario.email` como identificador de login y PII con controles compensatorios; excepción de email en claro sujeta a decisión | R-025, ADR-0003 |
| RC-A-06 | Añadir nota a `public.archivo.subido_por`: propiedad para `files:document:read_own` en v1.0 | R-029 |
| RC-A-07 | Fijar unicidad `(usuario_id, evento, canal)` y regla de no silenciabilidad de eventos críticos en `preferencia_notificacion` | R-009, R-020 |
| RC-A-08 | Homogeneizar tipo/nulabilidad de referencias lógicas cruzadas | Revisión cruzada C0 |

## 4. Impacto y riesgos

- **Impacto:** documentación y gobernanza; varias partes ya están implementadas en esquema/código. La actualización reduce drift.
- **Riesgo si no se aplica:** onboarding, auditorías y futuras migraciones pueden basarse en diccionario incorrecto.
- **Riesgo si se aplica sin ratificación:** puede consolidar decisiones R-025..R-031 aún no ratificadas formalmente.

## 5. Plan de aplicación sugerido

1. Ratificar R-025/R-026/R-027/R-030 (o registrar excepciones).
2. Actualizar `docs/diccionario-datos.md` en un cambio controlado con referencia a esta propuesta.
3. Verificar consistencia con migraciones, modelos Kysely y contratos.
4. Agregar verificación de documentación/modelo en checklist de compuerta/revisión.
