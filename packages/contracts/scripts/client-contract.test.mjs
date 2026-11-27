import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..', '..');
const require = createRequire(resolve(repositoryRoot, 'package.json'));
const ts = require(resolve(repositoryRoot, 'apps/web/node_modules/typescript'));

const document = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'packages/contracts/openapi.json'), 'utf8'),
);
const source = ts.createSourceFile(
  'client.ts',
  readFileSync(resolve(repositoryRoot, 'apps/web/src/api/client.ts'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);

/** Alias locales del cliente, para resolver `requestBody`tipados por nombre. */
const aliases = new Map();
for (const statement of source.statements) {
  if (ts.isTypeAliasDeclaration(statement)) {
    aliases.set(statement.name.text, statement.type);
  }
}

function propertyOf(type, name) {
  if (!type || !ts.isTypeLiteralNode(type)) return undefined;
  return type.members.find(
    (member) =>
      ts.isPropertySignature(member) &&
      member.name.getText(source).replace(/^['"]|['"]$/g, '') === name,
  );
}

function shapeOf(type, seen = new Set()) {
  if (!type) return new Map();
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    const name = type.typeName.text;
    if (seen.has(name)) return new Map();
    return shapeOf(aliases.get(name), new Set([...seen, name]));
  }
  if (!ts.isTypeLiteralNode(type)) return new Map();
  const shape = new Map();
  for (const member of type.members) {
    if (!ts.isPropertySignature(member)) continue;
    const name = member.name.getText(source).replace(/^['"]|['"]$/g, '');
    shape.set(name, !member.questionToken);
  }
  return shape;
}

function clientShape(operationType, section, key) {
  const sectionType = propertyOf(operationType, section)?.type;
  return shapeOf(propertyOf(sectionType, key)?.type);
}

function clientOperations() {
  const pathsType = source.statements.find(
    (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Paths',
  )?.type;
  assert.ok(
    pathsType && ts.isTypeLiteralNode(pathsType),
    'No se encontró el tipo Paths del cliente',
  );

  const operations = [];
  for (const pathMember of pathsType.members) {
    if (!ts.isPropertySignature(pathMember) || !pathMember.type) continue;
    const path = pathMember.name.getText(source).replace(/^['"]|['"]$/g, '');
    if (!ts.isTypeLiteralNode(pathMember.type)) continue;
    for (const methodMember of pathMember.type.members) {
      if (!ts.isPropertySignature(methodMember) || !methodMember.type) continue;
      const method = methodMember.name.getText(source).toLowerCase();
      const content = propertyOf(
        propertyOf(methodMember.type, 'requestBody')?.type,
        'content',
      )?.type;
      operations.push({
        path,
        method,
        query: clientShape(methodMember.type, 'parameters', 'query'),
        body: shapeOf(propertyOf(content, 'application/json')?.type),
        hasJsonBody: Boolean(propertyOf(content, 'application/json')),
        hasMultipart: Boolean(propertyOf(content, 'multipart/form-data')),
      });
    }
  }
  return operations;
}

function resolveSchemaRef(schema) {
  if (!schema) return undefined;
  if (!schema.$ref) return schema;
  const name = schema.$ref.split('/').at(-1);
  return document.components?.schemas?.[name];
}

function contractShape(schema) {
  const resolved = resolveSchemaRef(schema);
  if (!resolved || resolved.type !== 'object' || !resolved.properties) return new Map();
  const required = new Set(resolved.required ?? []);
  return new Map(
    Object.entries(resolved.properties).map(([name, value]) => [
      name,
      required.has(name) || value.required === true,
    ]),
  );
}

function contractOperation(path, method) {
  const operation = document.paths?.[path]?.[method];
  if (!operation) return undefined;
  const query = new Map(
    (operation.parameters ?? [])
      .filter((parameter) => parameter.in === 'query')
      .map((parameter) => [parameter.name, parameter.required !== false]),
  );
  const json = operation.requestBody?.content?.['application/json'];
  return {
    query,
    body: json ? contractShape(json.schema) : new Map(),
    hasJsonBody: Boolean(json),
    hasMultipart: Boolean(operation.requestBody?.content?.['multipart/form-data']),
  };
}

function compareShapes(label, expected, actual, errors) {
  for (const [name, required] of expected) {
    if (!actual.has(name)) {
      errors.push(`${label}: el cliente declara "${name}" ausente en openapi.json`);
    } else if (actual.get(name) !== required) {
      errors.push(
        `${label}: "${name}" es ${required ? 'obligatorio' : 'opcional'} en el cliente y ${
          actual.get(name) ? 'obligatorio' : 'opcional'
        } en openapi.json`,
      );
    }
  }
  for (const [name] of actual) {
    if (!expected.has(name)) {
      errors.push(`${label}: openapi.json declara "${name}" ausente en el cliente`);
    }
  }
}

const operations = clientOperations();
const errors = [];

/** Toda operación del contrato debe estar declarada en el cliente generado. */
const OPERACIONES_NO_CONSUMIDAS = new Set([]);

test('el cliente declara todas las operaciones del contrato', () => {
  const clientPaths = new Set(
    operations.map((operation) => `${operation.method} ${operation.path}`),
  );
  const contractPaths = new Set();
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of Object.keys(item)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        contractPaths.add(`${method} ${path}`);
      }
    }
  }
  for (const key of clientPaths) {
    if (!contractPaths.has(key)) errors.push(`El cliente usa ${key}, ausente en openapi.json`);
  }
  for (const key of contractPaths) {
    if (!clientPaths.has(key) && !OPERACIONES_NO_CONSUMIDAS.has(key)) {
      errors.push(`El contrato documenta ${key}, ausente en el cliente`);
    }
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('los parámetros query y cuerpos JSON coinciden con openapi.json', () => {
  for (const operation of operations) {
    const contract = contractOperation(operation.path, operation.method);
    if (!contract) continue;
    const label = `${operation.method.toUpperCase()} ${operation.path}`;
    compareShapes(`${label} query`, operation.query, contract.query, errors);
    compareShapes(`${label} body`, operation.body, contract.body, errors);
    if (operation.hasJsonBody !== contract.hasJsonBody) {
      errors.push(
        `${label}: el cliente ${operation.hasJsonBody ? 'envía' : 'no envía'} cuerpo JSON y el contrato ${contract.hasJsonBody ? 'lo documenta' : 'no lo documenta'}`,
      );
    }
    if (operation.hasMultipart !== contract.hasMultipart) {
      errors.push(
        `${label}: el cliente ${operation.hasMultipart ? 'envía' : 'no envía'} multipart y el contrato ${contract.hasMultipart ? 'lo documenta' : 'no lo documenta'}`,
      );
    }
  }
  assert.deepEqual(errors, [], errors.join('\n'));
});
