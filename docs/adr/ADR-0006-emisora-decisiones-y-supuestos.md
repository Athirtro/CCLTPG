# ADR-0006 — Decisiones EM-D y supuestos EM-PA de la Emisora R.A.C.

- **Estado:** Propuesta para aprobación en E0; **no modifica** ADR-0001…ADR-0005 ni los contratos congelados.
- **Fecha:** 2026-11-27
- **Decisores:** Rol B (arquitectura y seguridad); Rol A (datos y retención); Secretaría de Cultura y Jefe de emisora (negocio); aprobación humana en E0.
- **Trazabilidad:** `docs/diseno-emisora.md` §§8, 14, 15 y 18; ADR-0005; enmiendas `cambio-emisora-contexto.md` y `cambio-emisora-eventos.md`; matriz `matriz-autorizacion-emisora-v1.md`.

## Contexto

El plan de integración de la Emisora R.A.C. incorpora decisiones cerradas en el levantamiento (EM-D-01…EM-D-04) y preguntas que, tras la revisión independiente, tienen **valor por defecto operativo** (EM-PA-01…EM-PA-10) para no bloquear las fases E1…E5. La revisión concluyó que los 23 hallazgos quedaban cerrados o convertidos en decisión explícita, y que solo EM-PA-08/09/10 seguían siendo decisiones de equipo con valor por defecto, no bloqueos de diseño.

Sin un registro único, esas decisiones quedarían dispersas entre el plan, los ADR y las enmiendas, con riesgo de que una fase adopte una alternativa distinta (por ejemplo, escribir plantillas en `public` sin registrarlo o interpretar los plazos como exclusivos). Este ADR consolida las decisiones, los supuestos con dueño y fase, y la trazabilidad RF → fase del §14, sin alterar los documentos congelados.

## Decisión

### 1. Decisiones cerradas del levantamiento (EM-D)

| ID | Decisión | Consecuencia concreta |
| --- | --- | --- |
| EM-D-01 | Los oficios **se emiten en PDF** (no solo plantilla). | Se usan plantillas nuevas de Exportaciones (`emisora-oficio-salida`, etc.); la generación ocurre en el módulo de exportaciones, nunca en controladores de emisora. Se registran el evento de dominio y el transversal `reporte.generado`. |
| EM-D-02 | Los pagos a realizadores y derechos se registran **solo como trazabilidad**; sin integración de ejecución de pagos. | Sin cálculo de importes, asientos ni compromisos; SIIF/Sayco-Acinpro se documentan como referencias y soportes (coherente con P7 y SUP-002). |
| EM-D-03 | El dueño de los datos personales de realizadores es **el administrador**. | Responsable de la política de retención; PII cifrada con índice ciego, consentimiento versionado y redacción por clave en auditoría. Corrige la referencia errónea a EM-D-01 que existía en el plan v0.1 (M2). |
| EM-D-04 | La rejilla anual **no se versiona**; el histórico se consulta por auditoría. | Una rejilla vigente por año, sin tabla de versiones; los cambios quedan en `evento_auditoria` (EM-PA-05). |

### 2. Supuestos con valor por defecto (EM-PA)

