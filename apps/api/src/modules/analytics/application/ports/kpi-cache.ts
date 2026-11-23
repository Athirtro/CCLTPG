/** Caché de KPIs con degradación a consulta directa (C6 — D84). */
export abstract class KpiCache {
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  abstract invalidateAll(): Promise<void>;
}
