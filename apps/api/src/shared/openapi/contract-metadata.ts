import { applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const ACCESS_MODES = [
  'public',
  'partial',
  'partial_or_session',
  'authenticated',
  'permission',
] as const;

export const SCOPE_MODES = ['global', 'own', 'group', 'mixed'] as const;

export const PARTIAL_SCOPES = ['mfa_verify', 'mfa_enroll', 'pwd_change'] as const;

export type AccessMode = (typeof ACCESS_MODES)[number];
export type ScopeMode = (typeof SCOPE_MODES)[number];
export type PartialScope = (typeof PARTIAL_SCOPES)[number];

export interface ContractMetadata {
  access: AccessMode;
  permission?: readonly string[];
  scope: ScopeMode;
  auditEvent: string;
  partialScope?: readonly PartialScope[];
  errorCodes?: readonly string[];
  /** Justificación obligatoria cuando una operación mutante no se audita. */
  auditExempt?: string;
  /** La operación es idempotente sin sesión (p. ej. `logout`). */
  allowAnonymous?: boolean;
}

/**
 * Declara las extensiones `x-*` que exige R-028 en cada operación.
 * Se aplican al objeto Operation del OpenAPI generado desde el código.
 */
export function ApiContract(metadata: ContractMetadata): MethodDecorator & ClassDecorator {
  const decorators = [
    ApiExtension('x-access', metadata.access),
    ApiExtension('x-permission', metadata.permission ? [...metadata.permission] : []),
    ApiExtension('x-scope', metadata.scope),
    ApiExtension('x-audit-event', metadata.auditEvent),
  ];

  if (metadata.partialScope) {
    decorators.push(ApiExtension('x-partial-scope', [...metadata.partialScope]));
  }

  if (metadata.errorCodes) {
    decorators.push(ApiExtension('x-error-codes', [...metadata.errorCodes]));
  }

  if (metadata.auditExempt) {
    decorators.push(ApiExtension('x-audit-exempt', metadata.auditExempt));
  }

  if (metadata.allowAnonymous) {
    decorators.push(ApiExtension('x-allow-anonymous', true));
  }

  return applyDecorators(...decorators);
}
