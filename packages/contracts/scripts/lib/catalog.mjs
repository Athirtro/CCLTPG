import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Extrae los nombres de evento de la tabla del catálogo (modelo-auditoria-v1 §3).
 * El catálogo documental es la fuente; `events.json` es su representación
 * machine-readable y CI verifica que no haya deriva (R-031).
 */
export function extractEvents(markdown) {
  const start = markdown.indexOf('## 3.');
  const end = markdown.indexOf('## 4.', start);
  const section = start >= 0 ? markdown.slice(start, end >= 0 ? end : undefined) : markdown;

  const events = new Set();
  const eventPattern = /`([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)`/gi;

  for (const line of section.split(/\r?\n/)) {
    if (!line.trimStart().startsWith('|')) {
      continue;
    }

    for (const match of line.matchAll(eventPattern)) {
      events.add(match[1]);
    }
  }

  return [...events].sort();
}

export function readCatalogEvents(sourcePath) {
  return extractEvents(readFileSync(sourcePath, 'utf8'));
}

export const DEFAULT_CATALOG_SOURCE = 'docs/contratos/modelo-auditoria-v1.md';
export const AMENDMENTS_DIRECTORY = 'docs/contratos/cambios';

/**
 * Fusiona el catálogo congelado con las enmiendas aprobadas (D85/C6).
 *
 * El documento base no se edita: cada cambio controlado vive en su propio
 * archivo Markdown dentro de `docs/contratos/cambios/`. La fusión es
 * determinista (orden alfabético de archivo y de eventos) para que CI pueda
 * detectar cualquier deriva entre documentos y `events.json`.
 */
export function readCatalogWithAmendments(
  repositoryRoot,
  source = DEFAULT_CATALOG_SOURCE,
  amendmentsDirectory = AMENDMENTS_DIRECTORY,
) {
  const events = new Set(readCatalogEvents(resolve(repositoryRoot, source)));
  const directory = resolve(repositoryRoot, amendmentsDirectory);
  const amendments = [];

  if (existsSync(directory)) {
    for (const file of readdirSync(directory)
      .filter((name) => name.endsWith('.md'))
      .sort()) {
      const added = readCatalogEvents(join(directory, file));
      amendments.push({ file: `${amendmentsDirectory}/${file}`, events: added });
      for (const event of added) {
        events.add(event);
      }
    }
  }

  return { events: [...events].sort(), amendments };
}
