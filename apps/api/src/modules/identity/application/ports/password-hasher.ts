export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;
  abstract verify(hash: string, plain: string): Promise<boolean>;
  /** `true` si el hash usa parámetros inferiores a los actuales. */
  abstract needsRehash(hash: string): boolean;
  /** Verificación contra un hash señuelo para igualar tiempos. */
  abstract verifyDummy(plain: string): Promise<void>;
}
