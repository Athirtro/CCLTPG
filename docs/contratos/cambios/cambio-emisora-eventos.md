# Enmienda CAR-2026-11-27-03 — Catálogo de eventos de la Emisora R.A.C. (E0)

- **Fecha:** 27 de noviembre de 2026
- **Estado:** propuesta de gobernanza E0; pendiente de aprobación humana. **No modifica** `docs/contratos/modelo-auditoria-v1.md` (catálogo base congelado de 62 eventos) ni `docs/contratos/cambios/cambio-eventos-c6.md`.
- **Documento base:** `docs/contratos/modelo-auditoria-v1.md` §3.
- **Motivo:** RF-01…RF-12 y la matriz de trazabilidad del plan (§14) requieren eventos de dominio de la emisora. La lista cerrada del plan (§6.1) fija 38 nombres; todos deben estar en el catálogo documental para que `events.json` pueda regenerarse sin deriva.

## 1. Alcance y forma de los nombres

Los eventos se nombran `dominio.accion`, con **un solo punto** y sin guiones: `^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$`. No se usa un prefijo literal `emisora.`: decir «eventos emisora» significa «eventos del catálogo de la emisora». Los nombres de recurso con guion (`asistencia-cabina`, `permiso-salida`, `archivo-emisora`) no se trasladan al nombre del evento.

Los eventos de esta enmienda se emiten desde los casos de uso de `emisora/application` y se escriben con el `AuditWriter` compartido en la misma transacción que el cambio. No sustituyen al evento transversal `reporte.generado` que Exportaciones registra siempre.

## 2. Convención de la tabla

La sección 3 sigue el formato que parsea `packages/contracts/scripts/lib/catalog.mjs`: encabezado exacto, tabla Markdown y eventos en backticks en la primera columna. El lector toma solo el texto comprendido entre el encabezado de la sección 3 y el de la sección 4, por lo que las reglas y las fuentes se documentan después de esa sección.

## 3.

| Evento | Cuándo | RF | Fase |
| --- | --- | --- | --- |
| `programacion.creada` | Programación diaria creada y validada contra la rejilla | RF-01.1…01.3 | E2 |
| `programacion.aprobada` | Programación aprobada por el perfil responsable | RF-01.1…01.3 | E2 |
| `rejilla.aprobada` | Rejilla anual aprobada por el comité con acta adjunta | RF-03.3 | E2 |
| `rejilla.verificada` | Correspondencia de franjas entre programación y rejilla verificada | RF-01.3 | E2 |
| `grabacion.programada` | Sesión de grabación agendada | RF-02.1 | E2 |
| `grabacion.aprobada` | Sesión de grabación aprobada | RF-02.1 | E2 |
| `asistencia.registrada` | Asistencia a cabina registrada por sesión | RF-02.2 | E2 |
| `audio.archivado` | Audio archivado con metadatos mínimos en el contexto Archivos | RF-02.4, RF-11.1 | E2/E4 |
| `convocatoria.abierta` | Convocatoria anual abierta | RF-03.1 | E2 |
| `convocatoria.cerrada` | Convocatoria cerrada al vencer el plazo de 21 días | RF-03.1 | E2 |
| `proyecto.recibido` | Proyecto recibido con el formato oficial adjunto | RF-03.2 | E2 |
| `realizador.notificado` | Realizador notificado sobre el estado de su proyecto | RF-03.4 | E2 |
| `comite.registrado` | Acta del comité registrada con soporte documental | RF-03.3 | E2 |
| `informe.recibido` | Informe de realizador recibido en la ventana octubre/noviembre | RF-03.5 | E2 |
| `informe.calificado` | Informe de realizador evaluado | RF-03.5 | E2 |
| `incentivo.asignado` | Calificación de incentivo aprobada | RF-03.6 | E2 |
| `resolucion.generada` | Resolución de incentivos generada como PDF | RF-03.7 | E3 |
| `patrocinio.aprobado` | Patrocinio aprobado | RF-04 | E3 |
| `orden.emitida` | Orden de emisión registrada | RF-04.3 | E3 |
| `promo.producida` | Promo producida y asociada a la orden de emisión | RF-05 | E3 |
| `publicacion.realizada` | Publicación realizada en el canal acordado | RF-05 | E3 |
| `transmision.autorizada` | Transmisión autorizada con salida y soportes | RF-06 | E3 |
| `viatico.solicitado` | Viático solicitado para transmisión fuera de la ciudad | RF-06.6 | E3 |
| `prestamo.autorizado` | Préstamo de mifi autorizado con antelación mínima de dos días | RF-06.5 | E3 |
| `turno.asignado` | Turno de operador asignado en la sede | RF-07.1 | E4 |
| `lectura.registrada` | Lectura técnica diaria del transmisor registrada | RF-07.2 | E4 |
| `bitacora.registrada` | Bitácora de sede registrada con actor y solicitud | RF-07.3 | E4 |
| `obra.incluida` | Obra incluida con título, autor, duración y fecha | RF-08.1 | E4 |
| `reporte_obra.generado` | Reporte de obras generado para la entidad y el periodo | RF-08.2 | E4 |
| `pago.registrado` | Pago de derechos registrado como soporte y estado | RF-08.3 | E4 |
| `equipo.actualizado` | Hoja de vida o actualización tecnológica registrada | RF-09 | E4 |
| `proyeccion.generada` | Proyección anual generada | RF-09 | E4 |
| `inversion.registrada` | Inversión con seguimiento contractual registrada | RF-09.3 | E4 |
| `actividad.registrada` | Actividad cultural registrada | RF-10.1 | E4 |
| `permiso.emitido` | Permiso de salida emitido en PDF | RF-10.2 | E4 |
| `tramite.radicado` | Trámite externo radicado con oficio y soporte | RF-12 | E4 |
| `soporte.adjuntado` | Soporte documental adjunto vía contexto Archivos | RF-12, RNF-04 | E4 |
| `planilla.registrada` | Planilla de emisión registrada | RF-11.2 | E4 |

