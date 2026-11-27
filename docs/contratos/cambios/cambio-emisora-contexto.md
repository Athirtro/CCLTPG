# Enmienda CAR-2026-11-27-02 — Contexto emisora en la gramática de permisos

- **Fecha:** 27 de noviembre de 2026
- **Estado:** propuesta de gobernanza E0; pendiente de aprobación humana. **No modifica** `docs/contratos/gramatica-y-catalogo-permisos-v1.md` ni `docs/contratos/matriz-autorizacion-v1.md`.
- **Documento base:** `docs/contratos/gramatica-y-catalogo-permisos-v1.md` (congelado, v1.0). La matriz documental nueva es `docs/contratos/matriz-autorizacion-emisora-v1.md`.
- **Motivo:** el plan de integración Emisora R.A.C. (§5.1) exige permisos `emisora:recurso:acción` con la misma gramática y el mismo vocabulario de acciones del módulo general, sin crear un sistema de autorización paralelo.

## 1. Alcance

Esta enmienda añade **un solo contexto**, `emisora`, a la lista cerrada de contextos. No añade, quita ni renombra acciones; no cambia las reglas de semántica (denegación por defecto, comodín solo completo, implicación de `manage`, ámbito propio, unión de perfiles vigentes y ausencia de permisos negativos). Todos los permisos existentes de `identity`, `academic`, `audit`, `files`, `notifications`, `exports` y `analytics` conservan su significado.

La adición es registral: `PERMISSION_CATALOG` anexa las entradas `emisora:*` (EL-1: de 37 a 37+N) y `PROFILE_SEEDS` añade los 13 perfiles nuevos (EL-2: de 3 a 16), sin tocar las semillas ni los permisos ya vigentes.

## 2. Gramática resultante

```text
permiso   ::= contexto ":" recurso ":" accion
contexto  ::= "identity" | "academic" | "audit" | "files"
            | "notifications" | "exports" | "analytics" | "emisora"
recurso   ::= identificador | "*"
accion    ::= "read" | "read_own" | "create" | "update" | "update_own"
            | "delete" | "export" | "manage"
```

El vocabulario de acciones sigue siendo exactamente `read`, `read_own`, `create`, `update`, `update_own`, `delete`, `export` y `manage`. Los guiones son válidos en el recurso, pero no cambian la gramática ni las implicaciones: `manage` implica las acciones presentes en el catálogo para ese recurso, `read` implica `read_own` y `update` implica `update_own`. Como `expandPermissions` y `permissionsFor` solo materializan acciones **presentes en el catálogo**, cada recurso emisora declara explícitamente `read` y `manage` como mínimo, más las acciones concretas usadas por sus controladores; no basta con declarar solo `manage`.

## 3. Recursos emisora añadidos

Los 31 recursos siguientes se añaden al catálogo, sin modificar ningún recurso existente:

- `programacion`
- `rejilla`
- `convocatoria`
- `realizador`
- `proyecto`
- `comite`
- `grabacion`
- `asistencia-cabina`
- `audio`
- `informe`
- `incentivo`
- `resolucion`
- `patrocinio`
- `promo`
- `publicacion`
- `transmision`
- `viatico`
- `prestamo`
- `turno`
- `lectura`
- `bitacora`
- `obra`
- `derecho`
- `equipo`
- `inversion`
- `proyeccion`
- `actividad`
- `permiso-salida`
- `tramite`
- `planilla`
- `archivo-emisora`

Ejemplos válidos: emisora:programacion:update, emisora:rejilla:export, emisora:proyecto:read_own, emisora:incentivo:update, emisora:lectura:create y emisora:tramite:manage. Ningún permiso emisora es público.

## 4. Tiempo, fechas y límites

| Aspecto | Regla declarada |
| --- | --- |
| Zona horaria de negocio | `America/Bogota` (UTC-5, sin horario de verano). Se declara aquí y en la configuración de la API; la SPA convierte con el mecanismo de formato del shell. |
| Instantes | `timestamptz` UTC para todo instante (`creado_en`, `ocurrido_en`, `fecha_solicitud`, etc.). Nunca `timestamp without time zone`. |
| Fechas de calendario | `date` sin zona para `fecha_transmision`, `fecha_inclusion`, `anio`, franjas de la rejilla y ventanas de reporte. El contrato documenta ISO-8601 con offset para instantes y fecha civil para `date`. |
| Convocatoria de tres semanas | 3 semanas = 21 días calendario: `fecha_cierre = fecha_apertura + 21 días`, límite **inclusive** hasta las 23:59:59 en `America/Bogota`. Una convocatoria por año; fuera de plazo, `EMISORA_CONVOCATORIA_CERRADA`. |
| Mifi con dos días de antelación | `fecha_solicitud <= fecha_transmision - 2 días` en días calendario, **inclusive**. El mismo día o con un día de antelación se rechaza con `EMISORA_MIFI_ANTELACION_INSUFICIENTE`. |
| Informes oct/nov | Ventana del 1 de octubre al 30 de noviembre, **ambos inclusive**, evaluada sobre `date` en `America/Bogota`. Fuera de ventana, `EMISORA_FUERA_VENTANA_INFORME`. |
| Concurrencia | Las transiciones se protegen con bloqueo de fila y escriben la auditoría en la misma transacción; un conflicto responde 409 con código de dominio, nunca 500. |

## 5. Reglas de la enmienda

1. El contexto `emisora` se añade a la lista cerrada; ningún contexto existente se elimina, renombra ni cambia de semántica.
2. El vocabulario de acciones no se modifica: no se crean acciones como `approve`, `publish` ni `audit` propias de emisora.
3. Los 31 recursos de la sección 3 se registran con `read` y `manage` como mínimo; las acciones `*_own` se conceden solo donde el negocio las necesita y se verifican en servidor mediante `EmisoraOwnershipPolicy`, con `IdentityDirectory` como fuente del principal y sin SQL contra `public`.
4. `administrador` recibe una entrada adicional `emisora:*:manage`. No se le quita ni se le cambia ningún permiso; los tres perfiles existentes siguen vigentes con sus concesiones actuales.
5. Los 13 perfiles nuevos se definen en `PROFILE_SEEDS` (fuente única de verdad). `seedEmisora` solo carga datos de negocio y no crea perfiles ni permisos.
6. La gramática `contexto:recurso:acción` no admite comodines parciales: `emisora:pro*:read` sigue siendo inválido.
7. Esta enmienda no toca eventos de auditoría: esos se registran en `docs/contratos/cambios/cambio-emisora-eventos.md`. Ninguna operación emisora se declara pública y `public-routes.json` permanece intacto.

## Fuentes

- `docs/diseno-emisora.md` §§4.4, 5.1, 5.2 y 18 (I7, M1, I3).
- `docs/contratos/gramatica-y-catalogo-permisos-v1.md` §§1–3 (documento base congelado).
- `docs/contratos/matriz-autorizacion-emisora-v1.md` (matriz documental nueva, E0).
