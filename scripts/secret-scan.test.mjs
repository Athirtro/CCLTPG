import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isExcluded, scanText } from './secret-scan.mjs';

test('detecta una clave privada', () => {
  const findings = scanText(
    '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----',
    'fixture.pem',
  );
  assert.ok(findings.some((finding) => finding.rule === 'private-key'));
});

test('detecta un token de GitHub', () => {
  const findings = scanText('token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"', 'fixture.ts');
  assert.ok(findings.some((finding) => finding.rule === 'github-token'));
});

test('detecta una URL de base con contraseña real', () => {
  const findings = scanText(
    'DATABASE_URL=postgresql://ccltpg_app:SuperSecreta123@localhost:5432/ccltpg',
    'fixture.env',
  );
  assert.ok(findings.some((finding) => finding.rule === 'database-url-with-password'));
});

test('no marca valores de ejemplo ni placeholders', () => {
  const text = [
    'DATABASE_URL=postgresql://ccltpg_app:change_me_local_only@localhost:5432/ccltpg',
    'JWT_ACCESS_SECRET=change_me',
    'password: "example-placeholder"',
    'password: "SemillaInicial#2026-test"',
    'token = "<tu-token>"',
  ].join('\n');

  assert.deepEqual(scanText(text, '.env.example'), []);
});

test('no marca variables de psql ni credenciales de CI efímeras', () => {
  const text = [
    "CREATE ROLE ccltpg_app LOGIN PASSWORD :'app_password';",
    'DATABASE_URL=postgresql://ccltpg_app:ccltpg_test_app@localhost:5432/ccltpg',
    'password: "ccltpg_test_readonly"',
  ].join('\n');

  assert.deepEqual(scanText(text, 'fixture.sql'), []);
});

test('excluye artefactos generados y documentación congelada', () => {
  assert.equal(isExcluded('pnpm-lock.yaml'), true);
  assert.equal(isExcluded('docs/contratos/api-v1.openapi.yaml'), true);
  assert.equal(isExcluded('apps/api/src/main.ts'), false);
});
