# ADR-0003 — Cifrado de columnas sensibles e índice ciego para el documento

- **Estado:** Aceptada por Rol B (2026-11-16); requiere ratificación del equipo en Compuerta 0 y actualización del diccionario por Rol A.
- **Fecha:** 2026-11-16
- **Decisores:** Rol B (autor); Rol A (modelo y diccionario); aprobación humana en C0.
- **Trazabilidad:** diseño caps. 7.1, 12, 13; R-006, R-025; Ley 1581 de 2012 y Decreto 1377 de 2013; inventario G-10; `docs/diccionario-datos.md` §§1, 3.4, 4.

## Contexto

El capítulo 12 exige cifrado a nivel de aplicación de las columnas designadas como sensibles: **documento, contacto y dirección**. El diccionario marca `direccion` y `telefono` como sensibles, pero deja `numero_documento` como **no sensible y único**. Si el documento se cifra con un algoritmo no determinista, la restricción `UNIQUE` y la búsqueda por documento dejan de funcionar. Además, el modelo no puede consultar por texto cifrado y la unicidad es una regla de negocio (evitar estudiantes duplicados).

## Decisión

1. **Cifrado autenticado.** AES-256-GCM con nonce aleatorio de 12 bytes por valor, tag de 16 bytes y AAD = `esquema.tabla.columna`. Formato almacenado: `v1:<kid>:<base64url(nonce || ciphertext || tag)>`.
2. **Campos cifrados en v1.0:** `academic.estudiante.numero_documento`, `direccion`, `telefono`; `public.usuario.mfa_secret_cifrado` (ya previsto). `email` se mantiene en claro porque es el identificador de login, pero se trata como PII: acceso autorizado, minimización en auditoría y prohibición de registrarlo completo en logs.
3. **Índice ciego para el documento.** Se añade `academic.estudiante.numero_documento_hash` (HMAC-SHA256 con clave separada de las de cifrado), calculado sobre el documento normalizado (NFKC, mayúsculas, sin espacios ni `.-`, conservando alfanuméricos). Índice **único** sobre `numero_documento_hash`; `numero_documento` pasa a ser texto cifrado.
4. **Excepción documentada — email.** El capítulo 12 menciona “contacto”; en v1.0 se interpreta como teléfono y dirección. `public.usuario.email` permanece en claro porque es el identificador de login y el destino de notificaciones: se protege con unicidad, acceso autorizado, auditoría de lectura y minimización en logs; no se permite búsqueda parcial ni ordenamiento por email. Si el equipo interpreta que “contacto” incluye el email, se aplica el mismo patrón (ciphertext + `email_hash` único) antes de C2 y se registra como cambio de modelo.
5. **Búsqueda solo por igualdad.** No hay búsqueda parcial, por rango ni ordenamiento por documento. La API expone búsqueda exacta por documento y devuelve el valor enmascarado salvo para quien tenga permiso de gestión del recurso; toda lectura de PII se audita.
6. **Gestión de claves.** Claves de 32 bytes en el gestor de secretos del entorno, nunca en el repositorio ni en la base de datos. `kid` permite rotación anual o por incidente; se aceptan dos `kid` durante la transición y un trabajo de re-cifrado por lotes actualiza los valores antiguos. El índice ciego usa una clave distinta y su rotación implica reindexación planificada.
7. **Sin `pgcrypto`.** El cifrado ocurre en la aplicación, antes de persistir, para que la clave no viva en PostgreSQL ni en los respaldos.
8. **Respaldos.** Los respaldos contienen ciphertext; las claves se respaldan por separado en el gestor de secretos. Sin la clave, el dato no es recuperable (lo cual es intencional).

## Modelo de datos impactado

| Tabla | Cambio | Nota |
| --- | --- | --- |
| `academic.estudiante` | `numero_documento` pasa a ciphertext; se añade `numero_documento_hash` (único) | Reemplaza el índice `estudiante(numero_documento)` por `estudiante(numero_documento_hash)` |
| `academic.estudiante` | `direccion`, `telefono` cifrados | Ya marcados sensibles en el diccionario |
| `public.usuario` | `mfa_secret_cifrado` cifrado | Ya previsto en el diseño y el diccionario |
| `public.codigo_recuperacion_mfa` | Nueva tabla (R-027) con `codigo_hash` | Argon2id; no se cifra porque es hash |

## Alternativas consideradas

| Alternativa | Motivo de rechazo |
| --- | --- |
| `pgcrypto` en la base de datos | La clave viaja a PostgreSQL y a los respaldos; dificulta la separación de deberes |
| Cifrado determinista del documento | Permitiría unicidad, pero filtra patrones y es criptográficamente débil |
| Solo hash del documento (sin cifrado) | Impide recuperar el valor para trámites y reportes |
| Documento en claro con control de acceso | Contradice el capítulo 12 y el principio de minimización |
| Índice ciego sobre email u otros campos | No se necesita para login; se reevalúa si el email deja de ser identificador |

## Consecuencias

- **Positivas:** cumple cap. 12/13; unicidad y búsqueda exacta siguen funcionando; el documento no queda expuesto en respaldos.
- **Negativas:** no se puede buscar por prefijo ni ordenar por documento; el índice ciego revela igualdad (frecuencia) a quien tenga acceso a la base; la rotación de claves exige re-cifrado/reindexación.
- **Operativas:** el gestor de secretos es un requisito de despliegue; sin él no arranca la aplicación en producción. Se registra como control en la tarea 5.
- **Compatibilidad:** los cambios de diccionario y migraciones se aplican antes de C2 (modelo v1 se congela en C0).

## Cumplimiento

- C0: aprobar R-025; Rol A actualiza diccionario e índices.
- C2: migración con `numero_documento_hash` único y pruebas de duplicado (`STUDENT_DUPLICATE`).
- C4: cifrado/descifrado en el repositorio de estudiantes y auditoría de lectura de PII.
- C8: rotación de claves y procedimiento de supresión/anonimización documentado.
