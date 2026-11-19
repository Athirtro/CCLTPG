const ACCESS_MODES = new Set([
  'public',
  'partial',
  'partial_or_session',
  'authenticated',
  'permission',
]);
const SCOPE_MODES = new Set(['global', 'own', 'group', 'mixed']);
const PARTIAL_SCOPES = new Set(['mfa_verify', 'mfa_enroll', 'pwd_change']);
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const AUDIT_DISABLED = '-';
const PARTIAL_ACCESS = new Set(['partial', 'partial_or_session']);

/**
 * Plantillas de evento admitidas en `x-audit-event` (R-028/R-031).
 * La operación de transición emite un evento distinto por estado destino; el
 * contrato conserva la notación de la matriz y el validador exige que todas
 * las expansiones existan en el catálogo.
 */
const AUDIT_EVENT_TEMPLATES = {
  'usuario.<estado>': ['usuario.activado', 'usuario.desactivado', 'usuario.bloqueado'],
};

/**
 * Valida el contrato OpenAPI contra R-028/C-14/C-27/R-031.
 * Devuelve errores y advertencias en lugar de terminar el proceso para que
 * las pruebas puedan inyectar documentos deliberadamente inválidos.
 */
export function validateContract({ document, catalog, allowlist, documentedEvents }) {
  const errors = [];
  const warnings = [];
  const catalogEvents = new Set(catalog.events ?? []);
  const publicOperations = new Set();
  const operationIds = new Map();

  validateCatalog();
  validateOperations();
  validateAllowlist();

  return {
    errors,
    warnings,
    stats: {
      operations: operationIds.size,
      publicOperations: publicOperations.size,
      catalogEvents: catalogEvents.size,
    },
  };

  function validateCatalog() {
    const documented = new Set(documentedEvents);

    for (const event of documented) {
      if (!catalogEvents.has(event)) {
        errors.push(
          `El catálogo generado no contiene "${event}" presente en modelo-auditoria-v1 §3.`,
        );
      }
    }

    for (const event of catalogEvents) {
      if (!documented.has(event)) {
        errors.push(
          `El catálogo generado contiene "${event}", que no existe en modelo-auditoria-v1 §3.`,
        );
      }
    }

    if (catalog.version !== '1.0') {
      warnings.push(`events.json declara versión "${catalog.version}" (esperada 1.0).`);
    }
  }

  function validateOperations() {
    const paths = document.paths ?? {};
    const globalSecurity = Array.isArray(document.security) && document.security.length > 0;
    const server = document.servers?.[0]?.url ?? '';

    for (const [specPath, pathItem] of Object.entries(paths)) {
      const fullPath = joinServerPath(server, specPath);

      for (const [method, operation] of Object.entries(pathItem)) {
        if (!HTTP_METHODS.has(method) || typeof operation !== 'object' || operation === null) {
          continue;
        }

        const where = `${method.toUpperCase()} ${fullPath}`;
        validateOperation(where, method, operation, globalSecurity);

        if (operation['x-access'] === 'public') {
          publicOperations.add(`${method.toUpperCase()} ${fullPath}`);
          if (Array.isArray(operation.security) && operation.security.length > 0) {
            errors.push(`${where}: una operación pública debe declarar security: [].`);
          }
        }
      }
    }
  }

  function validateOperation(where, method, operation, globalSecurity) {
    const access = operation['x-access'];
    const permission = operation['x-permission'];
    const scope = operation['x-scope'];
    const auditEvent = operation['x-audit-event'];
    const partialScope = operation['x-partial-scope'];
    const errorCodes = operation['x-error-codes'];

    if (!operation.operationId) {
      errors.push(`${where}: falta operationId.`);
    } else if (operationIds.has(operation.operationId)) {
      errors.push(
        `${where}: operationId "${operation.operationId}" duplicado con ${operationIds.get(operation.operationId)}.`,
      );
    } else {
      operationIds.set(operation.operationId, where);
    }

    if (!ACCESS_MODES.has(access)) {
      errors.push(`${where}: x-access ausente o inválido ("${access}").`);
    }

    if (!SCOPE_MODES.has(scope)) {
      errors.push(`${where}: x-scope ausente o inválido ("${scope}").`);
    }

    if (!Array.isArray(permission)) {
      errors.push(`${where}: x-permission debe ser un arreglo (aunque esté vacío).`);
    } else if (access === 'permission' && permission.length === 0) {
      errors.push(`${where}: x-access=permission exige al menos un permiso en x-permission.`);
    } else if (access !== 'permission' && permission.length > 0) {
      errors.push(`${where}: x-permission debe ser [] cuando x-access no es "permission".`);
    }

    if (access === 'partial' || access === 'partial_or_session') {
      if (!Array.isArray(partialScope) || partialScope.length === 0) {
        errors.push(`${where}: x-partial-scope es obligatorio para x-access="${access}".`);
      } else {
        for (const value of partialScope) {
          if (!PARTIAL_SCOPES.has(value)) {
            errors.push(`${where}: x-partial-scope contiene "${value}", fuera del catálogo.`);
          }
        }
      }
    } else if (partialScope !== undefined) {
      warnings.push(`${where}: x-partial-scope declarado sin x-access parcial.`);
    }

    if (typeof auditEvent !== 'string' || auditEvent.length === 0) {
      errors.push(`${where}: x-audit-event es obligatorio ("-" si no se audita).`);
    } else if (auditEvent !== AUDIT_DISABLED) {
      if (!isKnownAuditEvent(auditEvent)) {
        const expansion = AUDIT_EVENT_TEMPLATES[auditEvent];
        errors.push(
          expansion
            ? `${where}: x-audit-event "${auditEvent}" tiene expansiones fuera del catálogo (R-031): ${expansion.join(', ')}.`
            : `${where}: x-audit-event "${auditEvent}" no existe en el catálogo (R-031).`,
        );
      }
    } else if (MUTATING_METHODS.has(method) && !operation['x-audit-exempt']) {
      errors.push(
        `${where}: una operación mutante sin auditoría debe justificarse con x-audit-exempt.`,
      );
    }

    if (!Array.isArray(errorCodes)) {
      errors.push(`${where}: x-error-codes debe ser un arreglo (aunque esté vacío).`);
    }

    const operationSecurity = Array.isArray(operation.security) && operation.security.length > 0;
    // Un token parcial viaja en el cuerpo (`sessionToken`) y se declara con
    // x-partial-scope; OpenAPI 3.0 no admite esquemas de seguridad en el cuerpo,
    // así que estas operaciones no exigen `security`.
    if (
      access !== 'public' &&
      !PARTIAL_ACCESS.has(access) &&
      !operationSecurity &&
      !globalSecurity
    ) {
      errors.push(
        `${where}: una operación autenticada o con permiso debe declarar un esquema de seguridad.`,
      );
    }
  }

  function isKnownAuditEvent(event) {
    if (catalogEvents.has(event)) {
      return true;
    }

    const expansion = AUDIT_EVENT_TEMPLATES[event];
    return Boolean(expansion) && expansion.every((candidate) => catalogEvents.has(candidate));
  }

  function validateAllowlist() {
    const declared = new Set(allowlist.routes ?? []);

    for (const route of publicOperations) {
      if (!declared.has(route)) {
        errors.push(
          `Ruta pública no incluida en la allowlist (${route}); actualice packages/contracts/public-routes.json con revisión explícita.`,
        );
      }
    }

    for (const route of declared) {
      if (!publicOperations.has(route)) {
        errors.push(
          `La allowlist contiene ${route}, que no es una operación pública del contrato.`,
        );
      }
    }
  }
}

export function joinServerPath(server, specPath) {
  const base = (server ?? '').replace(/\/$/, '');
  if (!base || base === '/') {
    return specPath;
  }
  return specPath.startsWith(`${base}/`) ? specPath : `${base}${specPath}`;
}
