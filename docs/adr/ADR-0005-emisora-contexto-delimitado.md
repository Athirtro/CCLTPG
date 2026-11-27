# ADR-0005 — Contexto delimitado Emisora R.A.C.

- **Estado:** Propuesta para aprobación en E0; **no modifica** ADR-0001…ADR-0004 ni los contratos congelados.
- **Fecha:** 2026-11-27
- **Decisores:** Rol B (arquitectura y seguridad); Rol A (modelo de datos); aprobación humana en E0.
- **Trazabilidad:** `docs/diseno-emisora.md` §§1, 2, 3, 4, 5, 6, 15 y 18; ADR-0001 (RBAC), ADR-0003 (cifrado) y ADR-0004 (auditoría); principios P1–P5; hallazgos I3/I4/I6/I7; decisión EM-D-03; supuestos EM-PA-08/09/10.

## Contexto

CCLTPG ya tiene los contextos `identity`, `academic`, `files`, `notifications`, `exports`, `audit` y `analytics`, con contratos C0–C9 congelados y una matriz de autorización ejecutable. El levantamiento funcional de la Emisora Cultural de Pereira (RF-01…RF-12, RNF-01…RNF-06) describe procesos —rejilla anual, convocatoria, grabación, patrocinios, transmisiones, derechos de autor, tecnología y trámites— que no encajan en ninguno de esos contextos sin acoplarlos.

El plan de integración (v0.2) fija la regla de oro «todo cambio es aditivo»: se pueden añadir entradas a listas cerradas y filas a catálogos, pero no se editan la semántica de tablas, endpoints, permisos ni documentos congelados. La revisión independiente cerró 23 hallazgos, entre ellos la decisión I4 (cómo resolver identidad sin leer `public`) y la necesidad de registrar zona horaria, límites inclusivos y alternativas operativas con valor por defecto. Antes de escribir código en E1 hay que dejar constancia arquitectónica de estos límites.

Por tanto se necesita un ADR nuevo que defina el contexto, sus capas, sus puertos públicos y sus reglas de auditoría/idempotencia, y que remita las decisiones EM-D y los supuestos EM-PA al registro consolidado (ADR-0006).

## Decisión

1. **Contexto delimitado propio.** Se crea `Emisora R.A.C.` como contexto nuevo con esquema PostgreSQL `emisora`, paralelo a `academic` y dueño único de sus datos. Las migraciones viven en `apps/api/src/database/migrations/emisora/` (`0001`…`0004`), con historial propio en `emisora.kysely_migration` y numeración independiente de `public` y `academic`. `'emisora'` se añade a `MIGRATION_SCHEMAS`; `00-roles.sql` crea el esquema y concede `USAGE` a `ccltpg_app`/`ccltpg_readonly` y `USAGE, CREATE` a `ccltpg_migrator`, con `ALTER DEFAULT PRIVILEGES` análogos a los de `academic`. No hay FK cruzadas: las referencias a archivos, usuarios o formación son `uuid` lógicos validados por el contexto dueño.

2. **Capas del módulo.** `apps/api/src/modules/emisora/` se organiza en `domain` (entidades, máquinas de estado, reglas y eventos de dominio, sin NestJS, Kysely, pg ni Redis), `application` (casos de uso, puertos y DTO internos), `infrastructure` (repositorios Kysely y adaptadores) y `api` (controladores REST, DTO y decoradores de contrato bajo `/api/v1/emisora/...`), con `tests/` propio. `.dependency-cruiser.mjs` descubre los contextos leyendo `modules/`, por lo que las reglas `contexto-emisora-no-importa-<otro>` y sus inversas se generan solas: no se edita esa configuración y `arch:check` es la red de seguridad.

