import { describe, expect, it, vi } from 'vitest';

import type { KpiCache } from './ports/kpi-cache.js';
import type { KpiRepository } from './ports/kpi.repository.js';
import { KpiService } from './kpi.service.js';

/**
 * RB1-56/D84: la caché es una optimización. Si falla, el servicio debe
 * consultar la base directamente y no filtrar el ámbito de otro educador.
 */

const QUERY = {
  periodo: '2026-1',
  programaId: null,
  grupoId: null,
  kpi: 'matricula_activa',
};

function harness() {
  const countEnrollments = vi.fn(() => Promise.resolve(12));
  const groupBelongsToEducador = vi.fn(() => Promise.resolve(false));
  const repository: KpiRepository = {
    countEnrollments,
    attendanceTotals: vi.fn(() => Promise.resolve({ presentes: 0, tardes: 0, total: 0 })),
    evaluationTotals: vi.fn(() =>
      Promise.resolve({ excelente: 0, bueno: 0, regular: 0, deficiente: 0 }),
    ),
    programTotals: vi.fn(() => Promise.resolve({ programas: 0, grupos: 0 })),
    dropoutTotals: vi.fn(() => Promise.resolve({ retiradas: 0, base: 0 })),
    countByMunicipio: vi.fn(() => Promise.resolve([])),
    groupBelongsToEducador,
  };
  return { repository, countEnrollments, groupBelongsToEducador };
}

function cache() {
  const set = vi.fn(() => Promise.resolve());
  const value: KpiCache = {
    // RedisKpiCache devuelve null cuando Redis falla (ver redis-kpi.cache.spec.ts).
    get: vi.fn(() => Promise.resolve(null)),
    set,
    invalidateAll: vi.fn(() => Promise.resolve()),
  };
  return { value, set };
}

describe('KpiService — degradación y ámbito (C6)', () => {
  it('consulta directamente cuando la caché no tiene valor (degradación)', async () => {
    const { repository, countEnrollments } = harness();
    const { value: degradedCache, set } = cache();

    const result = await new KpiService(repository, degradedCache).list(QUERY, {
      userId: 'educador',
      permissions: ['analytics:kpi:read'],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ code: 'matricula_activa', valor: 12 });
    expect(countEnrollments).toHaveBeenCalledWith(
      expect.objectContaining({ educadorId: 'educador' }),
    );
    expect(set).toHaveBeenCalled();
  });

  it('devuelve 404 antes de consultar si el educador no es dueño del grupo', async () => {
    const { repository, countEnrollments, groupBelongsToEducador } = harness();

    const promise = new KpiService(repository, cache().value).list(
      { ...QUERY, grupoId: 'grupo-ajeno' },
      { userId: 'educador', permissions: ['analytics:kpi:read'] },
    );
    await expect(promise).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(groupBelongsToEducador).toHaveBeenCalledWith('grupo-ajeno', 'educador');
    expect(countEnrollments).not.toHaveBeenCalled();
  });
});