| ID | Pregunta | Valor por defecto | Dueño / fase |
| --- | --- | --- | --- |
| EM-PA-01 | ¿Audio en Archivos con política opt-in o bucket separado? | Política opt-in `emisora-audio` dentro de Archivos; sin bucket propio. La política `default` y `POST /api/v1/files` no cambian. | Rol B + Arquitectura / E1 |
| EM-PA-02 | ¿Perfiles en `PROFILE_SEEDS` o en semilla propia? | En `PROFILE_SEEDS`, con actualización explícita de la expectativa de la prueba de semilla (EL-1/EL-2). `seedEmisora` solo datos de negocio. | Equipo / E0 |
| EM-PA-03 | ¿Los 13 actores se mapean 1:1 a perfiles o se agrupan? | 13 perfiles propuestos en §5.2; agrupables en revisión sin cambiar permisos. | Negocio / E0 |
| EM-PA-04 | ¿Montos de viáticos e incentivos como dato informativo? | Solo referencias y estados; sin importes calculados ni asientos. | Secretaría / E0 |
| EM-PA-05 | ¿La rejilla no versionada impide consultar el año anterior? | No se consulta en UI; la auditoría conserva el histórico. | Jefe emisora / E2 |
| EM-PA-06 | ¿Identidad temporal con MFA o sin MFA? | Identidad temporal con `valid_until` y MFA según política vigente para temporales. | Rol B / E2 |
| EM-PA-07 | ¿Entidades y plazos de reporte a Sayco/Acinpro? | Se modela `emisora.parametro_reporte` (`entidad`, `periodicidad`, `dia_limite`, `activo`) en `0003_create_emisora_reporting.ts`; entidad por defecto `sayco`, periodicidad mensual. | Jefe emisora / E4 |
| EM-PA-08 | ¿Plantillas de notificación en `public` o registro local? | **Valor por defecto:** migración aditiva `public/0009` + EL-4. Alternativa: `emisora.plantilla_notificacion_emisora` con un puerto nuevo en Notificaciones si el equipo prefiere cero escrituras en `public`. | Equipo / E1 |
| EM-PA-09 | ¿Zona horaria y límites inclusivos de los plazos? | `America/Bogota`; 3 semanas y 2 días en días calendario, ambos límites inclusivos; oct/nov sobre `date`. | Jefe emisora + Rol B / E0 |
| EM-PA-10 | ¿Límites concretos para el audio de emisora? | `EMISORA_MAX_AUDIO_BYTES` con valor por defecto explícito en `.env.example`; MIME restringido a `audio/mpeg`, `audio/wav`, `audio/ogg`. Confirmar con el proveedor de almacenamiento antes de E2. | Rol B / E1 |

EM-PA-08/09/10 son decisiones de equipo **con valor por defecto ejecutable**: E1 y E2 pueden avanzar con ese valor; si el equipo las cambia, se registra aquí antes de tocar código o contratos. EM-PA-02 y EM-PA-03 se ratifican en E0 junto con la matriz de autorización; EM-PA-01, EM-PA-08 y EM-PA-10 se confirman en E1; EM-PA-05 y EM-PA-06 en E2; EM-PA-07 en E4. Todas se cierran en E5.

### 3. Trazabilidad RF → fase

La tabla siguiente reproduce la matriz del §14 del plan. Todo evento mencionado figura en la lista cerrada de 38 nombres de `docs/contratos/cambios/cambio-emisora-eventos.md`.

| RF | Tablas / agregado | Permiso representativo | Evento de auditoría | Fase |
| --- | --- | --- | --- | --- |
| RF-01.1…01.3 | `programacion_diaria`, `programacion_item`, `rejilla_anual` | `emisora:programacion:manage` | `programacion.creada`, `programacion.aprobada`, `rejilla.verificada` | E2 |
| RF-02.1…02.4 | `sesion_grabacion`, `asistencia_cabina`, `audio`, `archivo_emisora` | `emisora:grabacion:manage`, `emisora:audio:create` | `grabacion.programada`, `grabacion.aprobada`, `audio.archivado` | E2 |
| RF-03.1 | `convocatoria` | `emisora:convocatoria:manage` | `convocatoria.abierta` | E2 |
| RF-03.2 | `proyecto_programa`, `realizador` | `emisora:proyecto:create` | `proyecto.recibido` | E2 |
| RF-03.3 | `comite`, `rejilla_anual`, `rejilla_anual_item` | `emisora:rejilla:update` | `comite.registrado`, `rejilla.aprobada` | E2 |
| RF-03.4 | `realizador`, `proyecto_programa` | `emisora:realizador:update` | `realizador.notificado` | E2 |
| RF-03.5 | `informe_realizador` | `emisora:informe:create/read_own` | `informe.recibido` | E2 |
| RF-03.6 | `incentivo`, `comite` | `emisora:incentivo:update` | `incentivo.asignado` | E2 |
| RF-03.7 | `resolucion_incentivo` | `emisora:resolucion:create/export` | `resolucion.generada` | E3 |
| RF-04.1…04.3 | `patrocinio`, `orden_emision`, `promo` | `emisora:patrocinio:manage` | `patrocinio.aprobado`, `orden.emitida` | E3 |
| RF-05.1…05.3 | `promo`, `publicacion` | `emisora:publicacion:manage` | `promo.producida`, `publicacion.realizada` | E3 |
| RF-06.1…06.6 | `transmision`, `salida_equipo`, `reporte_desplazamiento`, `prestamo_mifi`, `viatico` | `emisora:transmision:manage`, `emisora:viatico:read` | `transmision.autorizada`, `prestamo.autorizado`, `viatico.solicitado` | E3 |
| RF-07.1…07.3 | `turno_operador`, `lectura_transmisor`, `bitacora_sede` | `emisora:lectura:create`, `emisora:bitacora:create` | `lectura.registrada`, `turno.asignado` | E4 |
| RF-08.1…08.3 | `obra`, `reporte_obra`, `pago_derechos` | `emisora:obra:manage`, `emisora:derecho:manage` | `obra.incluida`, `reporte_obra.generado`, `pago.registrado` | E4 |
| RF-09.1…09.4 | `hoja_vida_equipo`, `actualizacion_tecnologica`, `proyeccion_anual`, `inversion_seguimiento`, `version_software`, `asignacion_equipo` | `emisora:equipo:manage`, `emisora:inversion:read` | `equipo.actualizado`, `inversion.registrada` | E4 |
| RF-10.1…10.2 | `actividad_cultural`, `permiso_gobierno` | `emisora:actividad:read`, `emisora:permiso-salida:create` | `actividad.registrada`, `permiso.emitido` | E4 |
| RF-11.1…11.2 | `archivo_emisora`, `planilla_emision` | `emisora:archivo-emisora:manage`, `emisora:planilla:create` | `audio.archivado`, `planilla.registrada` | E4 |
| RF-12.1…12.2 | `tramite_externo`, `soporte_tramite` | `emisora:tramite:manage` | `tramite.radicado` | E4 |
| RNF-01…06 | Guard, catálogo, puertos, auditoría, adjuntos, redacción, disponibilidad | Permisos `emisora:*` | Eventos del catálogo emisora y reglas de redacción | Todas |

