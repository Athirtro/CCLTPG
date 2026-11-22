/**
 * Motor determinista de expansión de permisos (AC-SEC-20).
 *
 * Reglas del catálogo v1 (gramática §2):
 * - `manage` implica las acciones existentes del recurso y sus variantes `_own`.
 * - `read` implica `read_own`; `update` implica `update_own`.
 * - `*` solo puede ocupar el segmento de recurso.
 * - La expansión se limita al catálogo cerrado: no inventa acciones.
 */

export const PERMISSION_CATALOG = [
  'identity:user:manage',
  'identity:profile:read',
  'identity:profile:update',
  'identity:temporary-identity:manage',
  'academic:program:manage',
  'academic:group:manage',
  'academic:group:read_own',
  'academic:schedule:read',
  'academic:schedule:read_own',
  'academic:student:manage',
  'academic:student:read_own',
  'academic:enrollment:create',
  'academic:enrollment:read',
  'academic:enrollment:read_own',
  'academic:enrollment:update',
  'academic:enrollment:delete',
  'academic:session:create',
  'academic:session:update',
  'academic:attendance:create',
  'academic:attendance:update',
  'academic:attendance:read',
  'academic:evaluation:create',
  'academic:evaluation:update',
  'academic:evaluation:read',
  'academic:evaluation:read_own',
  'academic:indicator:manage',
  'audit:event:read',
  'files:document:create',
  'files:document:read_own',
  'files:document:read',
  'notifications:notification:read_own',
  'notifications:notification:update_own',
  'notifications:preference:read_own',
  'notifications:preference:update_own',
  'exports:report:create',
  'exports:report:export',
  'analytics:kpi:read',
] as const;

export type CatalogPermission = (typeof PERMISSION_CATALOG)[number];

const CATALOG_SET = new Set<string>(PERMISSION_CATALOG);

interface ParsedPermission {
  contexto: string;
  recurso: string;
  accion: string;
}

function parse(permission: string): ParsedPermission | null {
  const parts = permission.split(':');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return null;
  }

  const [contexto, recurso, accion] = parts;
  return { contexto, recurso, accion };
}

/** Recursos del catálogo agrupados por contexto. */
const RESOURCES_BY_CONTEXT = new Map<string, Set<string>>();
const ACTIONS_BY_RESOURCE = new Map<string, Set<string>>();

for (const permission of PERMISSION_CATALOG) {
  const parsed = parse(permission);
  if (!parsed) {
    continue;
  }

  const resourceKey = `${parsed.contexto}:${parsed.recurso}`;
  const resources = RESOURCES_BY_CONTEXT.get(parsed.contexto) ?? new Set<string>();
  resources.add(parsed.recurso);
  RESOURCES_BY_CONTEXT.set(parsed.contexto, resources);

  const actions = ACTIONS_BY_RESOURCE.get(resourceKey) ?? new Set<string>();
  actions.add(parsed.accion);
  ACTIONS_BY_RESOURCE.set(resourceKey, actions);
}

function actionsFor(contexto: string, recurso: string): Set<string> {
  return ACTIONS_BY_RESOURCE.get(`${contexto}:${recurso}`) ?? new Set<string>();
}

function expandOne(permission: string): string[] {
  const parsed = parse(permission);
  if (!parsed) {
    return [];
  }

  const resources =
    parsed.recurso === '*'
      ? [...(RESOURCES_BY_CONTEXT.get(parsed.contexto) ?? new Set<string>())]
      : [parsed.recurso];

  const expanded = new Set<string>();

  for (const resource of resources) {
    const actions = actionsFor(parsed.contexto, resource);
    const candidates = new Set<string>();

    switch (parsed.accion) {
      case 'manage':
        for (const action of actions) {
          candidates.add(action);
        }
        break;
      case 'read':
        candidates.add('read');
        candidates.add('read_own');
        break;
      case 'update':
        candidates.add('update');
        candidates.add('update_own');
        break;
      default:
        candidates.add(parsed.accion);
    }

    for (const action of candidates) {
      const concrete = `${parsed.contexto}:${resource}:${action}`;
      if (CATALOG_SET.has(concrete)) {
        expanded.add(concrete);
      }
    }
  }

  return [...expanded];
}

/** Expande y ordena los permisos concedidos; salida sin `*` ni `manage`. */
export function expandPermissions(granted: readonly string[]): string[] {
  const expanded = new Set<string>();

  for (const permission of granted) {
    for (const concrete of expandOne(permission.trim())) {
      expanded.add(concrete);
    }
  }

  return [...expanded].sort((left, right) => left.localeCompare(right, 'en'));
}

/** Semántica OR: basta con que uno de los permisos requeridos esté presente. */
export function satisfiesAny(expanded: readonly string[], required: readonly string[]): boolean {
  if (required.length === 0) {
    return true;
  }

  const held = new Set(expanded);
  return required.some((permission) => held.has(permission));
}

export function isKnownPermission(permission: string): boolean {
  return CATALOG_SET.has(permission);
}
