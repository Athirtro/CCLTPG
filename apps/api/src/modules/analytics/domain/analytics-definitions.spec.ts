import { describe, expect, it } from 'vitest';

import {
  ANALYTICS_FORMATS,
  KPI_CODES,
  KPI_DEFINITIONS,
  MIN_KPI_CELL_SIZE,
  REPORT_CODES,
  REPORT_DEFINITIONS,
  findKpi,
  findReport,
} from './analytics-definitions.js';

describe('catálogo cerrado de analítica (C6 — D81/D82/D84)', () => {
  it('define seis KPIs únicos con fórmula verificable', () => {
    expect(KPI_DEFINITIONS.map((definition) => definition.code)).toEqual([...KPI_CODES]);
    expect(new Set(KPI_DEFINITIONS.map((definition) => definition.code)).size).toBe(6);
    for (const definition of KPI_DEFINITIONS) {
      expect(definition.formula.length).toBeGreaterThan(20);
      expect(definition.nombre.length).toBeGreaterThan(0);
    }
  });

  it('define cuatro reportes únicos en los tres formatos permitidos', () => {
    expect(REPORT_DEFINITIONS.map((definition) => definition.code)).toEqual([...REPORT_CODES]);
    expect(new Set(REPORT_DEFINITIONS.map((definition) => definition.code)).size).toBe(4);
    for (const definition of REPORT_DEFINITIONS) {
      expect(definition.formatos).toEqual([...ANALYTICS_FORMATS]);
      expect(definition.columnas.length).toBeGreaterThan(0);
    }
  });

  it('suprime agregados pequeños derivados de PII', () => {
    expect(MIN_KPI_CELL_SIZE).toBe(5);
  });

  it('resuelve definiciones por código sin inventar KPIs ni reportes', () => {
    expect(findKpi('asistencia')?.unidad).toBe('porcentaje');
    expect(findKpi('inventado')).toBeNull();
    expect(findReport('desercion')?.code).toBe('desercion');
    expect(findReport('inventado')).toBeNull();
  });
});
