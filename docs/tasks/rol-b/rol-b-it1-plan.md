# Plan de trabajo — Iteración 1 (Rol B)

- **Fecha:** 2026-11-16
- **Iteración / compuerta:** Iteración 1 — Esqueleto caminante / Compuerta 1
- **Responsable:** Rol B (seguridad, identidad y operación)
- **Estado:** **Propuesto; no iniciado.** Bloqueado hasta que exista acta de C0 (ver §2).
- **Regla:** este plan no autoriza código por sí solo. C1 empieza cuando el equipo apruebe C0 y el plan; hasta entonces solo se preparan documentos y decisiones.
- **Alcance:** infraestructura de desarrollo, CI, migraciones, roles de base, contratos, observabilidad y línea base de seguridad. La identidad, RBAC y auditoría funcional son C2.

## 1. Respuesta corta: ¿se puede empezar C1?

**Hoy no, en sentido estricto.** El diseño caps. 18 y 19 exige que cada compuerta termine con aprobación humana explícita antes de continuar. C0 tiene cinco condiciones P0 abiertas (`docs/reviews/c0/estado-cierre.md` §4):

1. Rol A aplica RC-A-01…04 en el diccionario.
2. Rol C aplica RC-C-01…04 en catálogo y OpenAPI.
3. El equipo ratifica ADR-0001…0004, R-018…R-031 y PA-006.
4. El equipo confirma PA-001, PA-003 y PA-005.
5. El equipo ratifica PA-017 o crea el catálogo de requisitos.

**Vía recomendada para arrancar ya:** aprobación de C0 **con condiciones**, limitada a las tareas de C1 que no dependen de los artefactos pendientes (esqueleto, CI, contenedores, roles de base, contratos base). Las tareas que tocan el modelo de datos o las rutas esperan a Rol A/C. La condición 3 no se puede omitir: sin ADR ratificados no hay línea base de seguridad que C1 deba respetar.

## 2. Condiciones de entrada a C1

| # | Condición | Estado actual | Dueño | ¿Bloquea todo C1 o solo parte? |
| --- | --- | --- | --- | --- |
| 1 | Acta de C0 firmada | Pendiente | Equipo | Bloquea todo |
| 2 | ADR-0001…0004 ratificados | Pendiente | Equipo | Bloquea todo |
| 3 | RC-A-01…04 aplicados | Pendiente | Rol A | Bloquea migraciones del modelo (RB1-03/04) |
| 4 | RC-C-01…04 aplicados | Pendiente | Rol C | Bloquea contratos y rutas (RB1-07/08) |
| 5 | PA-006 y PA-017 ratificadas | Pendiente | Equipo | Bloquea contratos y criterios |
| 6 | PA-001, PA-003, PA-005 confirmadas | Pendiente | Equipo | Bloquea convenciones de repositorio |
| 7 | Congelamiento de C0 declarado | Pendiente | Equipo | Bloquea cambios de contrato |

## 3. Objetivo de C1

**General (diseño §18.2):** clonar el repositorio, ejecutar un comando y obtener el sistema funcionando (PostgreSQL, Redis, almacén de objetos, migraciones, API y SPA), con CI en verde y pruebas de arquitectura que fallen ante una violación deliberada.

**De Rol B:** que el esqueleto nazca con la línea base de seguridad ya puesta, no como deuda para C2:

- Roles de base con privilegios mínimos y migraciones reversibles.
- CI que bloquea secretos, dependencias críticas y contratos incompletos.
- Contratos con `x-*` validados y cobertura bidireccional con la matriz.
- Observabilidad con `requestId` y redacción de PII desde el primer log.
- Cabeceras, CORS y límites de cuerpo configurados.
- Ninguna ruta protegida “por olvido”: guard y allowlist se prueban desde C1, aunque la autenticación real llegue en C2.

## 4. Tareas propuestas

Convención: `RB1-nn`. Cada tarea declara entregable, criterio de aceptación y dependencia.

