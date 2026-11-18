#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCatalogEvents } from './lib/catalog.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const contractsDirectory = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(contractsDirectory, '..', '..');
const source = 'docs/contratos/modelo-auditoria-v1.md';

const events = readCatalogEvents(resolve(repositoryRoot, source));
const output = {
  version: '1.0',
  source,
  events,
};

mkdirSync(contractsDirectory, { recursive: true });
writeFileSync(
  resolve(contractsDirectory, 'events.json'),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
);

console.log(`Catálogo de eventos generado: ${events.length} eventos desde ${source}`);
