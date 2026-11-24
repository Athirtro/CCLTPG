# Plan de trabajo — Iteración 8 (Rol B)

- **Fecha:** 23 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Iteración objetivo:** **C8 — Endurecimiento y aceptación final (Release 3.0)**
- **Estado:** **Ejecutado por Rol B; compuerta abierta.** La orden «comiensa con la itaracion 8» autorizó la ejecución de las tareas de Rol B. C8 **no se publica, no se firma ni se etiqueta**: faltan actas de entorno, evidencia de Rol C y corrección de la deuda de calidad heredada (`lint`/`format:check` en `apps/web`). Registro en `docs/tasks/rol-b/rol-b-it8-registro.md` y paquete en `docs/reviews/c8/rol-b.md`.
- **Predecesor:** C7 ejecutada por Rol B en el commit local `8c06bb5` (`iteracion 7 rol b`), **sin push, sin firma y sin publicación**; compuerta abierta por TLS/auditoría automatizada/evidencia de Rol C (`docs/reviews/c7/rol-b.md`).
- **Registro predecesor:** `docs/tasks/rol-b/rol-b-it7-registro.md`.
- **Paquete de revisión anterior:** `docs/reviews/c7/rol-b.md`.
- **Paquete de revisión a producir:** `docs/reviews/c8/rol-b.md`.
- **Registro a producir:** `docs/tasks/rol-b/rol-b-it8-registro.md`.
- **Requisitos:** `docs/vision-alcance.md` (CAR-07, CAR-08, CAR-11, CAR-12; ON-4), `docs/requirements/seguridad.md` (AC-SEC-32/33, AC-AUD-15; definición de terminado C8), `docs/diseno-arquitectonico.md` (§13, §14, §18.2, §19), `docs/contratos/controles-seguridad-v1.md` (C-20, C-24, C-25, C-26, C-36, C-43, C-45, C-46), `docs/contratos/modelo-auditoria-v1.md` (§8, §11), ADR-0003 y ADR-0004.
- **Preguntas a cerrar:** PA-011 (retención de auditoría/PII/archivos), PA-016 (sellado criptográfico), PA-014 (separación de funciones), PA-012 (autoservicio de contraseña), PA-009 (límites definitivos) y PA-010 (CSP, ya cerrada para la API en C7).
- **Contrato:** `packages/contracts/openapi.json` y `packages/contracts/events.json` (54 operaciones, 4 públicas, 37 permisos, 64 eventos); fuente canónica code-first.
- **Regla de alcance:** Rol B trabaja solo en API, seguridad, operación, contratos y evidencia. No define ni implementa pantallas, cliente, foco, contraste, lector de pantalla ni puntos de quiebre: pertenece a Rol C y no se prescribe aquí. No ejecuta DDL: las migraciones siguen siendo exclusivas de `ccltpg_migrador`.

## 1. Objetivo de la iteración

Preparar la parte de C8 que es responsabilidad de Rol B, sin anticipar la solución de Rol C ni declarar cerrada la aceptación final:

1. **Cerrar PA-011 y PA-016** con decisiones documentadas y enmiendas controladas cuando afecten a documentos congelados, sin editarlos.
2. **Revisar el inventario de datos personales y el procedimiento de supresión** compatible con la auditoría: anonimización del registro vivo, nunca borrado del evento (diseño §13, modelo §8).
3. **Dejar trazabilidad completa requisito → código → prueba** en `docs/reviews/c8/rol-b.md`, marcando como pendiente —nunca como verificado— todo lo que dependa de entorno, CI o Rol C.
4. **Registrar la deuda acumulada** (RB1-43…RB1-48 de C5, axe/TLS de C7, firma de C0…C7 y Rol C) como riesgos aceptados o pendientes, sin reutilizarla como evidencia de C8.

Según `docs/diseno-arquitectonico.md` §18.2, C8 comprende además escaneos de dependencias/contenedores, revisión de cabeceras, saneamiento de entradas, límites de tasa, gestión de secretos, configuración TLS, observabilidad, runbooks probados, prueba de carga y soak, documentación y matriz de trazabilidad. Rol B solo puede acreditar localmente lo que no requiera entorno; el resto queda condicionado.

**Fuera de alcance de este plan:** UI, componentes, teclado, lector de pantalla, contraste, responsive, regeneración del cliente y retirada de mocks (Rol C); manuales de usuario y administración (Rol A/C); retención/sellado ejecutados sobre datos reales sin autorización; proveedor SMTP/antimalware real, Docker/MinIO, CI de GitHub, k6, TLS de preproducción; firma, etiqueta `release-3.0` y publicación de C8.