| ID | Tarea | Entregable | Criterio de aceptación | Depende de |
| --- | --- | --- | --- | --- |
| RB1-01 | Espacio de trabajo monorepo | `pnpm-workspace.yaml`, `package.json` raíz, `packages/config` con TS/ESLint/Prettier compartidos | `pnpm install` limpio; lint y typecheck corren desde la raíz | Acta C0 |
| RB1-02 | Entorno contenerizado de desarrollo | `infra/compose/docker-compose.yml` con PostgreSQL 16, Redis, MinIO, healthchecks y volúmenes | Un comando levanta todo; `docker compose ps` muestra servicios sanos | RB1-01 |
| RB1-03 | Migrador y carpetas por esquema | Kysely migrator, `migrations/public`, `migrations/academic`, checksums, `up/down/up` | Migración de prueba sube, baja y vuelve a subir sobre base vacía | RB1-02, RC-A |
| RB1-04 | Roles y privilegios de base | Script de inicialización de `ccltpg_migrator`, `ccltpg_app`, `ccltpg_readonly` | La app no puede ejecutar DDL; el migrador sí; `readonly` solo lee | RB1-02 |
| RB1-05 | Bootstrap del backend | NestJS con prefijo `/api/v1`, validación, filtro Problem Details, `requestId`, Pino con redacción y `/health/live` + `/health/ready` | `GET /api/v1/health/ready` responde 200 con base y Redis; error de prueba devuelve Problem Details con `code` y `requestId` | RB1-01, RB1-02 |
| RB1-06 | Bootstrap del frontend | Vite + React + TS + MUI, página de salud y layout base | `pnpm dev` levanta la SPA; consume `/health/ready` y muestra estado | RB1-01 |
| RB1-07 | Pipeline OpenAPI | OpenAPI generado desde código, lint (Spectral), `packages/contracts` generado y verificación de cambios rupturistas | CI falla si el OpenAPI cambia sin regenerar contratos | RB1-05, RC-C |
| RB1-08 | Validador de seguridad del contrato | Script que exige `x-access`, `x-permission`, `x-scope`, `x-audit-event`; allowlist pública exacta; catálogo de eventos bidireccional | CI falla si una operación no declara acceso o si un evento no existe en el catálogo (R-031) | RB1-07 |
| RB1-09 | Pipeline de CI | GitHub Actions: install, lint, typecheck, unit, integration, architecture, contract, SCA, secret scan, build | Pipeline verde; checks obligatorios en PR | RB1-01…08 |
| RB1-10 | Pruebas de arquitectura | `dependency-cruiser` con reglas de contextos y una violación deliberada en un test | El test falla cuando se importa infraestructura desde dominio o un contexto desde otro | RB1-01 |
| RB1-11 | Línea base de seguridad HTTP | Helmet, CORS cerrado, límite de cuerpo, cookies `__Host-` y configuración TLS documentada | Inspección de cabeceras en prueba de contrato; `Origin` no permitido rechazado | RB1-05 |
| RB1-12 | Gestión de secretos | `.env.example` sin valores reales, secretos en GitHub Actions, escaneo en CI y documentación de rotación | El repositorio no contiene secretos; el job de escaneo pasa | RB1-01, RB1-09 |
| RB1-13 | Observabilidad mínima | Logs estructurados con `requestId`, redacción de email/tokens/PII, métricas base y trazas configuradas | Una solicitud de prueba genera log y traza correlacionados; no aparece PII | RB1-05 |
| RB1-14 | Documentación y paquete C1 | README de arranque, runbook mínimo, registro de tarea y esqueleto de `docs/reviews/c1/rol-b.md` | Un tercero clona, arranca y verifica el sistema siguiendo el README | Todas |

## 5. Decisiones que debes tomar (con recomendación)

Estas son decisiones de equipo, no de Rol B. Cada una trae opciones, recomendación y qué pasa si se elige otra.

### D27 — Cómo cerrar C0 para habilitar C1

| Opción | Recomendación | Consecuencia |
| --- | --- | --- |
| A. Cierre pleno: esperar a que Rol A/C terminen y luego firmar | | Cumple el diseño al pie de la letra; retrasa C1 hasta que ambos terminen |
| B. Cierre condicional: firmar C0 con condiciones y autorizar solo tareas de esqueleto | **Recomendada** | C1 arranca ya; las tareas que tocan modelo/contratos esperan; el acta fija fecha límite |
| C. Empezar C1 sin acta | | Viola el diseño y deja el congelamiento sin efecto; no recomendada |

