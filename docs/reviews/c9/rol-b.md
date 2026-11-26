# Paquete de revisión — Iteración 9 (Rol B)

- **Fecha:** 26 de noviembre de 2026
- **Iteración:** C9 — Cierre de deuda acumulada y aceptación final (Release 3.0)
- **Rol:** B — Seguridad, identidad y operación
- **Estado:** **Ejecución documental parcial de Rol B realizada; compuerta 9 abierta, sin firma, sin commit, sin push, sin etiqueta y sin publicación.** La deuda de entorno, las actas del equipo y varios entregables de Rol A/Rol C siguen abiertos.
- **Plan:** `docs/tasks/rol-b/rol-b-it9-plan.md`
- **Registro:** `docs/tasks/rol-b/rol-b-it9-registro.md`
- **Matriz:** `docs/reviews/c9/trazabilidad.md`
- **Runbook creado:** `docs/runbook/respaldo-restauracion.md`
- **Predecesor:** C8 ejecutada en `3df23ce` y ya en `origin/main` (`dd1079d`). Su push dejó de ser deuda; la compuerta sigue abierta (`docs/reviews/c8/rol-b.md`).
- **Autorización recibida:** actualizar el plan al estado real, producir matriz/paquete/registro y generar el runbook de respaldo/restauración. La orden **no** autorizó cambiar código de API/web, ratificar D110…D119, firmar, etiquetar ni publicar.

## 1. Alcance revisado

Rol B revisó los entregables de Rol A y Rol C incorporados entre `ddcac05` y `dd1079d`, verificó localmente la regresión y produjo los documentos de cierre de C9. No modificó código de otros roles ni contratos generados. La incidencia de `ChangePasswordDto` detectada por Rol C queda **asignada a Rol A** por decisión del usuario del 26-11; Rol B solo la registra (`docs/contratos/cambios/seguimiento-auth-cliente-c7.md` §2).

Los entregables de otros roles se tratan como insumos, no como aprobación de compuerta:

| Origen | Aporte | Efecto en C9 |
| --- | --- | --- |
| Rol C (`e62b1ba`, `2c35937`, `ede50bc`, `d0bc78b`, `7d0cec2`, `949c041`, `489aa0d`, `88b7c98`) | lint/format corregidos, mock retirado, responsive, axe sobre 21 páginas, teclado, token en memoria, Bearer/CSRF y CI documentada | RB1-89 ✅; RB1-90/RB1-91/RB1-93 parciales |
| Rol A (`864102f`) | baseline C0…C8, reconciliación R-001…R-031, matriz CAR y propuesta de diccionario v1.1 | RB1-81/RB1-85 con insumo, sin acta ni aplicación al diccionario |
| Contratos (`ddcac05`) | retirada de `api-v1.openapi.yaml`; `packages/contracts/openapi.json` canónico | RB1-86 ✅ documental; queda confirmación en acta |

## 2. Estado de las tareas RB1-80…RB1-103

Estado completo en `docs/tasks/rol-b/rol-b-it9-plan.md` §3. Resumen de lo que cambió respecto del plan original:

| Estado | Tareas | Detalle |
| --- | --- | --- |
| ✅ Cerradas o producidas por Rol B | RB1-80, RB1-84 (solo push), RB1-86, RB1-89, RB1-102, RB1-103 | Plan actualizado, C8 en `origin/main`, canonicidad documental, regresión verde, matriz y paquete/registro |
| ⚠️ Parciales | RB1-81, RB1-85, RB1-88, RB1-90, RB1-91, RB1-92, RB1-93, RB1-97, RB1-98 | Insumos o partes verificadas; queda acta, entorno o dueño específico |
| ⏳ Pendientes | RB1-82, RB1-83, RB1-84 (firmas), RB1-87, RB1-94, RB1-95, RB1-96, RB1-99, RB1-100, RB1-101 | Actas del equipo, cliente regenerado, entorno, simulacros y carga |

**RB1-98 — Runbook:** se crea `docs/runbook/respaldo-restauracion.md` con inventario (PostgreSQL, WAL/PITR, Redis AOF, MinIO y secretos), procedimiento de respaldo cifrado, restauración en entorno aislado, retención y diagnóstico. El documento declara explícitamente que **el simulacro no se ejecutó**: RPO/RTO siguen siendo objetivos, no resultados.

**RB1-102 — Trazabilidad:** `docs/reviews/c9/trazabilidad.md` consolida CAR-01…CAR-12 y C0…C9. Ningún CAR se marca completo para aceptación: todos tienen ⚠️ o ⏳ por actas, entorno o divergencia R-003.

## 3. Verificación ejecutada por Rol B

