import type {
  EstadoUsuario,
  PerfilVigente,
  RecoveryCodeRecord,
  UsuarioSnapshot,
} from '../../domain/identity.types.js';

export interface CreateUserInput {
  id: string;
  email: string;
  nombre: string;
  passwordHash: string;
  estado: EstadoUsuario;
  debeCambiarPassword: boolean;
}

export interface AssignProfileInput {
  id: string;
  usuarioId: string;
  perfilId: string;
  validUntil: Date | null;
  asignadoPor: string | null;
}

export interface UserListFilter {
  search?: string;
  estado?: EstadoUsuario;
  limit: number;
  offset: number;
}

export interface UserListRow {
  id: string;
  email: string;
  nombre: string;
  estado: EstadoUsuario;
  mfaHabilitado: boolean;
  debeCambiarPassword: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface GrantedPermissionRow {
  perfilId: string;
  codigo: string;
}

export abstract class IdentityRepository {
  abstract findByEmail(email: string): Promise<UsuarioSnapshot | null>;
  abstract findById(id: string): Promise<UsuarioSnapshot | null>;
  abstract listProfiles(userId: string, at: Date): Promise<PerfilVigente[]>;
  abstract listGrantedPermissions(perfilIds: readonly string[]): Promise<GrantedPermissionRow[]>;

  abstract listRecoveryCodes(userId: string): Promise<RecoveryCodeRecord[]>;
  abstract markRecoveryCodeUsed(id: string, at: Date): Promise<void>;

  abstract updatePasswordHash(id: string, passwordHash: string, at: Date): Promise<void>;
  abstract updateNombre(id: string, nombre: string, at: Date): Promise<void>;
  abstract setMustChangePassword(id: string, value: boolean, at: Date): Promise<void>;
  abstract setMfaSecretCifrado(id: string, encrypted: string | null, at: Date): Promise<void>;
  abstract enableMfa(id: string, at: Date): Promise<void>;
  abstract disableMfa(id: string, at: Date): Promise<void>;
  abstract replaceRecoveryCodes(
    userId: string,
    codes: readonly { id: string; hash: string }[],
    at: Date,
  ): Promise<void>;
  abstract deleteRecoveryCodes(userId: string): Promise<void>;
  abstract setEstado(id: string, estado: EstadoUsuario, at: Date): Promise<void>;

  abstract listUsers(filter: UserListFilter): Promise<UserListRow[]>;
  abstract countUsers(filter: Omit<UserListFilter, 'limit' | 'offset'>): Promise<number>;
  abstract createUser(input: CreateUserInput): Promise<void>;
  abstract assignProfile(input: AssignProfileInput): Promise<void>;
  abstract findPerfilByCodigo(codigo: string): Promise<{ id: string; codigo: string } | null>;
  abstract countActiveProfiles(userId: string, at: Date): Promise<number>;
}
