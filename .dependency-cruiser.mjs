/**
 * Reglas de dependencia del monolito modular (diseño §6.1, control C-34).
 * Se ejecutan desde `apps/api`: `depcruise src --config ../../.dependency-cruiser.mjs`.
 */
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * dependency-cruiser no comparte grupos de captura entre `from` y `to`, así que
 * la aislamiento entre contextos se materializa como un par de reglas explícito
 * por cada par de contextos. La lista se descubre del sistema de archivos para
 * que un contexto nuevo quede cubierto sin tocar la configuración.
 */
const CONTEXTS = new Set(['academic']);
try {
  for (const entry of readdirSync(resolve(import.meta.dirname, 'apps/api/src/modules'), {
    withFileTypes: true,
  })) {
    if (entry.isDirectory()) {
      CONTEXTS.add(entry.name);
    }
  }
} catch {
  // Si aún no existe el directorio, quedan las reglas de capas.
}

const isolationRules = [];
for (const from of CONTEXTS) {
  for (const to of CONTEXTS) {
    if (from === to) {
      continue;
    }
    isolationRules.push({
      name: `contexto-${from}-no-importa-${to}`,
      severity: 'error',
      comment: `Un contexto no importa archivos internos de otro contexto: ${from} → ${to} (C-34).`,
      from: { path: `^src/modules/${from}/` },
      to: { path: `^src/modules/${to}/` },
    });
  }
}

export default {
  forbidden: [
    {
      name: 'dominio-sin-frameworks',
      severity: 'error',
      comment:
        'El dominio no puede depender de NestJS, Kysely, pg, Redis, Pino, Prometheus ni OpenTelemetry.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        path: [
          'node_modules/(@nestjs|kysely|pg|ioredis|pino|prom-client|@opentelemetry)(/|$)',
          'node_modules/\\.pnpm/[^/]+/node_modules/(@nestjs|kysely|pg|ioredis|pino|prom-client|@opentelemetry)(/|$)',
        ],
      },
    },
    {
      name: 'dominio-sin-capas-externas',
      severity: 'error',
      comment: 'El dominio solo puede depender de sí mismo y de shared/errors y shared/openapi.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: '^src/modules/[^/]+/(api|application|infrastructure)/' },
    },
    {
      name: 'aplicacion-sin-infraestructura',
      severity: 'error',
      comment: 'La capa de aplicación define puertos; la infraestructura implementa. No al revés.',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^src/modules/[^/]+/(api|infrastructure)/' },
    },
    ...isolationRules,
    {
      name: 'shared-no-depende-de-contextos',
      severity: 'error',
      comment: 'shared es transversal; nunca importa un contexto de negocio.',
      from: { path: '^src/shared/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'acceso-a-datos-solo-en-infraestructura',
      severity: 'error',
      comment:
        'pg y Kysely solo pueden usarse en database/ o en infrastructure/ de un contexto (C-34).',
      from: { pathNot: '^src/(database|health|modules/[^/]+/infrastructure)/' },
      to: {
        path: [
          'node_modules/(pg|kysely)(/|$)',
          'node_modules/\\.pnpm/[^/]+/node_modules/(pg|kysely)(/|$)',
        ],
      },
    },
    {
      name: 'sin-ciclos',
      severity: 'error',
      comment: 'Los ciclos entre módulos indican un límite mal trazado.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|\\.spec\\.ts$)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.js', '.ts', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
