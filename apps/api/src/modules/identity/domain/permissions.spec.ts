import { describe, expect, it } from 'vitest';

import {
  PERMISSION_CATALOG,
  expandPermissions,
  isKnownPermission,
  satisfiesAny,
} from './permissions.js';

describe('motor de permisos', () => {
  it('expande identity:*:manage a todos los permisos de identidad del catálogo', () => {
    const expanded = expandPermissions(['identity:*:manage']);

    expect(expanded).toContain('identity:user:manage');
    expect(expanded).toContain('identity:profile:read');
    expect(expanded).toContain('identity:profile:update');
    expect(expanded).toContain('identity:temporary-identity:manage');
    expect(expanded.every((permission) => permission.startsWith('identity:'))).toBe(true);
  });

  it('manage implica las acciones existentes y no emite el permiso genérico', () => {
    const expanded = expandPermissions(['academic:enrollment:manage']);

    expect(expanded).toEqual(
      expect.arrayContaining([
        'academic:enrollment:create',
        'academic:enrollment:read',
        'academic:enrollment:update',
        'academic:enrollment:delete',
      ]),
    );
    expect(expanded).not.toContain('academic:enrollment:manage');
  });

  it('read implica read_own aunque no esté concedido explícitamente', () => {
    expect(expandPermissions(['academic:evaluation:read'])).toContain(
      'academic:evaluation:read_own',
    );
    expect(expandPermissions(['notifications:preference:update'])).toContain(
      'notifications:preference:update_own',
    );
  });

  it('ignora permisos fuera del catálogo cerrado y ordena el resultado', () => {
    const expanded = expandPermissions([
      'academic:curso:read',
      'audit:event:read',
      'academic:group:read_own',
    ]);

    expect(expanded).toEqual(['academic:group:read_own', 'audit:event:read']);
    expect(expanded).toEqual([...expanded].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('aplica semántica OR y denegación por defecto', () => {
    const held = expandPermissions(['files:document:read']);
    expect(satisfiesAny(held, ['files:document:read', 'files:document:create'])).toBe(true);
    expect(satisfiesAny(held, ['audit:event:read'])).toBe(false);
    expect(satisfiesAny([], [])).toBe(true);
  });

  it('reconoce solo códigos literales del catálogo', () => {
    expect(isKnownPermission('identity:user:manage')).toBe(true);
    expect(isKnownPermission('identity:*:manage')).toBe(false);
    expect(PERMISSION_CATALOG.length).toBeGreaterThan(30);
  });
});