### 1.1 Condición previa

C6 y C7 están **publicada/finalizada en código pero no firmadas**. C7 quedó en commit local sin push. Antes de ejecutar código de C8 se requiere:

- ratificación de D100–D109;
- decisión sobre PA-011 y PA-016 (opción A recomendada: política documentada y sin cadena de hashes, respectivamente);
- autorización expresa para cualquier dependencia nueva (`axe`, k6, escáner de contenedores) — sin ella no se instala;
- entorno con PostgreSQL de preproducción/TLS, CI observable y datos anonimizados para los actos de simulacro, escaneo y carga; sin entorno, esos criterios se marcan **pendientes**;
- confirmación de que Rol C ha cerrado la evidencia de C7 (informe WCAG, teclado, lector de pantalla, responsive y cliente regenerado) antes de proponer la aceptación final.

## 2. Criterios de salida y Compuerta 8

| Condición | Criterio verificable |
| --- | --- |
| PA-011 — retención | Política documentada con plazos por tipo de dato (auditoría ≥ 5 años, PII mientras dure la relación + plazo institucional, respaldos igual a auditoría) y procedimiento de supresión por anonimización, sin borrado de eventos ni DDL desde la API (AC-AUD-15, modelo §8). |
| PA-016 — integridad | Decisión documentada: sin cadena de hashes, inmutabilidad por privilegios/disparador/WAL y resumen firmado periódico como control operativo (ADR-0004); cualquier cambio exige enmienda y migración con `ccltpg_migrador`, no ejecutable sin autorización. |
| C-25 / C-26 — respaldos y staging | Runbook de cifrado, RPO ≤ 15 min y RTO ≤ 4 h, y procedimiento de carga anonimizada; simulacro con tiempos medidos y verificación de staging **pendientes de entorno**. |
| C-46 — runbooks | Revisión documental de despliegue, reversión, respaldo/restauración, incidente y break-glass; ningún runbook se modifica sin prueba asociada; simulacro pendiente de entorno (AC-SEC-33). |
| C-24 / C-43 / C-44 — suministro | `security:secrets` y `test:security` en verde como evidencia local; SCA de dependencias, escaneo de imágenes y rotación con doble `kid` quedan pendientes de CI/Docker y se registran como deuda. |
| C-20 / C-36 / C-45 — transporte y observabilidad | Cabeceras CSP/HSTS ya verificadas localmente en C7; escaneo TLS en preproducción, simulacro de alertas y ajuste de `RATE_LIMITS` siguen pendientes de entorno/informe de carga. |
| CAR-06 — carga | Informe k6 con 200 VUs y p95 < 4 s y prueba de soak: **pendiente**; sin entorno no se afirma cumplimiento. |
| CAR-11 — accesibilidad | Informe WCAG y recorridos manuales de Rol C, y `axe` en CI solo si se autoriza la dependencia (D95): **pendientes**. |
| Trazabilidad | Matriz requisito → código → prueba → acta en `docs/reviews/c8/rol-b.md`, con una fila por CAR-07/CAR-12 y por compuerta C0…C8; cada fila sin evidencia se marca pendiente. |
| Contrato y regresión | 54/4/37/64 sin deriva; C1–C7 en verde local; sin permisos, operaciones ni eventos nuevos salvo enmienda controlada. |
| Aceptación | C8 **no se firma ni se etiqueta** sin actas de entorno, evidencia de Rol C y autorización expresa. `release-3.0` se evalúa solo tras aceptación final. |

Regla de bloqueo: un criterio sin evidencia enlazada en `docs/reviews/c8/rol-b.md` no se marca como cumplido. La finalización en código de C7 no implica aprobación de C7 ni de C8.

## 3. Alcance propuesto (tareas)

Estado actual: RB1-70 a RB1-79 **ejecutados por Rol B**; la compuerta permanece abierta por evidencia externa, deuda de calidad de Rol C y firma pendiente. Numeración continua desde RB1-69.

