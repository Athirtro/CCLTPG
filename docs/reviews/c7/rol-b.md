# Paquete de revisión — Iteración 7 (Rol B)

- **Fecha:** 23 de noviembre de 2026
- **Iteración:** C7 — Accesibilidad, responsividad y cabeceras (Release 3.0)
- **Rol:** B — Seguridad, identidad y operación
- **Estado:** **Compuerta 7 abierta para Rol B; no firmada ni publicada.** La verificación de accesibilidad real y el escaneo TLS dependen de Rol C y de entorno externo.
- **Plan:** `docs/tasks/rol-b/rol-b-it7-plan.md`
- **Registro:** `docs/tasks/rol-b/rol-b-it7-registro.md`
- **Predecesor:** C6 publicada en `0ecbe32` pero **no firmada**; su deuda (D89) no se reutiliza como evidencia de C7.

## 1. Alcance revisado

Rol B entrega cabeceras HTTP, CSP exacta (PA-010), HSTS condicionado a producción, Problem Details legibles y trazabilidad. No se evalúan pantallas, contraste, foco, lector de pantalla, responsive 360/768/1024/1440, cliente generado ni mocks: eso pertenece a Rol C y se marca como pendiente, no se prescribe.

## 2. Matriz de trazabilidad CAR-11 / AC-SEC-23

| Criterio | Evidencia Rol B | Estado |
| --- | --- | --- |
| C-36 — `nosniff`, referrer, permisos, COOP/CORP, CSP sin `unsafe-eval` | `security-headers.spec.ts` (valores exactos y CSP completa); `CSP_DIRECTIVES` en `configureApp` | ✅ Verificado por prueba |
| PA-010 — directivas CSP exactas compatibles con MUI/emotion | `docs/contratos/cambios/cambio-csp-c7.md`; `style-src 'self' 'unsafe-inline'` documentado como mínimo para emotion | ✅ Cerrado para la API; seguimiento de cliente en Rol C |
| C-20 — HSTS/TLS | `hstsOptions()` + prueba de configuración en `security-headers.spec.ts` | ⚠️ Configuración verificada; **escaneo TLS en preproducción pendiente** |
| C-23 — errores comprensibles y sin fuga | `problem-details.filter.spec.ts`: `code`, `title`, `requestId`, `instance`, `detail` sin HTML/SQL/PII | ✅ Verificado por prueba |
| CAR-11 — auditoría automatizada | Sin autorización de dependencia nueva; `axe` no instalado | ⚠️ **Pendiente** (deuda D95) |
| CAR-11 — recorrido manual (teclado, lector de pantalla) | Fuera de Rol B (D96) | ⚠️ **Pendiente de Rol C** |
| ON-1 / responsive 360/768/1024/1440 | Fuera de Rol B (D97) | ⚠️ **Pendiente de Rol C** |
| AC-SEC-23 / C7 — cabeceras y TLS verificados en preproducción | Solo local; sin entorno TLS | ⚠️ **Parcial** |
| Contrato 54/4/37/64 sin deriva | `contracts:generate` sin cambios; ver regresión | ✅ Verificado localmente |
| Firma / etiqueta `release-3.0` | No se firma ni etiqueta; C8 no se inicia | ⏳ Pendiente de aceptación final |

Una fila ⚠️ o ⏳ **no** cuenta como cumplida para firmar la compuerta.

## 3. Verificación ejecutada

Regresión local (resultados en el momento de cierre de este paquete):

| Comando | Resultado |
| --- | --- |
| `pnpm format:check` | ✅ verde |
| `pnpm typecheck` | ✅ verde |
| `pnpm lint` | ✅ verde |
| `pnpm build` | ✅ verde |
| `pnpm test` | ✅ API 33/420; web 2/13 |
| `pnpm test:integration` (PostgreSQL 16 real, harness local) | ✅ 6/49 |
| `pnpm arch:check` | ✅ 282 módulos, 1008 dependencias, 0 violaciones |
| `pnpm test:architecture` | ✅ 3 pruebas |
| `pnpm test:contracts` | ✅ 14 pruebas |
| `pnpm contracts:validate` | ✅ 54/4/64 |
| `pnpm contracts:generate` (sin deriva) | ✅ sin cambios en `packages/contracts` |
| `pnpm contracts:lint` | ✅ 0 errores, 36 advertencias preexistentes |
| `pnpm test:security` | ✅ 6 pruebas |
| `pnpm security:secrets` | ✅ sin hallazgos |
| Pruebas focales C-36/C-20/C-23 | ✅ 15/15 |

Además, se corrigió el lector de enmiendas del catálogo (`catalog.mjs`) para que una enmienda sin eventos nuevos —como la de CSP de C7— no altere `events.json`, con prueba de no deriva añadida. Ninguna verificación local sustituye la evidencia externa.

## 4. Deuda que se arrastra

1. **D89 (de C6):** RB1-43 a RB1-48, firma de C0/C1/C3/C4/C5/C6, Rol C y evidencia externa. No reutilizable como evidencia de C7.
2. **D95:** auditoría axe en CI sin autorización de dependencia nueva.
3. **Entorno:** sin preproducción TLS; sin CI de GitHub observable; sin k6, Docker/MinIO ni simulacro de respaldo/restauración.
4. **Rol C:** cliente no regenerado, mocks presentes y demo con pantallas reales no ejecutada; accesibilidad visual/manual y responsividad sin verificar.
5. **C7:** no se firma ni publica; `release-3.0` se evalúa en C8.

## 5. Conclusión

La parte de Rol B de C7 está implementada y verificable localmente en lo que respecta a cabeceras, CSP, HSTS (configuración) y Problem Details. La compuerta **no se cierra**: faltan actas de entorno TLS, auditoría automatizada autorizada y evidencia de Rol C. No se realiza `git commit` ni `git push`.
