/**
 * Política de propiedad de emisora para permisos `*_own` (plan §2.2 y §5.2).
 *
 * La verificación es siempre del lado servidor: el permiso `*_own` no basta
 * por sí solo. La implementación resuelve el principal con `IdentityDirectory`,
 * sin consultar `public` directamente.
 */

export const EMISORA_OWNERSHIP_POLICY = Symbol('CCLTPG_EMISORA_OWNERSHIP_POLICY');

export interface EmisoraOwnershipPolicy {
  isOwner(usuarioId: string, ownerUsuarioId: string | null | undefined): Promise<boolean>;
}
