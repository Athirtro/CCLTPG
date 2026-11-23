import { describe, expect, it } from 'vitest';

import { PERMISSION_CATALOG } from './permissions.js';
import { permissionsFor, PROFILE_SEEDS, type PerfilCodigo } from './perfiles.js';

function permisosDe(codigo: PerfilCodigo): string[] {
  const seed = PROFILE_SEEDS.find((perfil) => perfil.codigo === codigo);
  if (!seed) {
    throw new Error(`Perfil ${codigo} no encontrado.`);
  }
  return permissionsFor(seed);
}

describe('asignación de permisos de analítica (C6 — RB1-51)', () => {
  it.each(['administrador', 'educador'] as const)(
    'concede exportación de reportes y lectura de KPIs a %s',
    (codigo) => {
      const permisos = permisosDe(codigo);
      expect(permisos).toContain('exports:report:create');
      expect(permisos).toContain('analytics:kpi:read');
    },
  );

  it('no concede analítica ni reportes al estudiante', () => {
    const permisos = permisosDe('estudiante');
    expect(permisos).not.toContain('exports:report:create');
    expect(permisos).not.toContain('exports:report:export');
    expect(permisos).not.toContain('analytics:kpi:read');
  });

  it('no inventa permisos fuera del catálogo cerrado de 37', () => {
    const catalogo = new Set<string>(PERMISSION_CATALOG);
    expect(catalogo.size).toBe(37);
    for (const seed of PROFILE_SEEDS) {
      for (const permiso of permissionsFor(seed)) {
        expect(catalogo.has(permiso), `${seed.codigo}: ${permiso}`).toBe(true);
      }
    }
  });
});