## 4. Reglas de la enmienda

1. La sección 3 es una lista cerrada de **38 eventos**. Ningún evento existente se elimina ni se renombra; la base conserva sus 62 eventos y la enmienda C6 conserva los suyos.
2. `asistencia.registrada` ya existe en el catálogo base para asistencia de clase. El plan fija ese mismo nombre para la asistencia a cabina de la emisora, por lo que se reutiliza y se distingue por el recurso (`asistencia_cabina` frente a `clase`). Como la fusión es por conjunto, de los 38 nombres **37 son nuevos**: el total fusionado pasa de 64 a 101 y EL-3 debe resincronizarse con ese valor, no con 102.
3. La redacción es por nombre de clave, nunca por evento: se añaden aditivamente a `SECRET_KEYS` las claves `numero_documento_cifrado`, `numero_documento_hash`, `contacto_cifrado` y `consentimiento_datos`. Los DTO construyen el payload solo con claves permitidas y los soportes voluminosos se sustituyen por `archivo_id` + hash antes del límite de 8 KB.
4. La escritura usa `AuditWriter` en la misma transacción del cambio; si falla, la operación se revierte. Las creaciones con efecto secundario exigen la cabecera de idempotencia y usan el store existente sin acceso directo de emisora a esquemas ajenos.
5. Los documentos generados por Exportaciones registran su evento de dominio (`resolucion.generada`, `reporte_obra.generado`, etc.) **además** de `reporte.generado`; el contrato declara ambos y las pruebas no asumen que el evento transversal sea el único.
6. Los prefijos críticos de notificación que se añaden a `CRITICAL_EVENT_PREFIXES` son `rejilla.aprobada`, `incentivo.asignado` y `transmision.autorizada` (EL-6). El resto respeta las preferencias `app`/`email` del destinatario.
7. El generador lee esta sección y exige backticks completos en líneas de tabla; cualquier evento con dos puntos o guiones sería ignorado y provocaría deriva entre el documento y `events.json`.
8. Ninguna operación emisora es pública: `public-routes.json` no se modifica.

## Fuentes

- `docs/diseno-emisora.md` §§6.1, 6.2, 6.5, 6.6, 14 y 18 (I11, M3, I6, I9).
- `packages/contracts/scripts/lib/catalog.mjs` (extracción y fusión determinista de enmiendas).
- `docs/contratos/modelo-auditoria-v1.md` §3 (catálogo base congelado).
