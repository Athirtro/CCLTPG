# Paquete de revisión — Iteración 8 (Rol B)

- **Fecha:** 23 de noviembre de 2026
- **Iteración:** C8 — Endurecimiento y aceptación final (Release 3.0)
- **Rol:** B — Seguridad, identidad y operación
- **Estado:** **Compuerta 8 abierta; no firmada, no etiquetada y no publicada.** Faltan actas de entorno, evidencia de Rol C y la corrección de la deuda de calidad heredada.
- **Plan:** `docs/tasks/rol-b/rol-b-it8-plan.md`
- **Registro:** `docs/tasks/rol-b/rol-b-it8-registro.md`
- **Predecesor:** C7 ejecutada por Rol B en el commit local `8c06bb5` (`iteracion 7 rol b`), **sin push** (`origin/main` en `948f07a`), compuerta abierta. Su deuda no se reutiliza como evidencia de C8.

## 1. Alcance revisado

Rol B cierra PA-011 y PA-016 con enmiendas controladas, documenta el inventario de datos personales y la supresión por anonimización, revisa los runbooks de seguridad/operación y produce la matriz de trazabilidad. No evalúa pantallas, cliente, teclado, contraste, lector de pantalla ni responsive: pertenece a Rol C y se marca como pendiente, sin prescribir su solución. No se ejecutó DDL ni se modificaron documentos congelados.

## 2. Matriz de trazabilidad CAR-07 / CAR-12 / compuertas

| Criterio | Evidencia Rol B | Estado |
| --- | --- | --- |
| PA-011 — retención y supresión | `docs/contratos/cambios/cambio-retencion-c8.md`: auditoría ≥ 5 años, PII mientras dure la relación, respaldos equivalentes, anonimización del registro vivo sin borrar eventos | ✅ Cerrada documentalmente; ejecución sobre datos reales pendiente |
| PA-016 — integridad de auditoría | `docs/contratos/cambios/cambio-integridad-auditoria-c8.md`: sin cadena de hashes, privilegios + disparador + WAL + resumen firmado | ✅ Decisión cerrada; resumen operativo pendiente de entorno |
| AC-AUD-15 / C-25 — conservación y respaldo | Política de retención y runbooks revisados | ⚠️ **Parcial**: sin simulacro ni tiempos RPO/RTO medidos |
| C-26 — staging anonimizado | `docs/reviews/c8/inventario-datos-personales.md` y política de staging | ⚠️ **Parcial**: sin verificación de carga en entorno |
| C-46 / AC-SEC-33 — runbooks probados | Revisión de `docs/runbook/*` (ver §4) | ⚠️ **Parcial**: falta runbook dedicado de respaldo/restauración; simulacro pendiente |
| C-24 / C-43 / C-44 — secretos y suministro | `pnpm test:security` 6/6 y `pnpm security:secrets` sin hallazgos | ⚠️ SCA de dependencias, escaneo de imágenes, CI y doble `kid` pendientes |
| C-20 / C-36 / C-45 — TLS, cabeceras y observabilidad | Cabeceras CSP/HSTS verificadas localmente en C7 | ⚠️ Escaneo TLS, simulacro de alertas y ajuste de `RATE_LIMITS` pendientes |
| CAR-06 — carga y soak | Sin informe k6 | ⚠️ **Pendiente** de entorno y autorización de dependencia |
| CAR-11 — accesibilidad | Rol C y `axe` en CI | ⚠️ **Pendiente** (D95/D96/D97) |
| Trazabilidad | Esta matriz cubre PA-011, PA-016, AC-AUD-15, C-25, C-26, C-46, C-24, C-43/C-44, C-20/C-36/C-45, CAR-06 y CAR-11 | ✅ Matriz producida; filas ⚠️ no cumplidas |
| Contrato 54/4/37/64 | `contracts:validate` y `contracts:generate` sin deriva | ✅ Verificado localmente |
| Regresión local | Ver §3 | ⚠️ **Parcial**: `lint` y `format:check` globales fallan por código de Rol C (§3.1) |
| Firma / etiqueta `release-3.0` | No se firma ni etiqueta | ⏳ Pendiente de aceptación final |

Una fila ⚠️ o ⏳ **no** cuenta como cumplida para firmar la compuerta.

## 3. Verificación ejecutada