## Alternativas consideradas

| Alternativa | Motivo de rechazo |
| --- | --- |
| Dejar EM-PA-01…EM-PA-10 como preguntas abiertas hasta E5 | Bloquearía E1 (esquema, plantillas, límites de audio) y E2 (plazos e identidad temporal) |
| Registrar las decisiones solo en el plan | El plan no es contrato gobernante y no ofrece trazabilidad estable por fase; ADR-0001…0004 ya fijan el precedente de registro normativo |
| Editar los contratos congelados para reflejar los supuestos | Viola P4 y la regla de aditividad: los cambios van en enmiendas y documentos nuevos |
| Crear una hoja de cálculo paralela de decisiones | Segunda fuente de verdad; divergencia garantizada frente a ADR y enmiendas |
| Resolver EM-PA-08 escribiendo plantillas en cualquier esquema sin migración controlada | Rompería el historial de migraciones y EL-4; la ruta acordada es `public/0009` con `down` por código |

## Consecuencias

- **Positivas:** decisiones recuperables por ID, dueño y fase; plazos y límites interpretados de forma uniforme; trazabilidad RF → permiso → evento → fase verificable en cada compuerta.
- **Negativas:** hay que revisar este ADR cuando cambie un supuesto; EM-PA-08 mantiene una alternativa viva que requiere decisión explícita en E1.
- **Operativas:** los dueños indicados confirman su supuesto en la fase asignada; el cambio de cualquiera de ellos se registra aquí antes de modificar código, contratos o pruebas.
- **Deuda:** EM-PA-07 depende de que el negocio confirme entidades y plazos reales antes de E4; EM-PA-10 depende del proveedor de almacenamiento antes de E2.

## Cumplimiento

- **E0:** aprobar EM-D-01…EM-D-04 y los valores por defecto; ratificar EM-PA-02/03/09 junto con la matriz y las enmiendas.
- **E1:** confirmar EM-PA-01/08/10; verificar firmas de `AuditWriter` e idempotencia y ejecutar `pnpm arch:check`.
- **E2:** aplicar EM-PA-05/06; compuerta de la primera demo convocatoria→rejilla→programación→audio.
- **E3/E4:** aplicar EM-D-01 en oficios PDF y EM-PA-07 en reportes de obras; verificar que no haya lógica financiera (EM-D-02).
- **E5:** cerrar todas las preguntas, actualizar la trazabilidad RF→código→prueba y ejecutar la regresión completa en verde.
