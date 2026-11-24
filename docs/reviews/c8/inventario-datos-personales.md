# Inventario de datos personales — C8 (Rol B)

- **Fecha:** 23 de noviembre de 2026
- **Ámbito:** datos personales tratados por los esquemas `public` y `academic` según `docs/diccionario-datos.md` y el diseño §13. **No contiene datos reales.**
- **Política aplicable:** `docs/contratos/cambios/cambio-retencion-c8.md` (PA-011).
- **Base legal y finalidad (diseño §13):** Ley 1581 de 2012 y Decreto 1377 de 2013; finalidad declarada por cada tratamiento, consentimiento registrado y derechos de acceso, corrección y supresión.

## 1. Inventario por dato

| Dato | Ubicación | Finalidad | Clasificación | Control | Supresión / retención |
| --- | --- | --- | --- | --- | --- |
| `email` | `public.usuario` | Identificación de login y contacto de cuenta | Identificador (excepción documentada ADR-0003) | Acceso autorizado, HMAC en logs y auditoría (C-23) | Mientras dure la relación; anonimización/seudonimización al cese |
| `nombre` | `public.usuario` | Identificación de la cuenta | PII | Acceso autorizado y auditoría | Igual que `email` |
| `password_hash`, `mfa_secret_cifrado` | `public.usuario` | Autenticación y MFA | Secreto / sensible | Argon2id y cifrado AES-256-GCM por aplicación (C-21) | Se borra con la cuenta; nunca aparece en auditoría (C-30) |
| `numero_documento` | `academic.estudiante` | Identificación única y duplicados | PII sensible | Cifrado AES-256-GCM + índice ciego HMAC (C-21/C-22) | Anonimización del registro vivo; el evento no se altera |
| `nombres`, `apellidos`, `fecha_nacimiento` | `academic.estudiante` | Identificación del estudiante | PII | Permisos por ámbito y auditoría de consulta (C-16/C-27) | Anonimización al cesar la relación |
| `direccion`, `telefono` | `academic.estudiante` | Contacto | PII sensible | Cifrado por aplicación (C-21) | Anonimización |
| `municipio`, `barrio` | `academic.estudiante` | Distribución geográfica (CAR-05) | PII agregable | Solo agregados con celdas < 5 suprimidas; sin PII individual | Se conserva el agregado; el registro vivo se anonimiza |
| `acudiente` | `academic.estudiante` | Contacto del acudiente | PII / pendiente PA-004 | **Sin acceso por defecto** a datos del estudiante (R-007) | Estructura y alcance pendientes de decisión de negocio |
| `consentimiento_datos` | `academic.estudiante` | Evidencia de aceptación, fecha y versión del aviso | Evidencia de tratamiento | Registro `aceptado`, `fecha`, `versionAviso`, `medio` | Se conserva con la trazabilidad del tratamiento |
| Observaciones de evaluación | `academic.evaluacion_cualitativa` | Seguimiento académico | Texto libre con posible PII | No se copia a auditoría (AC-AUD-08); ámbito de educador | Anonimización del registro vivo; sin borrado del evento |
| Cuerpo de notificación | `public.notificacion` | Comunicación al destinatario | PII en el contenido | Bandeja propia; preferencias y eventos auditados | Retención institution; sin copia de datos reales a staging |
| Archivos y exportaciones | `files` / exportaciones | Soporte de procesos académicos | PII potencial | Lista blanca, cuarentena, descarga autorizada y auditoría antes de responder | Misma retención que auditoría; sin purga automática |
| `evento_auditoria` | `public` | Trazabilidad CAR-12 | Minimizada por diseño | Redacción por lista blanca, email como HMAC (C-30) | ≥ 5 años; **nunca se borra ni se edita** desde la aplicación |

## 2. Derechos del titular

- **Acceso y corrección:** se atienden por los flujos autorizados de consulta y por evento compensatorio cuando la corrección afecte a un dato ya registrado; la auditoría no se modifica.
- **Supresión:** se ejecuta como anonimización del registro vivo cuando existe deber de conservación. El evento `estudiante.anonimizado` ya está en el catálogo y no requiere ampliación.
- **Consentimiento:** `consentimiento_datos` conserva fecha y versión del aviso; cualquier cambio de finalidad exige decisión de negocio, no solo cambio técnico.

## 3. Límites de este inventario

1. No se ejecutó anonimización sobre datos reales: no hay entorno ni autorización en C8; el procedimiento queda como acta pendiente.
2. `acudiente` sigue condicionado a PA-004; Rol B no define su relación de acceso.
3. Staging y desarrollo usan semilla o copia anonimizada (C-26); la verificación de la carga depende de entorno.
4. Los runbooks no se modifican sin prueba asociada; la revisión de C-46 está en `docs/reviews/c8/rol-b.md`.