**Recomendación B:** el acta debe listar las 5 condiciones P0, el dueño y la fecha. Mientras se cumplen, C1 avanza en RB1-01, 02, 05, 06, 09, 10, 11, 12 y 13.

### D28 — Fuente canónica del OpenAPI

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. Code-first: NestJS genera el OpenAPI desde DTOs | **Recomendada** | El diseño §6.2 pide “OpenAPI generado desde el código”; evita doble mantenimiento |
| B. Spec-first: el YAML es la fuente y se generan tipos | | Útil si el frontend y el backend evolucionan separados; hoy el equipo es pequeño |

**Si eliges B:** el YAML de `docs/contratos/` pasa a ser canónico y CI valida que el código no lo contradiga.

### D29 — Prefijo de API

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. `/api/v1` desde C1 | **Recomendada** | Ya está en el diseño §6.2 y en `.env.example`; evita un cambio rupturista después |
| B. Sin prefijo y versionar por cabecera | | Añade complejidad y no está en el diseño |

**Acción si eliges A:** actualizar las rutas del OpenAPI y la matriz antes de congelar C1.

### D30 — Herramienta de migraciones

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. Kysely migrator con carpetas por esquema | **Recomendada** | Ya se eligió Kysely; permite `up/down/up` y checksums sin otra dependencia |
| B. node-pg-migrate o Prisma Migrate | | Añade una herramienta y un modelo paralelo; no recomendado |

### D31 — Provisión de roles de base

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. Script de inicialización en Compose con superusuario | **Recomendada** | Los roles son infraestructura, no datos de negocio; se crean una vez |
| B. Migración de base | | Mezcla DDL de infraestructura con el esquema y complica la reversión |

**Regla:** `ccltpg_app` sin `CREATE`, sin `ALTER`, sin `UPDATE/DELETE` sobre auditoría; `ccltpg_readonly` solo `SELECT` en vistas.

### D32 — Secretos en C1

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. `.env` local + GitHub Actions Secrets + escaneo | **Recomendada** | Suficiente para C1; sin costo operativo |
| B. Vault o SOPS desde C1 | | Más seguro, pero añade operación antes de tener despliegue real; evaluar en C5 |

### D33 — Análisis de dependencias e imágenes

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. Dependabot + `pnpm audit` + Trivy | **Recomendada** | Gratuito, integrado con GitHub y cubre imagen y dependencias |
| B. Snyk | | Mejor reporte, pero costo y configuración adicional |

### D34 — Estrategia de pruebas de integración

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. Testcontainers en local y CI | **Recomendada** | Prueba contra PostgreSQL real, como exige el diseño §17 |
| B. Contenedores de servicio del runner | | Más simple, pero se desvía del entorno local |

**Si el runner no soporta Docker:** usar contenedores de servicio solo en CI y Testcontainers en local, documentando la diferencia.

### D35 — Umbral de cobertura

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. 80 % líneas / 70 % ramas y 100 % de la matriz de autorización | **Recomendada** | Exigente sin frenar el esqueleto; la matriz es lo crítico |
| B. 90 % desde C1 | | Difícil de sostener cuando aún no hay lógica de negocio |

### D36 — Cookies en desarrollo

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. `__Host-` en todos los entornos con HTTPS local (mkcert o Caddy) | **Recomendada** | Evita que producción y desarrollo se comporten distinto |
| B. Cookies sin prefijo en desarrollo | | Cómodo, pero oculta errores de `Secure`/`Path` hasta C2 |

### D37 — Cliente de API del frontend

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. `openapi-typescript` + wrapper `fetch` propio | **Recomendada** | Tipos generados sin runtime extra; control de errores y CSRF |
| B. Orval o generador con hooks | | Más azúcar, más dependencia; evaluar si el equipo ya lo domina |

### D38 — Estrategia de ramas y merge

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. Trunk-based con ramas cortas y checks obligatorios | **Recomendada** | Coherente con compuertas y CI; menos merges dolorosos |
| B. Git-flow | | Demasiada ceremonia para un equipo pequeño |

