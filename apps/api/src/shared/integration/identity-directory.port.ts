/**
 * Puerto público de identidad para contextos vecinos (plan §2.2, decisión I4).
 *
 * Emisora resuelve aquí usuarios y perfiles vigentes sin leer `public` ni
 * importar el contexto `identity`. El módulo de identidad publica un proveedor
 * nuevo que implementa este contrato; no se toca ningún caso de uso existente.
 */

export const IDENTITY_DIRECTORY = Symbol('CCLTPG_IDENTITY_DIRECTORY');

export type IdentityUserEstado = 'activo' | 'inactivo' | 'bloqueado';

export interface IdentityProfileRef {
  codigo: string;
  validUntil: Date | null;
}

export interface IdentityUserRef {
  id: string;
  email: string;
  nombre: string;
  estado: IdentityUserEstado;
  perfiles: readonly IdentityProfileRef[];
}

export interface IdentityDirectory {
  findById(id: string): Promise<IdentityUserRef | null>;
  findByEmail(email: string): Promise<IdentityUserRef | null>;
  /** Perfil vigente en `now` (por defecto, ahora); útil para identidad temporal. */
  hasActiveProfile(usuarioId: string, codigo: string, now?: Date): Promise<boolean>;
}