| Comando | Resultado |
| --- | --- |
| `pnpm typecheck` | ✅ verde (API y web) |
| `pnpm lint` | ❌ **15 errores** en `apps/web` (Rol C): `Archivos.tsx`, `Programas.tsx`, `Reportes.tsx`, `VistaEducador.tsx` |
| `pnpm build` | ✅ verde (API + web) |
| `pnpm format:check` | ❌ **6 archivos** sin formatear en `apps/web/src/pages/` (Rol C) |
| Prettier sobre archivos de Rol B | ✅ verde (plan, enmiendas, inventario, acta, registro, `iteraciones.md`) |
| `pnpm test` | ✅ API 33/420; web 2/15 |
| `pnpm test:integration` (PostgreSQL 16 real) | ✅ 6 archivos / 49 pruebas |
| `pnpm arch:check` | ✅ 282 módulos, 1008 dependencias, 0 violaciones |
| `pnpm test:architecture` | ✅ 3 pruebas |
| `pnpm test:contracts` | ✅ 14 pruebas |
| `pnpm contracts:validate` | ✅ 54 operaciones, 4 públicas, 64 eventos |
| `pnpm contracts:generate` | ✅ sin deriva en `packages/contracts` |
| `pnpm contracts:lint` | ✅ 0 errores, 36 advertencias preexistentes |
| `pnpm test:security` | ✅ 6 pruebas |
| `pnpm security:secrets` | ✅ sin hallazgos |

### 3.1 Deuda de calidad heredada (no corregida por Rol B)

Los fallos de `lint` y `format:check` provienen de los commits de **Rol C** `e80e4a3` y `948f07a` (`feat(web): …`), presentes en la historia antes de `8c06bb5`. Rol B no modificó esos archivos y no los corrige en C8: hacerlo exige decidir sobre el cliente y las pantallas, competencia de Rol C. Mientras no se corrijan, **la regresión global no está en verde** y C8 no puede aprobarse por este motivo, además de los pendientes de entorno.

## 4. Revisión de runbooks (C-46)

| Necesidad C-46 | Runbook existente | Estado |
| --- | --- | --- |
| Despliegue y diagnóstico | `docs/runbook/operacion.md`, `arranque-local.md` | Revisado; simulacro de despliegue pendiente |
| Reversión de esquema | `docs/runbook/migraciones.md` | Revisado; `down` explícito y preferencia por forward-fix |
| Incidente de seguridad | `docs/runbook/incidente-seguridad.md` | Revisado; notificación legal fuera de decisión técnica |
| Break-glass | `cambio-password-forzado.md`, `revocacion-sesiones.md` | Revisado; exige ticket aprobado |
| Rotación de secretos | `docs/runbook/rotacion-secretos.md` | Revisado; doble `kid` pendiente de entorno |
| **Respaldo y restauración** | **No existe runbook dedicado** | ⚠️ Hueco identificado; no se crea sin prueba asociada y entorno |

Ningún runbook se modificó en C8: el plan exige que cualquier cambio tenga una prueba asociada, y los simulacros dependen de entorno.

## 5. Deuda que se arrastra

1. **D89 (C5/C6):** RB1-43 a RB1-48 — cliente HTTP real, TLS, rotación con doble `kid`, simulacro de respaldo, alertas y k6; firma de C0…C6.
2. **C7:** commit local sin push (`8c06bb5` frente a `origin/main` `948f07a`), `axe` sin autorizar, escaneo TLS y evidencia WCAG/responsive de Rol C.
3. **C8:** deuda de calidad de Rol C (§3.1), sin runbook de respaldo/restauración, sin simulacro de PA-011/PA-016 operativos.
4. **Preguntas no cerradas por Rol B:** PA-004 (acudiente), PA-012 (autoservicio de contraseña), PA-014 (separación de funciones). Quedan registradas, no resueltas por este paquete.
5. **Entorno:** sin CI de GitHub observable, Docker/MinIO, preproducción TLS, k6 ni simulacro de respaldo.
6. **C8:** no se firma, no se etiqueta `release-3.0` y no se publica.

## 6. Conclusión

Rol B dejó cerradas documentalmente PA-011 y PA-016, con inventario de PII y trazabilidad de los controles a código/prueba. La compuerta **no se cierra**: hay deuda de calidad heredada de Rol C y evidencia externa pendiente. No se realizó `git commit`, `git push`, firma ni etiqueta.
