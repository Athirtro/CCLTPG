/** Directorio de identidad: comprobaciones mínimas sobre `public.usuario`. */
export abstract class UserDirectory {
  abstract isActiveEducator(userId: string): Promise<boolean>;
}
