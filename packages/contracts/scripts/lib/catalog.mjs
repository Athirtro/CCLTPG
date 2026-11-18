import { readFileSync } from 'node:fs';

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
