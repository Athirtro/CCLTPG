#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';

import { readCatalogWithAmendments } from './lib/catalog.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const contractsDirectory = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(contractsDirectory, '..', '..');
const source = 'docs/contratos/modelo-auditoria-v1.md';

const { events, amendments } = readCatalogWithAmendments(repositoryRoot, source);
const output = {
  version: '1.0',
  source,
  amendments: amendments.map((entry) => entry.file),
  events,
};

mkdirSync(contractsDirectory, { recursive: true });
// El artefacto generado debe coincidir con `pnpm format:check` y con la
// comprobación de CI de que no hay deriva tras `contracts:generate`.
const json = await format(`${JSON.stringify(output, null, 2)}\n`, { parser: 'json' });
writeFileSync(resolve(contractsDirectory, 'events.json'), json, 'utf8');

console.log(
  `Catálogo de eventos generado: ${events.length} eventos (${source} + ${amendments.length} enmienda(s))`,
);
