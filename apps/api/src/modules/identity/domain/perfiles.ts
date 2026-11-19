import { PERMISSION_CATALOG } from './permissions.js';

/**
 * Catálogo de perfiles de la semilla (RB1-19).
 *
 * Vive en el dominio para que la semilla, las pruebas de matriz de autorización
 * y cualquier herramienta de verificación usen exactamente la misma concesión.
 * Los permisos con `*` se materializan expandidos antes de guardarlos.
 */

export type PerfilCodigo = 'administrador' | 'educador' | 'estudiante';

export interface PerfilSeed {
  codigo: PerfilCodigo;
  nombre: string;
  descripcion: string;
  /** Permisos concedidos; pueden usar `*` en el segmento de recurso. */
  permisos: readonly string[];
}

export const PROFILE_SEEDS: readonly PerfilSeed[] = [
  {
    codigo: 'administrador',
    nombre: 'Administrador',
    descripcion: 'Gestión global de identidad, academia y auditoría.',
    permisos: [
      'identity:*:manage',
      'academic:*:manage',
      'audit:event:read',
      'files:*:create',
      'files:*:read',
      'notifications:notification:read_own',
    ],
  },
  {
    codigo: 'educador',
    nombre: 'Educador',
    descripcion: 'Docencia en sus grupos; ámbito de grupo (PA-002).',
    permisos: [
      'academic:group:read_own',
      'academic:schedule:read_own',
      'academic:session:create',
      'academic:session:update',
      'academic:attendance:create',
      'academic:attendance:update',
      'academic:attendance:read',
      'academic:evaluation:create',
      'academic:evaluation:update',
      'academic:evaluation:read',
      'files:document:create',
      'notifications:notification:read_own',
    ],
  },
  {
    codigo: 'estudiante',
    nombre: 'Estudiante',
    descripcion: 'Consulta de su propia información académica.',
    permisos: [
      'academic:enrollment:read_own',
      'academic:schedule:read_own',
      'academic:evaluation:read_own',
      'academic:student:read_own',
      'notifications:notification:read_own',
      'notifications:preference:update_own',
      'files:document:read_own',
    ],
  },
];

/** `identity:*:manage` no está en el catálogo literal; se materializa expandido. */
export function permissionsFor(perfil: PerfilSeed): string[] {
  const result = new Set<string>();

  for (const permiso of perfil.permisos) {
    if (permiso.includes('*')) {
      const [contexto, , accion] = permiso.split(':');
      for (const candidate of PERMISSION_CATALOG) {
        const [candidateContexto, , candidateAccion] = candidate.split(':');
        if (candidateContexto === contexto && candidateAccion === accion) {
          result.add(candidate);
        }
      }
      continue;
    }
    result.add(permiso);
  }

  return [...result].sort((left, right) => left.localeCompare(right, 'en'));
}
