/**
 * Periodo académico por defecto (`YYYY-P`), usado por las consultas que
 * requieren el parámetro `periodo` del contrato de analítica.
 */
export function periodoActual(now: Date = new Date()): string {
  const semestre = now.getUTCMonth() < 6 ? 1 : 2;
  return `${now.getUTCFullYear()}-${semestre}`;
}
