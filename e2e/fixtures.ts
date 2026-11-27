/** Datos deterministas compartidos entre el global setup y las specs E2E. */

export const E2E_PASSWORD = 'E2eClave#2026';
export const E2E_NEW_PASSWORD = 'E2eClaveNueva#2026';

/** Secreto TOTP base32 fijo (RFC 6238, SHA-1, 6 dígitos, 30 s). */
export const E2E_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

export type E2eUserKey = 'estudiante' | 'educador' | 'admin' | 'cambio';

export interface E2eUserFixture {
  key: E2eUserKey;
  email: string;
  id: string;
  nombre: string;
  perfil: 'administrador' | 'educador' | 'estudiante';
  debeCambiarPassword: boolean;
  mfaHabilitado: boolean;
}

export const E2E_USERS: readonly E2eUserFixture[] = [
  {
    key: 'estudiante',
    email: 'e2e-estudiante@ccltpg.org',
    id: '33333333-3333-4333-8333-333333333333',
    nombre: 'E2E Estudiante',
    perfil: 'estudiante',
    debeCambiarPassword: false,
    mfaHabilitado: false,
  },
  {
    key: 'educador',
    email: 'e2e-educador@ccltpg.org',
    id: '22222222-2222-4222-8222-222222222222',
    nombre: 'E2E Educador',
    perfil: 'educador',
    debeCambiarPassword: false,
    mfaHabilitado: true,
  },
  {
    key: 'admin',
    email: 'e2e-admin@ccltpg.org',
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'E2E Administrador',
    perfil: 'administrador',
    debeCambiarPassword: false,
    mfaHabilitado: true,
  },
  {
    key: 'cambio',
    email: 'e2e-cambio@ccltpg.org',
    id: '44444444-4444-4444-8444-444444444444',
    nombre: 'E2E Cambio forzado',
    perfil: 'administrador',
    debeCambiarPassword: true,
    mfaHabilitado: false,
  },
];

export const userByKey = (key: E2eUserKey): E2eUserFixture => {
  const found = E2E_USERS.find((user) => user.key === key);
  if (!found) throw new Error(`Fixture E2E desconocida: ${key}`);
  return found;
};
