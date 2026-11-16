# Gramática y catálogo de permisos v1 (propuesta)

- **Estado:** Propuesta — **pendiente de aprobación en Compuerta 0** (resoluciones propuestas documentadas en `docs/contratos/reconciliacion-c0.md`, R-001/R-002/R-011/R-017).
- **Origen:** propuesta formal recibida en conversación del equipo; refina el capítulo 8 de `docs/diseno-arquitectonico.md`.
- **Alcance:** definición generalista de gramática, semántica, catálogo cerrado v1.0 y asignación por perfil. No es vinculante hasta aprobación explícita del equipo.
- **Trazabilidad:** CAR-07, CAR-10, CAR-12 (visión/diseño); diseño caps. 3.3, 4.2, 8, 18.3.

## 1. Forma general

```text
permiso   ::= contexto ":" recurso ":" accion
contexto  ::= "identity" | "academic" | "audit" | "files"
            | "notifications" | "exports" | "analytics"
recurso   ::= identificador | "*"
accion    ::= "read" | "read_own" | "create" | "update" | "update_own"
            | "delete" | "export" | "manage"
```

## 2. Reglas de semántica

1. **Denegación por defecto.** Si ningún permiso concedido coincide con la solicitud, se rechaza.
2. **Comodín solo completo.** `*` puede ocupar el segmento de recurso, nunca una parte de él (`academic:stud*:read` no es válido).
3. **Implicación de acciones.** `manage` implica `create`, `read`, `update`, `delete` y `export` sobre ese recurso. `read` implica `read_own`. `update` implica `update_own`. Esto evita que un perfil tenga que enumerar permisos redundantes.
4. **Ámbito propio.** Un permiso `*_own` solo se satisface si el recurso pertenece al usuario autenticado, verificado en el servidor por fila. El guard primero comprueba el permiso y después la propiedad.
5. **Unión de perfiles.** Un usuario obtiene la unión de los permisos de todos sus perfiles vigentes (`valid_until` nulo o futuro).
6. **Sin permisos negativos.** No existen permisos de denegación explícita. Si se necesita restringir, se quita el permiso concedido.

## 3. Catálogo cerrado v1.0

> `exports` y `analytics` se incluyen en el catálogo para estabilidad de forma; su activación funcional se prevé en Iteración 6 (sujeto al plan aprobado).

| Contexto | Permisos |
| --- | --- |
| identity | `identity:user:manage`, `identity:profile:read`, `identity:profile:update`, `identity:temporary-identity:manage` |
| academic | `academic:program:manage`, `academic:group:manage`, `academic:group:read_own`, `academic:schedule:read`, `academic:schedule:read_own`, `academic:student:manage`, `academic:student:read_own`, `academic:enrollment:create`, `academic:enrollment:read`, `academic:enrollment:read_own`, `academic:enrollment:update`, `academic:enrollment:delete`, `academic:session:create`, `academic:session:update`, `academic:attendance:create`, `academic:attendance:update`, `academic:attendance:read`, `academic:evaluation:create`, `academic:evaluation:update`, `academic:evaluation:read`, `academic:evaluation:read_own`, `academic:indicator:manage` |
| audit | `audit:event:read` |
| files | `files:document:create`, `files:document:read_own`, `files:document:read` |
| notifications | `notifications:notification:read_own`, `notifications:preference:update_own` |
| exports | `exports:report:create`, `exports:report:export` |
| analytics | `analytics:kpi:read` |

## 4. Asignación por perfil (v1.0)

| Perfil | Permisos |
| --- | --- |
| Estudiante | `academic:enrollment:read_own`, `academic:schedule:read_own`, `academic:evaluation:read_own`, `academic:student:read_own`, `notifications:notification:read_own`, `notifications:preference:update_own`, `files:document:read_own` |
| Educador | `academic:group:read_own`, `academic:schedule:read_own`, `academic:session:create`, `academic:session:update`, `academic:attendance:create`, `academic:attendance:update`, `academic:attendance:read`, `academic:evaluation:create`, `academic:evaluation:update`, `academic:evaluation:read`, `files:document:create`, `notifications:notification:read_own` |
| Administrador | `identity:*:manage`, `academic:*:manage`, `audit:event:read`, `files:*:create`, `files:*:read`, `notifications:notification:read_own` |

**Nota:** el educador no debe ver matrículas ajenas a sus grupos. Esta restricción se plantea como condición adicional (ámbito de grupo) además del permiso; su implementación (guard, dominio o combinación) es una decisión abierta (PA-002).

## 5. Consideraciones de implementación (referencia)

- Toda ruta protegida debe declarar su permiso y evaluarse mediante guard global (denegación por defecto si no declara permiso).
- Permisos `*_own` requieren verificación de propiedad a nivel de fila en el servidor.
- Identidades temporales: vigencia controlada por `valid_until`; al vencer, desactivación y revocación de tokens según diseño (cap. 8.2, 9).
- La **matriz de autorización** (perfil × ruta × resultado esperado) es artefacto ejecutable y debe mantenerse completa en cada iteración relevante.

## 6. Diferencias observadas frente al diseño (cap. 8) — para reconciliación en C0

- La propuesta incorpora `update_own` en el vocabulario/semántica de acciones e implicaciones explícitas; el cap. 8.1 lo menciona en ámbito propio pero el listado fijo de acciones debe reconciliarse.
- La propuesta detalla un **catálogo cerrado** y asignaciones por perfil más específicas que los ejemplos del cap. 8.2 (p. ej. recursos/acciones adicionales o distintos, y uso de `*` acotado por segmento).
- Estas diferencias **no se corrigen en el documento de diseño** en esta iteración; se registran para decisión del equipo en Compuerta 0 (PA-006).

## 7. Decisiones abiertas relacionadas

- PA-002: ámbito de grupo del educador (guard/dominio).
- PA-003: convención de idioma en identificadores.
- PA-004: alcance de acceso para acudiente/identidad temporal.
- PA-006: aprobación/reconciliación de esta propuesta frente al cap. 8.
