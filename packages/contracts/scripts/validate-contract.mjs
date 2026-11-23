#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCatalogWithAmendments } from './lib/catalog.mjs';
import { validateContract } from './lib/contract-validation.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const contractsDirectory = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(contractsDirectory, '..', '..');

const document = readJson(resolve(contractsDirectory, 'openapi.json'));
const catalog = readJson(resolve(contractsDirectory, 'events.json'));
const allowlist = readJson(resolve(contractsDirectory, 'public-routes.json'));
const { events: documentedEvents } = readCatalogWithAmendments(repositoryRoot);

const { errors, warnings, stats } = validateContract({
  document,
  catalog,
  allowlist,
  documentedEvents,
});

if (warnings.length > 0) {
  console.warn(`Advertencias (${warnings.length}):`);
  for (const warning of warnings) {
    console.warn(`  - ${warning}`);
  }
}

if (errors.length > 0) {
  console.error(`Contrato inválido: ${errors.length} error(es).`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Contrato válido: ${stats.operations} operaciones, ${stats.publicOperations} públicas, ${stats.catalogEvents} eventos de catálogo.`,
  );
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`No se pudo leer ${filePath}: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