### D39 — Versiones de toolchain

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. Node.js 22 LTS + pnpm 9 vía Corepack | **Recomendada** | Soporte LTS y reproducibilidad |
| B. Node 20 | | También válido; elegir una y fijarla en `.nvmrc` y CI |

### D40 — Formato de errores

| Opción | Recomendación | Por qué |
| --- | --- | --- |
| A. Filtro propio de Problem Details con `code` estable | **Recomendada** | Control total del contrato y de la redacción; coincide con `auth-v1` |
| B. Librería externa | | Puede imponer un formato que no coincide con el contrato |

## 6. Orden sugerido y dependencias

| Semana | Tareas | Hito |
| --- | --- | --- |
| 1 | RB1-01, RB1-02, RB1-04 | Monorepo y entorno levantan; roles creados |
| 2 | RB1-03, RB1-05, RB1-06 | Migraciones y esqueletos API/SPA funcionan |
| 3 | RB1-07, RB1-08, RB1-10 | Contratos y arquitectura validados en CI |
| 4 | RB1-09, RB1-11, RB1-12, RB1-13, RB1-14 | CI completo, seguridad base y paquete C1 |

Si D27 elige cierre condicional, las semanas 1 y 2 pueden empezar antes de que Rol A/C terminen; las tareas RB1-03 y RB1-07/08 esperan sus artefactos.

## 7. Criterio de salida de C1 (Rol B)

1. `git clone` + un comando levanta PostgreSQL, Redis, MinIO, API y SPA.
2. `/api/v1/health/live` y `/ready` responden; la SPA muestra el estado.
3. CI verde con lint, typecheck, unitarias, integración, arquitectura, contrato, SCA, secretos y build.
4. La prueba de arquitectura falla con una violación deliberada.
5. Migraciones `up/down/up` sobre base vacía y sobre la instantánea de C0.
6. Roles de base con privilegios mínimos verificados por prueba.
7. OpenAPI con `x-*` completo y catálogo de eventos validado en ambos sentidos.
8. Cero secretos en el repositorio y cero vulnerabilidades críticas abiertas sin excepción firmada.
9. Paquete `docs/reviews/c1/rol-b.md` con evidencia y autoevaluación anti-deriva.

## 8. Qué no se hace en C1

- No se implementa login, MFA, refresh, RBAC ni auditoría funcional: son C2.
- No se implementan módulos académicos, archivos, notificaciones ni exportaciones.
- No se cargan datos reales; solo semilla sintética.
- No se despliega a producción ni se contrata infraestructura.
- No se modifican artefactos congelados sin solicitud de cambio.

## 9. Hoja de decisiones para el equipo

Marcar una opción por fila. La recomendación de Rol B es la primera.

| Decisión | Opción A (recomendada) | Opción B | Opción C | Elección |
| --- | --- | --- | --- | --- |
| D27 Cierre de C0 | Condicional con fecha | Pleno | Sin acta | ☐ |
| D28 OpenAPI | Code-first | Spec-first | — | ☐ |
| D29 Prefijo | `/api/v1` | Sin prefijo | — | ☐ |
| D30 Migraciones | Kysely migrator | Otra herramienta | — | ☐ |
| D31 Roles | Script de init | Migración | — | ☐ |
| D32 Secretos | `.env` + GitHub Secrets | Vault/SOPS | — | ☐ |
| D33 SCA | Dependabot + Trivy | Snyk | — | ☐ |
| D34 Integración | Testcontainers | Servicios del runner | Mixto | ☐ |
| D35 Cobertura | 80/70 + matriz 100 % | 90 % | — | ☐ |
| D36 Cookies dev | `__Host-` + HTTPS local | Sin prefijo | — | ☐ |
| D37 Cliente API | `openapi-typescript` | Orval | — | ☐ |
| D38 Ramas | Trunk-based | Git-flow | — | ☐ |
| D39 Toolchain | Node 22 + pnpm 9 | Node 20 | — | ☐ |
| D40 Errores | Filtro propio | Librería | — | ☐ |

**Cuando marques D27 y las decisiones de la §5, el plan queda listo para convertirse en tareas ejecutables de Iteración 1.**
