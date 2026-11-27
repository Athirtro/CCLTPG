import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..', '..');
const webSourceRoot = resolve(repositoryRoot, 'apps/web/src');

const document = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'packages/contracts/openapi.json'), 'utf8'),
);

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

function listarArchivos(directorio, archivos = []) {
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      listarArchivos(ruta, archivos);
    } else if (/\.tsx?$/.test(entrada.name)) {
      archivos.push(ruta);
    }
  }
  return archivos;
}

/** Convierte rutas con plantillas JS en rutas canónicas del contrato. */
function normalizarRuta(ruta) {
  return ruta.replace(/\$\{([^}]+)\}/g, (_coincidencia, expresion) => {
    const nombre = expresion.trim().split('.').at(-1);
    return `{${nombre}}`;
  });
}

function operacionesDelContrato() {
  const operaciones = new Set();
  for (const [ruta, item] of Object.entries(document.paths ?? {})) {
    for (const metodo of METODOS) {
      if (item?.[metodo]) operaciones.add(`${metodo} ${ruta}`);
    }
  }
  return operaciones;
}

function operacionesConsumidas() {
  const operaciones = new Set();

  for (const archivo of listarArchivos(webSourceRoot)) {
    if (/\.test\.tsx?$/.test(archivo)) continue;
    // Estos archivos definen los helpers; la llamada real está en las vistas.
    if (/[\\/]api[\\/](client|idempotent-client)\.ts$/.test(archivo)) continue;

    const codigo = readFileSync(archivo, 'utf8');

    for (const coincidencia of codigo.matchAll(
      /apiClient\s*\.\s*(GET|POST|PUT|PATCH|DELETE)\s*\(\s*(['"`])([^'"`]+)\2/g,
    )) {
      operaciones.add(`${coincidencia[1].toLowerCase()} ${normalizarRuta(coincidencia[3])}`);
    }

    for (const coincidencia of codigo.matchAll(/postWithIdempotency\s*\(\s*(['"`])([^'"`]+)\1/g)) {
      operaciones.add(`post ${normalizarRuta(coincidencia[2])}`);
    }

    if (/descargarArchivo\s*\(/.test(codigo)) {
      operaciones.add('get /files/{id}/download');
    }
  }

  return operaciones;
}

test('la SPA consume todas las operaciones del contrato', () => {
  const contrato = operacionesDelContrato();
  const consumidas = operacionesConsumidas();
  const faltan = [...contrato].filter((operacion) => !consumidas.has(operacion)).sort();

  assert.deepEqual(
    faltan,
    [],
    `${consumidas.size}/${contrato.size} operaciones consumidas. Faltan:\n${faltan.join('\n')}`,
  );
});