Comandos ejecutados el 26 de noviembre de 2026 sobre el árbol que contiene `dd1079d` más los cambios locales de C9:

| Comando | Resultado |
| --- | --- |
| `pnpm format:check` | ✅ verde |
| `pnpm typecheck` | ✅ API y web |
| `pnpm lint` | ✅ API y web; los 15 errores heredados ya no aparecen |
| `pnpm build` | ✅ API y web |
| `pnpm test` | ✅ API 33 archivos / 420 pruebas; web 3 archivos / 31 pruebas |
| `pnpm test:contracts` | ✅ 14/14 |
| `pnpm contracts:validate` | ✅ 54 operaciones, 4 públicas, 64 eventos |
| `pnpm contracts:generate` | ✅ sin deriva en `packages/contracts` |
| `pnpm contracts:lint` | ✅ 0 errores, 36 advertencias preexistentes |
| `pnpm test:security` | ✅ 6/6 |
| `pnpm security:secrets` | ✅ sin hallazgos |
| `pnpm arch:check` | ✅ 282 módulos, 1008 dependencias, 0 violaciones |
| `pnpm test:architecture` | ✅ 1 archivo / 3 pruebas |
| `pnpm test:integration` | ⚠️ 6 archivos / 49 pruebas `skipped` en este entorno; Rol A reporta PASS con PostgreSQL 16/Redis en Docker, pero Rol B no lo re-verificó |

La regresión local está en verde salvo la integración, que depende de entorno. El CI de GitHub aparece documentado por Rol C como run #24 (`7d0cec2`) con cuatro jobs en verde; este paquete **no** afirma haberlo re-ejecutado.

## 4. Hallazgos y decisiones de propiedad

1. **`ChangePasswordDto`:** `POST /auth/password` no acepta `sessionToken` (`apps/api/src/modules/identity/api/dto/auth.dto.ts:70`). Una cuenta con `debe_cambiar_password=true` no completa el primer acceso por HTTP. **Dueño: Rol A**, con la corrección propuesta en `seguimiento-auth-cliente-c7.md` §2. Rol B no toca este código.
2. **Canonicidad:** `ddcac05` retiró el YAML histórico y fijó `openapi.json`. Falta que el acta confirme PA-001/PA-007 y que ese archivo no se modifique sin enmienda controlada.
3. **Documento congelado:** `ddcac05` también tocó `docs/diseno-arquitectonico.md` (árbol de directorios). Debe registrarse en el acta como cambio controlado o tramitarse por `docs/contratos/cambios/*.md`. Rol B no lo modifica en C9.
4. **`axe-core`:** ya está declarado en `apps/web/package.json` desde `c4c906a` y se ejecuta en pruebas. No es una instalación nueva en C9; falta la ratificación formal de D95.
5. **CSP del SPA:** la enmienda C7 cubre la API. La cabecera del documento HTML del cliente sigue pendiente de despliegue (`seguimiento-csp-cliente-c7.md` §4).
6. **D110…D119:** continúan propuestas. La autorización recibida fue para ejecutar documentos de Rol B, no para ratificar decisiones ni firmar compuertas.

## 5. Deuda que impide cerrar la compuerta 9

| Deuda | Dueño |
| --- | --- |
| Actas y firmas de C0…C8; ratificación D27…D119 | Equipo |
| Aplicación de RC-A-01…04 al diccionario y catálogo formal CAR/PA-017 | Rol A |
| Corrección de `ChangePasswordDto` con prueba HTTP encadenada | Rol A |
| Regeneración del cliente desde `openapi.json` y demo reporte→exportación→KPI→notificación→auditoría | Rol C |
| Acta manual de lector de pantalla, tres navegadores y CSP del SPA desplegado | Rol C / Equipo |
| Confirmación formal de excepción `picomatch` y CI como evidencia de aceptación | Equipo / Rol B |
| TLS/preproducción, escaneo, doble `kid`, MinIO real, k6/soak, simulacro de alertas | Rol B / entorno |
| Simulacro de respaldo/restauración con RPO/RTO medidos y ejecución operativa de PA-011/PA-016 | Rol B / entorno |
| Stubs de correo, antimalware y almacenamiento: proveedor real o excepción firmada | Rol B / entorno |

## 6. Conclusión

Rol B entregó el inventario actualizado, la trazabilidad, el paquete, el registro y el runbook de respaldo/restauración, y verificó la regresión local. Varias tareas de C9 quedan resueltas por el trabajo de otros roles, pero **la compuerta 9 no se cierra**: faltan actas, ratificaciones, demo/evidencia de Rol C y evidencia de entorno. No se realizó `git commit`, `git push`, firma, etiqueta `release-3.0` ni publicación.