| ID | Tarea | Entregable | Criterios que impulsa | Depende de |
| --- | --- | --- | --- | --- |
| RB1-70 | Baseline y plan C8 | Este documento y actualización de `docs/iteraciones.md`; inventario de deuda C5/C7 y firma pendiente | Compuerta 8, D100/D109 | Orden de planificación |
| RB1-71 | Cierre de PA-011 | Enmienda `docs/contratos/cambios/cambio-retencion-c8.md` con plazos y supresión por anonimización; sin editar documentos congelados ni ejecutar DDL | PA-011, AC-AUD-15, D101 | Ratificación de D101 |
| RB1-72 | Cierre de PA-016 | Enmienda `docs/contratos/cambios/cambio-integridad-auditoria-c8.md` o acta de decisión: sin cadena, resumen firmado; sin tocar ADR-0004 ni `modelo-auditoria-v1.md` | PA-016, ADR-0004, D102 | Ratificación de D102 |
| RB1-73 | Inventario de datos personales | `docs/reviews/c8/inventario-datos-personales.md` con finalidad, plazo y estrategia de anonimización por tipo de dato; sin datos reales | Diseño §13, PA-011, C-26, D103 | RB1-71 |
| RB1-74 | Supresión y anonimización | Política ejecutable en el nivel de aplicación solo si se autoriza una operación nueva; por defecto, procedimiento documentado con auditoría `estudiante.anonimizado` (evento ya en catálogo) y sin permisos nuevos | PA-011, CAR-12, D104 | RB1-71, RB1-73 |
| RB1-75 | Runbooks y C-46 | Revisión de `docs/runbook/*` de despliegue, reversión, respaldo/restauración, incidente y break-glass; acta de simulacro **pendiente de entorno** | AC-SEC-33, C-46, D105 | RB1-70 |
| RB1-76 | Respaldos y staging | Documentación de C-25 (cifrado, RPO/RTO) y C-26 (staging anonimizado); simulacro y tiempos medidos **pendientes** | C-25/C-26, AC-AUD-15, D106 | RB1-75 |
| RB1-77 | Saneamiento, secretos y cadena de suministro | Verificación local con `test:security`, `security:secrets`, `arch:check` y `contracts:validate`; SCA/imágenes/rotación **pendientes de CI y Docker**; sin dependencias nuevas | C-24/C-43/C-44, AC-SEC-32, D107 | RB1-70 |
| RB1-78 | Carga, TLS y observabilidad | Registro de deuda: k6/soak, escaneo TLS y simulacro de alertas **pendientes de entorno**; `RATE_LIMITS` sin ajuste sin informe | CAR-06, C-20/C-45, D108 | RB1-77 |
| RB1-79 | Trazabilidad, regresión y paquete C8 | `docs/reviews/c8/rol-b.md` (matriz requisito → código → prueba → acta) y `docs/tasks/rol-b/rol-b-it8-registro.md`; regresión local completa; sin firma ni publicación | Compuerta 8, D109 | RB1-70–RB1-78 |

**Estado final de las tareas:** RB1-70…RB1-79 ejecutados en la parte que depende de Rol B; RB1-75/RB1-76/RB1-78 parciales por ausencia de entorno y simulacro, y RB1-79 registra la deuda de calidad heredada de Rol C. El detalle está en `docs/tasks/rol-b/rol-b-it8-registro.md`.

**Delegación a Rol C:** informe WCAG 2.1 AA, recorridos con teclado y lector de pantalla, responsive 360/768/1024/1440, cliente regenerado, retirada de mocks y corrección de los errores de `lint`/`format:check` en `apps/web`. Rol B solo los referencia como dependencias de la aceptación final y no prescribe su implementación.

**Fuera de alcance de Rol B en C8:** cierre de RB1-43…RB1-48, firma de C0…C7, operaciones/permisos/eventos nuevos sin enmienda, DDL, proveedores externos y cualquier trabajo de interfaz.

## 4. Decisiones propuestas para C8 (D100–D109)

**Ratificadas el 23 de noviembre de 2026** por la orden de inicio de la Iteración 8; se ejecuta la opción A recomendada en todas. No se ha modificado ningún documento congelado: PA-011 y PA-016 se cierran mediante enmiendas controladas en `docs/contratos/cambios/`.

