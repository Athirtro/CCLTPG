# Runbook — incidente de seguridad

- **Objetivo:** contener, erradicar y aprender de un incidente sin destruir evidencia ni ampliar el daño.
- **Alcance C1:** esqueleto sin autenticación real ni datos de producción. El procedimiento se completa en C2 cuando existan identidad, RBAC y auditoría funcional.

## 1. Clasificación rápida

| Señal | Ejemplo | Prioridad inicial |
| --- | --- | --- |
| Secreto expuesto | Token en un commit, log o captura | **Crítica** |
| Acceso no autorizado | Origen desconocido con permisos | **Crítica** |
| Fuga de PII | Email/documento en logs o respuesta | **Crítica** |
| Dependencia vulnerable explotable | CVE crítica en runtime | Alta |
| Alteración de integridad | Cambio no explicado en datos o configuración | Alta |
| Abuso/DoS | Picos anómalos, fuerza bruta | Alta |
| Debilidad sin explotar | Cabecera faltante, configuración laxa | Media |

Ante duda, clasificar como crítica y degradar después.

## 2. Fases

### 2.1 Detectar y registrar

Registrar desde el primer momento:

- Fecha y hora (UTC) de detección.
- Quién detectó y cómo.
- Sistemas afectados.
- Indicadores observados (IP, `requestId`, `traceId`, ruta, usuario).
- Acciones tomadas y su hora.

No incluir secretos ni PII innecesaria en el registro.

### 2.2 Contener

Objetivo: impedir que el daño siga creciendo.

- **Secreto expuesto:** rotarlo de inmediato según [rotación de secretos](rotacion-secretos.md). Revocar tokens/sesiones relacionados.
- **Acceso no autorizado:** bloquear el origen en el proxy/WAF, deshabilitar la credencial y, si aplica, la cuenta.
- **Dependencia vulnerable:** desplegar la versión corregida o mitigar en el proxy; si no hay parche, aislar la funcionalidad.
- **Fuga de datos:** detener la salida (endpoint, log, exportación) y preservar copia del estado.
- **Compromiso del host:** aislar la instancia de la red sin apagarla, para conservar memoria y discos.

No borrar logs, contenedores ni volúmenes antes de preservar evidencia.

### 2.3 Preservar evidencia

1. Exportar logs del periodo afectado (JSON de Pino) a un almacenamiento separado.
2. Guardar métricas y trazas relevantes.
3. Conservar el `requestId`/`traceId` de los casos.
4. Registrar hashes de los archivos exportados.
5. Mantener cadena de custodia: quién accedió, cuándo y para qué.

La evidencia puede contener PII: tratarla con el mismo cuidado que los datos originales.

### 2.4 Erradicar

- Corregir la causa raíz: código, configuración, permisos, dependencia o procedimiento.
- Verificar que la corrección no deja puertas traseras ni credenciales antiguas.
- Añadir una prueba que falle sin la corrección (regresión).
- Revisar si el mismo defecto existe en otros entornos.

### 2.5 Recuperar

1. Restaurar el servicio de forma controlada.
2. Verificar `/api/v1/health/live` y `/api/v1/health/ready`.
3. Ejecutar las pruebas de seguridad, contrato, arquitectura e integración.
4. Monitorizar de cerca durante al menos 24–72 h.
5. Confirmar que los indicadores del incidente ya no aparecen.

### 2.6 Comunicar

| Audiencia | Qué se comunica | Qué no |
| --- | --- | --- |
| Equipo técnico | Causa, alcance, acciones, riesgos | Secretos y PII |
| Responsables del proyecto | Impacto, estado, decisiones necesarias | Detalles explotables |
| Afectados | Qué pasó con sus datos y qué deben hacer | Hipótesis no confirmadas |
| Autoridades | Solo si la normativa lo exige | Información especulativa |

En Colombia, evaluar deberes de notificación de incidentes con datos personales conforme a la normativa aplicable (Ley 1581 de 2012 y regulación de la SIC). La decisión legal no la toma el equipo técnico por sí solo.

## 3. Guiones por escenario

### 3.1 Secreto en el repositorio

1. Rotar el secreto.
2. Revocar accesos asociados.
3. Ejecutar `pnpm security:secrets` y Gitleaks sobre el historial.
4. Si el secreto llegó al remoto, asumirlo público.
5. Limpiar el historial solo como medida complementaria y con coordinación del equipo.
6. Añadir el patrón al escáner y una prueba.

### 3.2 PII en logs

1. Identificar la ruta y el campo.
2. Detener la escritura del campo (redacción).
3. Añadir la ruta a `REDACT_PATHS` y una prueba de regresión.
4. Purgar los logs afectados según la política de retención.
5. Evaluar notificación si la exposición afecta derechos de personas.

### 3.3 Origen no autorizado

1. Confirmar que `CORS_ORIGIN_DENIED` está funcionando.
2. Bloquear el origen/IP en el proxy.
3. Revisar si hubo solicitudes aceptadas desde ese origen.
4. Validar la lista `CORS_ORIGINS`; no ampliarla sin justificación.
5. Revisar credenciales y sesiones asociadas.

### 3.4 Dependencia vulnerable

1. Confirmar la versión afectada y si el código es alcanzable.
2. Actualizar o aplicar mitigación.
3. Ejecutar `pnpm audit --prod --audit-level critical`, `pnpm test`, `pnpm build`.
4. Documentar la excepción si no hay parche y el equipo decide asumir el riesgo.

## 4. Contactos y escalamiento

| Rol | Responsabilidad | Contacto |
| --- | --- | --- |
| Rol B — seguridad y operación | Coordinación técnica del incidente | Definir en C1/C2 |
| Rol A — modelo y datos | Impacto en datos y diccionario | Definir en C1/C2 |
| Rol C — frontend y contrato | Impacto en API/SPA | Definir en C1/C2 |
| Responsable del proyecto | Decisiones y comunicación externa | Definir en C1/C2 |

Los contactos reales se completan al iniciar C2; no se inventan en este documento.

## 5. Postmortem

En un plazo máximo de 5 días hábiles:

1. Línea de tiempo en UTC.
2. Causa raíz (técnica y organizacional).
3. Qué funcionó y qué falló en la detección/contención.
4. Impacto cuantificado (datos, tiempo, usuarios).
5. Acciones correctivas con dueño y fecha.
6. Pruebas o controles añadidos.
7. Decisiones pendientes para el equipo.

El postmortem es sin culpables: busca fallos de sistema y de proceso.

## 6. Lista de verificación

- [ ] Incidente registrado con hora UTC y responsable.
- [ ] Secreto rotado o acceso bloqueado.
- [ ] Evidencia preservada sin modificar.
- [ ] Causa raíz identificada.
- [ ] Corrección con prueba de regresión.
- [ ] Servicio recuperado y verificado.
- [ ] Comunicación realizada según la matriz.
- [ ] Postmortem y acciones con dueño/fecha.
- [ ] Controles preventivos añadidos al pipeline.