3. **Puertos públicos en `shared/integration/`.** Emisora solo depende de tokens declarados en `src/shared/integration/`, un subdirectorio sin dependencias hacia contextos:
   - `IdentityDirectory` (`identity-directory.port.ts`): resuelve `usuario_id`, nombre, correo y `valid_until` de usuarios y perfiles vigentes. Decisión I4 cerrada: lo **exporta `identity`** desde un proveedor nuevo en `identity.module.ts`, de forma simétrica a `FormacionDirectory`.
   - `FormacionDirectory` (`formacion-directory.port.ts`): expone programas, formadores e inscripciones de formación; lo implementa `academic` como proveedor aditivo en `academic.module.ts`.
   - `EmisoraOwnershipPolicy` (`ownership.port.ts`): verifica propiedad para permisos `*_own` de realizador, locutor y operador. Se implementa en `emisora/infrastructure` y resuelve el principal mediante `IdentityDirectory`.

   **Mecanismo de inyección.** La composición se resuelve en la raíz, nunca en `shared`: el módulo aditivo `apps/api/src/integration/emisora-integration.module.ts` importa y reexporta `IdentityModule` y `AcademicModule`, y con ellos los tokens `IDENTITY_DIRECTORY` y `FORMACION_DIRECTORY` que esos módulos publican. `EmisoraModule` importa solo ese puente y registra `EMISORA_OWNERSHIP_POLICY`, sin importar los contextos dueños. Así `arch:check` sigue prohibiendo a la vez `emisora → identity|academic` y `shared → modules`. `test/api/emisora-wiring.spec.ts` compila `AppModule` con `DATABASE`/`REDIS` simulados y comprueba que la política recibe el directorio inyectado y lo consulta, además de resolver `FORMACION_DIRECTORY`.

4. **Prohibición de accesos cruzados.** Emisora **no importa** `src/modules/identity/**` ni `src/modules/academic/**`, **no lee `public`** y no ejecuta SQL contra esquemas ajenos, incluida la resolución de identidad y la verificación de propiedad. La única comunicación con el núcleo es vía los puertos anteriores y los servicios compartidos ya existentes (Archivos, Exportaciones, Notificaciones, Auditoría). Ninguna operación emisora es pública: `public-routes.json` permanece intacto.

5. **Auditoría e idempotencia.** Emisora escribe eventos exclusivamente mediante `AuditPort` (`shared/audit/audit.port.ts`) y, cuando necesite un escritor explícito, `AuditWriterFactory` (`modules/audit/application/ports/audit-writer.factory.ts`), en la **misma transacción** que el cambio; si la escritura falla, la operación se revierte. Está prohibido insertar directamente en `public.evento_auditoria`. Los DTO construyen `datosDespues` solo con claves permitidas, se añaden aditivamente a `SECRET_KEYS` las claves `numero_documento_cifrado`, `numero_documento_hash`, `contacto_cifrado` y `consentimiento_datos`, y los soportes voluminosos se sustituyen por `archivo_id` + hash para no superar los 8 KB antes del truncate. Las creaciones con efecto secundario (convocatoria, grabación, transmisión, orden de emisión, resolución/reporte y radicación de trámite) exigen la cabecera `Idempotency-Key` y usan el store existente `public.idempotency_key` a través del mecanismo compartido, sin consulta directa desde emisora.

   **Evidencia M6 (verificada en E1; no requirió ajustar el plan):** `AuditPort.record(event: AuditEvent): Promise<void>` está en `shared/audit/audit.port.ts`; `KyselyAuditWriter` acepta `Kysely<Database> | Transaction<Database>` y cada UnitOfWork lo construye con la transacción (por ejemplo `files/infrastructure/persistence/kysely-unit-of-work.ts`), de modo que el evento se confirma o se revierte con el cambio. `IdempotencyStore` expone `reserve`/`complete`/`abandon`/`purgeExpired` (`shared/idempotency/idempotency.port.ts`) y `KyselyIdempotencyStore` garantiza la unicidad `(usuario_id, operacion, clave)`. `FileService.upload` encadena reserva → efecto → `complete`/`abandon` y escribe la auditoría dentro de `unitOfWork.run`; `file.service.spec.ts` cubre cada tramo.

6. **Dueño de los datos personales (EM-D-03).** El administrador es el dueño de los datos personales de los realizadores y el responsable de la política de retención. `realizador` es el único agregado con PII de terceros: documento cifrado con índice ciego HMAC para búsqueda, contacto cifrado y `consentimiento_datos` con versión y fecha del aviso (nunca su contenido). La PII no se copia a `datos_antes`/`datos_despues`; la redacción es por nombre de clave, no por evento, según ADR-0003 y ADR-0004. El acceso `*_own` de `realizador_externo` se resuelve por `realizador.usuario_id`, respetando identidad temporal con `valid_until`, y nunca por SQL contra `public`.

