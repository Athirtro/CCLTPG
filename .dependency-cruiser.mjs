/**
 * Reglas de dependencia del monolito modular (diseño §6.1, control C-34).
 * Se ejecutan desde `apps/api`: `depcruise src --config ../../.dependency-cruiser.mjs`.
 */
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
    {
      name: 'contextos-aislados',
      severity: 'error',
      comment:
        'Un contexto no importa archivos internos de otro contexto; la colaboración pasa por contratos explícitos (C2).',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/(?!\\1/)[^/]+/' },
    },
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
