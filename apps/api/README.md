# apps/api — Backend (CCLTPG)

**Estado:** esqueleto/placeholder (Iteración 1 pendiente de implementación).

## Propósito
Backend NestJS (TypeScript estricto) del monolito modular CCLTPG. Contendrá los contextos: identity, audit, files, notifications, exports, analytics (esquema `public`) y academic (esquema `academic`).

## Comandos previstos (a completar en Iteración 1)
- Levantar entorno de desarrollo: definido en `infra/compose/` (PostgreSQL 16, Redis, API).
- Instalar dependencias: `pnpm install` (cuando se definan manifiestos).
- Migraciones (`up/down` por esquema, sobre base vacía y verificación `up, down, up`): script del migrador en `src/database/migrator/`.
- Pruebas: unitarias (Vitest), API (Supertest), integración (Testcontainers con PostgreSQL real), arquitectura.
- Lint/formato/tipos: ESLint, Prettier, `tsc --noEmit` (cero advertencias nuevas).

## Endpoint de salud (objetivo Iteración 1)
- `GET /api/v1/health` con `requestId` en logs estructurados (pino).

## Referencias
- `docs/diseno-arquitectonico.md` (caps. 4–6, 16–19)
- `docs/contratos/` (propuestas pendientes de aprobación en C0)
- `docs/diccionario-datos.md`
