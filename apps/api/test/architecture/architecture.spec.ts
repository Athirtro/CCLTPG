import 'reflect-metadata';

import { createRequire } from 'node:module';

import type { ICruiseOptions } from 'dependency-cruiser';
import { cruise } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

type ForbiddenRule = {
  name: string;
  severity: 'error' | 'warn' | 'info' | 'ignore';
  comment?: string;
  from: Record<string, unknown>;
  to: Record<string, unknown>;
};

type ForbiddenRules = ForbiddenRule[];

interface ArchitectureConfig {
  forbidden: ForbiddenRules;
  options: ICruiseOptions;
}

function loadConfig(): ArchitectureConfig {
  const loaded = require('../../../../.dependency-cruiser.mjs') as {
    default: ArchitectureConfig;
  };
  return loaded.default;
}

/**
 * Las reglas se escriben contra `src/...`. Para el fixture se reescriben con
 * su prefijo, de modo que la prueba ejercita exactamente las mismas reglas.
 */
function rewritePaths(rules: ForbiddenRules, prefix: string): ForbiddenRules {
  function rewriteFilter(filter: Record<string, unknown>): Record<string, unknown> {
    const copy = { ...filter };
    for (const key of ['path', 'pathNot']) {
      const value = copy[key];
      if (typeof value === 'string' && value.startsWith('^src/')) {
        copy[key] = value.replace(/^\^src\//, `^${prefix}src/`);
      }
    }
    return copy;
  }

  return rules.map((rule) => ({
    ...rule,
    from: rewriteFilter(rule.from),
    to: rewriteFilter(rule.to),
  }));
}

async function violationsFor(
  files: string[],
  options: { prefix?: string } = {},
): Promise<{ rules: string[]; modules: number; dependencies: number }> {
  const config = loadConfig();
  const forbidden = options.prefix
    ? rewritePaths(config.forbidden, options.prefix)
    : config.forbidden;

  const result = await cruise(
    files,
    {
      ...config.options,
      validate: true,
      ruleSet: { forbidden },
      outputType: 'json',
    },
    {
      extensions: ['.js', '.ts', '.json'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  );

  const output =
    typeof result.output === 'string'
      ? (JSON.parse(result.output) as {
          summary: {
            violations: Array<{ rule: { name: string } }>;
            totalCruised: number;
            totalDependenciesCruised: number;
          };
        })
      : result.output;

  return {
    rules: output.summary.violations.map((violation) => violation.rule.name),
    modules: output.summary.totalCruised ?? 0,
    dependencies: output.summary.totalDependenciesCruised ?? 0,
  };
}

const FIXTURE = 'test/fixtures/architecture/violation/';
const FIXTURE_PREFIX = FIXTURE;

describe('arquitectura del monolito modular (C-34)', () => {
  it('el código real no viola las reglas de contextos ni de capas', async () => {
    const result = await violationsFor(['src']);
    expect(result.rules).toEqual([]);
    expect(result.modules).toBeGreaterThan(0);
  }, 120_000);

  it('detecta una violación deliberada: dominio importando pg', async () => {
    const result = await violationsFor([`${FIXTURE}src`], { prefix: FIXTURE_PREFIX });
    expect(result.rules).toContain('dominio-sin-frameworks');
  }, 120_000);

  it('detecta una violación deliberada: un contexto importando otro', async () => {
    const result = await violationsFor([`${FIXTURE}src`], { prefix: FIXTURE_PREFIX });
    expect(result.rules).toContain('contextos-aislados');
  }, 120_000);
});
