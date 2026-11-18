import type { ReadinessReport } from './client';

export type HealthRow = {
  name: string;
  label: string;
  status: 'up' | 'down';
  latencyMs: number;
};

export type HealthSummary = {
  label: string;
  severity: 'success' | 'error';
};

const LABELS: Record<string, string> = {
  database: 'PostgreSQL',
  redis: 'Redis',
};

export function toHealthRows(report: ReadinessReport): HealthRow[] {
  return Object.entries(report.checks).map(([name, check]) => ({
    name,
    label: LABELS[name] ?? name,
    status: check.status,
    latencyMs: check.latencyMs,
  }));
}

export function summarize(report: ReadinessReport): HealthSummary {
  return report.status === 'ok'
    ? { label: 'Sistema operativo', severity: 'success' }
    : { label: 'Sistema degradado', severity: 'error' };
}
