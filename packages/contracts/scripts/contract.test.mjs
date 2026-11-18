import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateContract } from './lib/contract-validation.mjs';

const documentedEvents = ['sesion.iniciada', 'grupo.creado'];

function baseDocument(operationOverrides = {}, additionalPath) {
  const operation = {
    operationId: 'healthLive',
    summary: 'Liveness',
    tags: ['salud'],
    security: [],
    'x-access': 'public',
    'x-permission': [],
    'x-scope': 'global',
    'x-audit-event': '-',
    'x-error-codes': [],
    ...operationOverrides,
  };

  const paths = { '/health/live': { get: operation } };
  if (additionalPath) {
    Object.assign(paths, additionalPath);
  }

  return {
    openapi: '3.0.3',
    info: { title: 'prueba', version: '1.0.0' },
    servers: [{ url: '/api/v1' }],
    paths,
  };
}

function catalogOf(events = documentedEvents) {
  return { version: '1.0', source: 'prueba', events };
}

function allowlistOf(routes = ['GET /api/v1/health/live']) {
  return { version: '1.0', routes };
}

function validate(document, catalog = catalogOf(), allowlist = allowlistOf()) {
  return validateContract({ document, catalog, allowlist, documentedEvents });
}

test('acepta un contrato completo y una allowlist exacta', () => {
  const result = validate(baseDocument());
  assert.deepEqual(result.errors, []);
  assert.equal(result.stats.operations, 1);
  assert.equal(result.stats.publicOperations, 1);
});

test('falla si una operación no declara x-access (C-14)', () => {
  const result = validate(baseDocument({ 'x-access': undefined }));
  assert.ok(result.errors.some((error) => error.includes('x-access ausente')));
});

test('falla si una operación permission no declara permisos', () => {
  const result = validate(baseDocument({ 'x-access': 'permission', 'x-permission': [] }));
  assert.ok(result.errors.some((error) => error.includes('exige al menos un permiso')));
});

test('falla si el evento de auditoría no existe en el catálogo (R-031)', () => {
  const result = validate(baseDocument({ 'x-audit-event': 'grupo.inventado' }));
  assert.ok(result.errors.some((error) => error.includes('no existe en el catálogo')));
});

test('falla si una operación mutante no audita sin justificación', () => {
  const operation = {
    operationId: 'healthCreate',
    summary: 'Mutación de prueba',
    tags: ['salud'],
    security: [],
    'x-access': 'public',
    'x-permission': [],
    'x-scope': 'global',
    'x-audit-event': '-',
    'x-error-codes': [],
  };
  const result = validate(baseDocument({}, { '/health/other': { post: operation } }));
  assert.ok(result.errors.some((error) => error.includes('x-audit-exempt')));
});

test('falla si aparece una ruta pública fuera de la allowlist', () => {
  const result = validate(
    baseDocument(
      {},
      {
        '/health/extra': {
          get: {
            operationId: 'healthExtra',
            summary: 'Ruta extra',
            tags: ['salud'],
            security: [],
            'x-access': 'public',
            'x-permission': [],
            'x-scope': 'global',
            'x-audit-event': '-',
            'x-error-codes': [],
          },
        },
      },
    ),
  );
  assert.ok(result.errors.some((error) => error.includes('no incluida en la allowlist')));
});

test('falla si el catálogo generado deriva del documento fuente', () => {
  const result = validate(baseDocument(), catalogOf(['sesion.iniciada']));
  assert.ok(result.errors.some((error) => error.includes('no contiene "grupo.creado"')));
});