7. **Supuestos operativos con valor por defecto (EM-PA-08/09/10).**
   - EM-PA-08: por defecto se insertan las plantillas de notificación nuevas mediante la migración aditiva `public/0009` y se amplía EL-4; la alternativa `emisora.plantilla_notificacion_emisora` con un puerto nuevo en Notificaciones queda registrada si el equipo exige cero escrituras en `public`.
   - EM-PA-09: zona horaria de negocio `America/Bogota`; `timestamptz` UTC para instantes y `date` para fechas de calendario; plazos de 3 semanas y 2 días en días calendario con límite inclusivo, y ventana oct/nov inclusive sobre `date`.
   - EM-PA-10: política opt-in `emisora-audio` dentro de Archivos con `EMISORA_MAX_AUDIO_BYTES` explícito y MIME `audio/mpeg`, `audio/wav`, `audio/ogg`; la política `default` y `POST /api/v1/files` no cambian.

8. **Mismo RBAC y misma UI.** Se usa la gramática `contexto:recurso:acción` sin vocabulario de acciones nuevo, con denegación por defecto, guard global, `ApiContract` y matriz ejecutable (ADR-0001). Los 13 perfiles nuevos viven en `PROFILE_SEEDS` junto a los tres existentes; `administrador` solo gana `emisora:*:manage`. La extensión web se monta bajo `/emisora/*` dentro de `MainLayout`, reutiliza tema y componentes `common/` y no define paleta, tipografía ni contratos de API propios.

9. **Sin lógica financiera.** Viáticos, incentivos, pagos de derechos e inversiones se registran como trazabilidad y estado de trámite: referencias y soportes documentales, sin importes calculados, asientos, compromisos ni envío a SIIF/SAIA/Sayco-Acinpro. Todo soporte se referencia por `archivo_id` lógico del contexto Archivos; el binario no se duplica en `emisora`.

## Alternativas consideradas

| Alternativa | Motivo de rechazo |
| --- | --- |
| Añadir tablas `emisora_*` dentro de `academic` | Rompe P1 y P3: mezcla dueños de datos y obligaría a importar código académico desde la emisora |
| Resolver usuarios con SQL directo contra `public` | Viola P3 y deja sin red de seguridad `arch:check`; la decisión I4 cerró el puerto `IdentityDirectory` en `identity` |
| Base de datos o microservicio separado para la emisora | Fuera del alcance del plan; exige infraestructura, despliegue y contratos nuevos sin necesidad funcional |
| Escribir eventos directamente en `public.evento_auditoria` | Contradice ADR-0004 y el modelo de auditoría inmutable; `AuditWriter` ya ofrece transacción y redacción |
| Crear un sistema de permisos propio para emisora | Contradice ADR-0001 y la regla P5; la matriz ejecutable dejaría de ser la única fuente de autorización |
| Bucket de audio propio y política global de archivos modificada | EM-PA-01/EM-PA-10 fijan política opt-in: cambiar `file-policy.ts` o `MAX_FILE_BYTES` rompería la regresión de `POST /api/v1/files` |
| Renombrar permisos o perfiles existentes para «hacer sitio» | Prohibido por aditividad: ningún permiso existente se elimina ni se renombra (EL-1/EL-2) |

## Consecuencias

- **Positivas:** aislamiento verificable por CI, dueño único de los datos, contratos y RBAC uniformes, trazabilidad documental completa, PII protegida y sin lógica financiera.
- **Negativas:** más archivos y puertos que mantener; resolución de propiedad e identidad añade una consulta por puerto (mitigable con índices y caché del lado del contexto dueño); la matriz documental y la ejecutable pueden divergir si no se resincronizan juntas.
- **Operativas:** `00-roles.sql` debe crear el esquema antes del primer `migrate:up emisora`; EL-1…EL-7 se amplían en el mismo PR que los causa; EM-PA-08/09/10 requieren confirmación de equipo sin bloquear E1.
- **Deuda:** el catálogo de eventos comparte `asistencia.registrada` con el contexto académico (ver enmienda de eventos); se documenta el recurso en cada evento para evitar ambigüedad en consultas de auditoría.

## Cumplimiento

- **E0:** aprobar este ADR junto con la enmienda de gramática, la enmienda de eventos, la matriz emisora y ADR-0006; ningún documento congelado se edita.
- **E1:** verificar firmas de `AuditWriter`/`Idempotency-Key` (M6, evidencia registrada en la decisión 5), registrar los proveedores `IdentityDirectory` y `FormacionDirectory` mediante el puente de composición, ampliar permisos/perfiles y ejecutar `pnpm arch:check` en verde.
- **E2–E4:** aplicar las reglas de dominio (plazos inclusivos, estados, adjuntos) y los eventos de la enmienda; `reporte.generado` se emite además del evento de dominio cuando intervenga Exportaciones.
- **E5:** checklist de no regresión (§17 del plan), regresión completa en verde y cierre de EM-PA-01…EM-PA-10.
