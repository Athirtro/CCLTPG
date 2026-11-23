import { Inject, Injectable } from '@nestjs/common';

import {
  findKpi,
  KPI_CODES,
  MIN_KPI_CELL_SIZE,
} from '../../../shared/analytics/analytics-catalog.js';
import { AnalyticsError } from './analytics-error.js';
import type { AnalyticsFilter, KpiBreakdownItem, KpiResult } from './analytics.types.js';
import { KpiCache } from './ports/kpi-cache.js';
import { KpiRepository } from './ports/kpi.repository.js';

const CACHE_TTL_SECONDS = 60;
const PERIOD_PATTERN = /^[0-9]{4}-[0-9]+$/u;

export interface KpiActor {
  userId: string;
  permissions: readonly string[];
}

export interface KpiQuery {
  periodo: string;
  programaId: string | null;
  grupoId: string | null;
  kpi: string | null;
}

/** Cálculo de los seis KPIs con ámbito resuelto en servidor (D82/D83). */
@Injectable()
export class KpiService {
  constructor(
    @Inject(KpiRepository) private readonly repository: KpiRepository,
    @Inject(KpiCache) private readonly cache: KpiCache,
  ) {}

  async list(query: KpiQuery, actor: KpiActor): Promise<KpiResult[]> {
    if (!PERIOD_PATTERN.test(query.periodo)) {
      throw AnalyticsError.invalidPeriod(query.periodo);
    }
    if (query.kpi !== null && findKpi(query.kpi) === null) {
      throw AnalyticsError.kpiNotFound(query.kpi);
    }

    const educadorId = actor.permissions.includes('academic:group:manage') ? null : actor.userId;
    if (query.grupoId && educadorId) {
      const propio = await this.repository.groupBelongsToEducador(query.grupoId, educadorId);
      if (!propio) {
        throw AnalyticsError.notFound('Grupo');
      }
    }

    const filter: AnalyticsFilter = {
      periodo: query.periodo,
      programaId: query.programaId,
      grupoId: query.grupoId,
      educadorId,
    };
    const codes = query.kpi ? [query.kpi] : [...KPI_CODES];
    const cacheKey = JSON.stringify({ ...filter, codes });

    const cached = await this.cache.get<KpiResult[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const calculadoEn = new Date();
    const results: KpiResult[] = [];
    for (const code of codes) {
      results.push(await this.compute(code, filter, calculadoEn));
    }

    await this.cache.set(cacheKey, results, CACHE_TTL_SECONDS);
    return results;
  }

  private async compute(
    code: string,
    filter: AnalyticsFilter,
    calculadoEn: Date,
  ): Promise<KpiResult> {
    const definition = findKpi(code)!;

    switch (code) {
      case 'matricula_activa': {
        return this.result(
          definition.code,
          definition.nombre,
          definition.unidad,
          await this.repository.countEnrollments(filter),
          [],
          calculadoEn,
        );
      }
      case 'asistencia': {
        const totals = await this.repository.attendanceTotals(filter);
        const desglose: KpiBreakdownItem[] = [
          { clave: 'presentes', total: totals.presentes },
          { clave: 'tardes', total: totals.tardes },
          { clave: 'total', total: totals.total },
        ];
        return this.result(
          definition.code,
          definition.nombre,
          definition.unidad,
          percentage(totals.presentes + totals.tardes, totals.total),
          desglose,
          calculadoEn,
        );
      }
      case 'evaluacion': {
        const totals = await this.repository.evaluationTotals(filter);
        const desglose: KpiBreakdownItem[] = [
          { clave: 'excelente', total: totals.excelente },
          { clave: 'bueno', total: totals.bueno },
          { clave: 'regular', total: totals.regular },
          { clave: 'deficiente', total: totals.deficiente },
        ];
        const total = desglose.reduce((sum, item) => sum + item.total, 0);
        return this.result(
          definition.code,
          definition.nombre,
          definition.unidad,
          percentage(totals.excelente + totals.bueno, total),
          desglose,
          calculadoEn,
        );
      }
      case 'programas': {
        const totals = await this.repository.programTotals(filter);
        const desglose: KpiBreakdownItem[] = [
          { clave: 'programas', total: totals.programas },
          { clave: 'grupos', total: totals.grupos },
        ];
        return this.result(
          definition.code,
          definition.nombre,
          definition.unidad,
          totals.programas,
          desglose,
          calculadoEn,
        );
      }
      case 'desercion': {
        const totals = await this.repository.dropoutTotals(filter);
        return this.result(
          definition.code,
          definition.nombre,
          definition.unidad,
          percentage(totals.retiradas, totals.base),
          [
            { clave: 'retiradas', total: totals.retiradas },
            { clave: 'base', total: totals.base },
          ],
          calculadoEn,
        );
      }
      case 'distribucion_geografica': {
        const rows = await this.repository.countByMunicipio(filter);
        const desglose: KpiBreakdownItem[] = rows
          .filter((row) => row.total >= MIN_KPI_CELL_SIZE)
          .map((row) => ({ clave: row.municipio, total: row.total }));
        return this.result(
          definition.code,
          definition.nombre,
          definition.unidad,
          desglose.length,
          desglose,
          calculadoEn,
        );
      }
      default:
        throw AnalyticsError.kpiNotFound(code);
    }
  }

  private result(
    code: string,
    nombre: string,
    unidad: KpiResult['unidad'],
    valor: number,
    desglose: readonly KpiBreakdownItem[],
    calculadoEn: Date,
  ): KpiResult {
    return {
      code,
      nombre,
      valor,
      unidad,
      desglose: [...desglose],
      calculadoEn,
    };
  }
}

function percentage(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((10_000 * part) / total) / 100;
}
