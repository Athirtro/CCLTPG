import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateContract } from './lib/contract-validation.mjs';

const documentedEvents = [
  'sesion.iniciada',
  'grupo.creado',
  'usuario.activado',
  'usuario.desactivado',
  'usuario.bloqueado',
];

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

test('falla si una operación autenticada no declara esquema de seguridad', () => {
  const result = validate(
    baseDocument({
      security: undefined,
      'x-access': 'authenticated',
      'x-scope': 'own',
    }),
  );
  assert.ok(result.errors.some((error) => error.includes('esquema de seguridad')));
});

test('acepta una operación parcial sin esquema de seguridad (token en el cuerpo)', () => {
  const operation = {
    operationId: 'verifyMfa',
    summary: 'Verificación MFA',
    tags: ['autenticación'],
    'x-access': 'partial',
    'x-permission': [],
    'x-scope': 'global',
    'x-partial-scope': ['mfa_verify'],
    'x-audit-event': 'sesion.iniciada',
    'x-error-codes': [],
  };
  const result = validate(baseDocument({}, { '/auth/mfa/verify': { post: operation } }));
  assert.deepEqual(result.errors, []);
});

test('acepta la plantilla usuario.<estado> si todas sus expansiones existen', () => {
  const result = validate(baseDocument({ 'x-audit-event': 'usuario.<estado>' }));
  assert.deepEqual(result.errors, []);
});

test('falla si falta una expansión de la plantilla usuario.<estado>', () => {
  const documented = ['sesion.iniciada', 'grupo.creado', 'usuario.activado'];
  const result = validateContract({
    document: baseDocument({ 'x-audit-event': 'usuario.<estado>' }),
    catalog: { version: '1.0', events: documented },
    allowlist: allowlistOf(),
    documentedEvents: documented,
  });
  assert.ok(result.errors.some((error) => error.includes('expansiones fuera del catálogo')));
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