| Decisión | Propuesta | Recomendación | Reversibilidad |
| --- | --- | --- | --- |
| D100 — Alcance | Rol B cubre retención, integridad, inventario PII, runbooks de seguridad/operación, trazabilidad y regresión; escaneos de entorno y evidencia de Rol C quedan pendientes | **A — fijar alcance** | Barata |
| D101 — PA-011 retención | Cerrar con política documentada: auditoría ≥ 5 años, PII mientras dure la relación + plazo institucional, respaldos como la auditoría; supresión por anonimización, sin borrado de eventos ni purga automática | **A — política sin DDL** | Media |
| D102 — PA-016 integridad | Mantener la decisión ADR-0004 (sin cadena de hashes) con resumen firmado periódico como control operativo; una cadena exigiría enmienda + migración con `ccltpg_migrador` y se evalúa solo si se exige evidencia ante terceros | **A — mantener sin cadena** | Costosa tras sellar |
| D103 — Inventario PII | Documentar finalidad, plazo y estrategia de anonimización por tipo de dato sin copiar datos reales; el procedimiento de supresión queda como acta, no como pantalla nueva | **A — inventario documentado** | Barata |
| D104 — Supresión | No añadir operación ni permiso: usar el procedimiento operativo y el evento `estudiante.anonimizado` ya existente; si se exige autoservicio, va por enmienda controlada con revisión de contrato | **A — sin operación nueva** | Costosa tras congelar |
| D105 — Runbooks C-46 | Revisar los runbooks existentes y no modificar ninguno sin prueba asociada; el simulacro de despliegue/reversión/incidente se marca pendiente de entorno | **A — revisar y condicionar** | Barata |
| D106 — C-25/C-26 | Documentar cifrado de respaldos, RPO/RTO y staging anonimizado; sin simulacro ni tiempos medidos no se afirma cumplimiento | **A — documentar y esperar entorno** | Barata |
| D107 — Suministro | Sin dependencias nuevas: evidencia local con `security:secrets`/`test:security`; SCA, imágenes, doble `kid` y CI de GitHub como deuda registrada | **A — sin dependencias nuevas** | Barata |
| D108 — Carga/TLS/alertas | k6/soak, TLS y simulacro de alertas pendientes de entorno; `RATE_LIMITS` intactos hasta informe de carga; `axe` sigue supeditado a autorización (D95) | **A — pendiente de entorno** | Barata |
| D109 — Aceptación | C8 no se firma, no se etiqueta `release-3.0` y no se publica sin actas, evidencia de Rol C y autorización expresa; la matriz marca pendiente lo que no tenga evidencia | **A — no firmar sin evidencia** | Costosa tras etiquetar |

## 5. Operaciones, permisos y auditoría

- No se crean `operationId`, permisos ni eventos nuevos en este plan. Si D104 se revierte y se exige una operación de supresión, se tramita por enmienda controlada antes de escribir código.
- Totales esperados: **54 operaciones**, **4 públicas**, **37 permisos**, **64 eventos**. Cualquier desviación se documenta antes de avanzar.
- `auth-v1.md`, `modelo-auditoria-v1.md`, `api-v1.openapi.yaml`, ADR-0003 y ADR-0004 permanecen intactos. PA-011 y PA-016 se cierran en `docs/contratos/cambios/*.md`.
- El evento `estudiante.anonimizado` ya figura en el catálogo (§3 del modelo); no se amplía el catálogo en C8.
- Auditoría: sin borrado desde la aplicación, sin `UPDATE`/`DELETE`/`TRUNCATE`, corrección solo por `auditoria.correccion`; la restauración sigue el procedimiento de excepción documentado (AC-AUD-06/07/15).
- Migraciones: solo con `ccltpg_migrador`, probadas `up`/`down`/`up`. La API no ejecuta DDL (AC-SEC-31).

## 6. Evidencia y verificación esperada

Cuando se ejecute, el registro debe enlazar:

| Comando/artefacto | Resultado esperado |
| --- | --- |
| `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm build` | verdes |
| `pnpm test`, `pnpm test:integration` (PostgreSQL 16 real) | verdes, sin regresión frente a C7 |
| `pnpm arch:check`, `pnpm test:architecture` | 0 violaciones |
| `pnpm test:contracts`, `pnpm contracts:validate`, `pnpm contracts:generate` | 54/4/64; sin deriva en `packages/contracts` |
| `pnpm contracts:lint` | 0 errores (advertencias preexistentes documentadas) |
| `pnpm test:security`, `pnpm security:secrets` | verdes |
| Enmiendas `cambio-retencion-c8.md` y `cambio-integridad-auditoria-c8.md` | PA-011/PA-016 cerradas sin editar documentos congelados |
| `docs/reviews/c8/inventario-datos-personales.md` | inventario sin datos reales; estrategia de anonimización por tipo |
| Acta C-25/C-26/C-46 | **pendiente** sin simulacro ni entorno; nunca marcada como verificada |
| Informe k6/soak, escaneo TLS/SCA/imágenes, informe WCAG y demo con cliente real | **pendientes**; Rol B no los genera sin entorno/autorización/Rol C |

## 7. Publicación

Este plan **no autoriza** `git commit`, `git push`, firma, etiqueta ni publicación. La etiqueta `release-3.0` corresponde a la aceptación final y solo se evalúa con autorización expresa, actas de entorno y evidencia de Rol C. No se inicia ninguna iteración posterior. La deuda de C5 y C7 (RB1-43…RB1-48, axe, TLS, Rol C y firma de compuertas) se mantiene y no se usa como evidencia de C8.
