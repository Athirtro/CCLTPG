#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXCLUDED_PATHS = [
  /^pnpm-lock\.yaml$/,
  /^\.env\.example$/,
  /^infra\/compose\/\.env\.example$/,
  /^packages\/contracts\/openapi\.json$/,
  /^packages\/contracts\/events\.json$/,
  /^\.gitleaks\.toml$/,
  /^scripts\/secret-scan\.test\.mjs$/,
  /^docs\//,
  /^apps\/api\/test\/fixtures\//,
  // Credenciales deterministas de la suite E2E: se crean y se usan solo contra
  // la base local sembrada por e2e/global-setup.ts. Nunca son secretos de CI.
  /^e2e\/fixtures\.ts$/,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /\.(png|jpg|jpeg|gif|webp|ico|pdf|lock)$/i,
];

const PLACEHOLDER =
  /(change[_-]?me|placeholder|example|dummy|sample|local_only|your[_-]|xxx+|<[^>]+>|test|fake)/i;

const RULES = [
  {
    name: 'private-key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    name: 'aws-access-key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: 'github-token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,
  },
  {
    name: 'slack-token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    name: 'database-url-with-password',
    pattern: /postgres(?:ql)?:\/\/[^:\s/]+:([^@\s]+)@/gi,
    allowPlaceholderGroup: 1,
  },
  {
    name: 'assigned-secret',
    pattern:
      /(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)\s*[:=]\s*['"]([^'"\s]{8,})['"]/gi,
    allowPlaceholderGroup: 1,
  },
];

/**
 * Escanea texto y devuelve hallazgos con número de línea. Los valores de
 * ejemplo (`change_me`, `<...>`, `example`) no cuentan como secretos.
 */
export function scanText(text, file = '<texto>') {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      rule.pattern.lastIndex = 0;
      for (const match of line.matchAll(rule.pattern)) {
        const candidate = rule.allowPlaceholderGroup ? match[rule.allowPlaceholderGroup] : match[0];

        if (candidate && PLACEHOLDER.test(candidate)) {
          continue;
        }

        // `PASSWORD :'app_password'` es una variable de psql, no un secreto.
        if (rule.name === 'assigned-secret' && /:\s*'/u.test(match[0])) {
          continue;
        }

        findings.push({ file, line: index + 1, rule: rule.name });
      }
    }
  }

  return findings;
}

export function isExcluded(file) {
  return EXCLUDED_PATHS.some((pattern) => pattern.test(file));
}

export function scanRepository(repositoryRoot) {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'buffer',
  });

  const findings = [];
  const files = output.toString('utf8').split('\0').filter(Boolean);

  for (const file of files) {
    if (isExcluded(file)) {
      continue;
    }

    let text;
    try {
      text = readFileSync(`${repositoryRoot}/${file}`, 'utf8');
    } catch {
      continue;
    }

    if (text.includes('\0')) {
      continue;
    }

    findings.push(...scanText(text, file));
  }

  return findings;
}

const isCli = process.argv[1]?.endsWith('secret-scan.mjs');

if (isCli) {
  const findings = scanRepository(process.cwd());

  if (findings.length > 0) {
    console.error(`Se encontraron ${findings.length} posibles secretos:`);
    for (const finding of findings) {
      console.error(`  - ${finding.file}:${finding.line} (${finding.rule})`);
    }
    process.exitCode = 1;
  } else {
    console.log('Escaneo de secretos: sin hallazgos.');
  }
}
