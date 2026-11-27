import { PERMISSION_CATALOG } from './permissions.js';

/**
 * Catálogo de perfiles de la semilla (RB1-19).
 *
 * Vive en el dominio para que la semilla, las pruebas de matriz de autorización
 * y cualquier herramienta de verificación usen exactamente la misma concesión.
 * Los permisos con `*` se materializan expandidos antes de guardarlos.
 */

export type PerfilCodigo =
  | 'administrador'
  | 'educador'
  | 'estudiante'
  | 'jefe_emisora'
  | 'programador'
  | 'tecnico_grabacion'
  | 'tecnico_emision'
  | 'locutor'
  | 'tecnico_contenidos'
  | 'realizador_externo'
  | 'comite_programacion'
  | 'secretario_cultura'
  | 'auxiliar_administrativo'
  | 'contratista_prensa'
  | 'ingeniero_mantenimiento'
  | 'operador_transmisor';

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
      'notifications:notification:update_own',
      'notifications:preference:read_own',
      'notifications:preference:update_own',
      'exports:report:create',
      'exports:report:export',
      'analytics:kpi:read',
      'emisora:*:manage',
    ],
  },
  {
    codigo: 'educador',
    nombre: 'Educador',
    descripcion: 'Docencia en sus grupos; ámbito de grupo (PA-002).',
    permisos: [
      'academic:group:read_own',
      'academic:enrollment:read',
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
      'files:document:read_own',
      'notifications:notification:read_own',
      'notifications:notification:update_own',
      'notifications:preference:read_own',
      'notifications:preference:update_own',
      'exports:report:create',
      'analytics:kpi:read',
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
      'notifications:notification:update_own',
      'notifications:preference:read_own',
      'notifications:preference:update_own',
      'files:document:read_own',
    ],
  },
  // Perfiles de Emisora R.A.C. (plan §5.2). Viven aquí, y no en una semilla
  // propia, para que semilla, guard y matriz de autorización compartan la
  // misma concesión (decisión I3).
  {
    codigo: 'jefe_emisora',
    nombre: 'Jefe de emisora',
    descripcion: 'Gestión global de la emisora cultural.',
    permisos: ['emisora:*:manage', 'exports:report:export', 'files:*:create', 'files:*:read'],
  },
  {
    codigo: 'programador',
    nombre: 'Programador',
    descripcion: 'Programación diaria y revisión de la rejilla anual.',
    permisos: [
      'emisora:programacion:manage',
      'emisora:rejilla:read',
      'emisora:patrocinio:read',
      'emisora:promo:read',
    ],
  },
  {
    codigo: 'tecnico_grabacion',
    nombre: 'Técnico de grabación',
    descripcion: 'Sesiones de grabación, archivo sonoro y asistencia en cabina.',
    permisos: [
      'emisora:grabacion:manage',
      'emisora:audio:manage',
      'emisora:proyecto:read',
      'emisora:asistencia-cabina:create',
    ],
  },
  {
    codigo: 'tecnico_emision',
    nombre: 'Técnico de emisión',
    descripcion: 'Promos, patrocinios, planillas y transmisiones.',
    permisos: [
      'emisora:programacion:read',
      'emisora:promo:manage',
      'emisora:patrocinio:manage',
      'emisora:planilla:create',
      'emisora:transmision:read',
    ],
  },
  {
    codigo: 'locutor',
    nombre: 'Locutor',
    descripcion: 'Grabaciones propias y carga de audio.',
    permisos: ['emisora:grabacion:read_own', 'emisora:audio:create', 'files:document:create'],
  },
  {
    codigo: 'tecnico_contenidos',
    nombre: 'Técnico de contenidos digitales',
    descripcion: 'Publicaciones y contenido sonoro.',
    permisos: ['emisora:publicacion:manage', 'emisora:promo:read', 'emisora:audio:read'],
  },
  {
    codigo: 'realizador_externo',
    nombre: 'Realizador externo',
    descripcion: 'Convocatoria, proyecto e informe propios (identidad temporal).',
    permisos: [
      'emisora:convocatoria:read',
      'emisora:proyecto:create',
      'emisora:proyecto:read_own',
      'emisora:proyecto:update_own',
      'emisora:informe:create',
      'emisora:informe:read_own',
      'emisora:rejilla:read',
    ],
  },
  {
    codigo: 'comite_programacion',
    nombre: 'Comité de programación',
    descripcion: 'Evaluación de proyectos e informes y aprobación de rejilla.',
    permisos: [
      'emisora:proyecto:read',
      'emisora:informe:read',
      'emisora:rejilla:update',
      'emisora:incentivo:update',
    ],
  },
  {
    codigo: 'secretario_cultura',
    nombre: 'Secretario de Cultura',
    descripcion: 'Incentivos, resoluciones e inversión (solo trazabilidad).',
    permisos: [
      'emisora:incentivo:update',
      'emisora:incentivo:export',
      'emisora:resolucion:read',
      'emisora:inversion:read',
    ],
  },
  {
    codigo: 'auxiliar_administrativo',
    nombre: 'Auxiliar administrativo',
    descripcion: 'Trámites, permisos de salida y actividades culturales.',
    permisos: ['emisora:tramite:manage', 'emisora:permiso-salida:create', 'emisora:actividad:read'],
  },
  {
    codigo: 'contratista_prensa',
    nombre: 'Contratista de prensa',
    descripcion: 'Registro de actividades y publicaciones.',
    permisos: ['emisora:actividad:read', 'emisora:publicacion:create', 'files:document:create'],
  },
  {
    codigo: 'ingeniero_mantenimiento',
    nombre: 'Ingeniero de mantenimiento',
    descripcion: 'Equipos, proyecciones e inversión tecnológica.',
    permisos: ['emisora:equipo:manage', 'emisora:inversion:read', 'emisora:proyeccion:manage'],
  },
  {
    codigo: 'operador_transmisor',
    nombre: 'Operador de sede de transmisores',
    descripcion: 'Turno propio, lecturas técnicas y bitácora de sede.',
    permisos: ['emisora:turno:read_own', 'emisora:lectura:create', 'emisora:bitacora:create'],
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
        // `manage` implica todas las acciones del contexto. Sin esta regla,
        // `academic:*:manage` no materializaba recursos sin acción `manage`
        // en el catálogo (p. ej. `academic:enrollment:create`).
        const aplica = accion === 'manage' || candidateAccion === accion;
        if (candidateContexto === contexto && aplica) {
          result.add(candidate);
        }
      }
      continue;
    }
    result.add(permiso);
  }

  return [...result].sort((left, right) => left.localeCompare(right, 'en'));
}
