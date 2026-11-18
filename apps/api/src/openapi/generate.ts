import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { NestFactory } from '@nestjs/core';
import { format as formatPrettier } from 'prettier';

import { AppModule } from '../app.module.js';
import { env } from '../shared/config/env.js';
import { buildOpenApiDocument } from './openapi.js';

const contractsDirectory = path.resolve(import.meta.dirname, '../../../../packages/contracts');
const outputPath = path.join(contractsDirectory, 'openapi.json');

const app = await NestFactory.create(AppModule, { logger: false });
app.setGlobalPrefix(env.API_PREFIX.replace(/^\//, ''));

try {
  await app.init();
  const document = buildOpenApiDocument(app);
  mkdirSync(contractsDirectory, { recursive: true });
  // El artefacto se emite ya formateado para que `format:check` y la
  // verificación de deriva en CI comparen exactamente lo que genera el código.
  const formatted = await formatPrettier(JSON.stringify(document), {
    parser: 'json',
    printWidth: 100,
    endOfLine: 'lf',
  });
  writeFileSync(outputPath, formatted, 'utf8');
  process.stdout.write(`OpenAPI generado en ${outputPath}\n`);
} finally {
  await app.close();
}
