/** Datos deterministas compartidos entre el global setup y las specs E2E. */

export const E2E_PASSWORD = 'E2eClave#2026';
export const E2E_NEW_PASSWORD = 'E2eClaveNueva#2026';

/** Secreto TOTP base32 fijo (RFC 6238, SHA-1, 6 dígitos, 30 s). */
export const E2E_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

export type E2eUserKey =
  | 'estudiante'
  | 'educador'
  | 'admin'
  | 'cambio'
  | 'jefe_emisora'
  | 'programador'
  | 'realizador_externo'
  | 'operador_transmisor';

export interface E2eUserFixture {
  key: E2eUserKey;
  email: string;
  id: string;
  nombre: string;
  perfil:
    | 'administrador'
    | 'educador'
    | 'estudiante'
    | 'jefe_emisora'
    | 'programador'
    | 'realizador_externo'
    | 'operador_transmisor';
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
  {
    key: 'jefe_emisora',
    email: 'e2e-jefe-emisora@ccltpg.org',
    id: '55555555-5555-4555-8555-555555555555',
    nombre: 'E2E Jefe Emisora',
    perfil: 'jefe_emisora',
    debeCambiarPassword: false,
    mfaHabilitado: false,
  },
  {
    key: 'programador',
    email: 'e2e-programador@ccltpg.org',
    id: '66666666-6666-4666-8666-666666666666',
    nombre: 'E2E Programador',
    perfil: 'programador',
    debeCambiarPassword: false,
    mfaHabilitado: false,
  },
  {
    key: 'realizador_externo',
    email: 'e2e-realizador@ccltpg.org',
    id: '77777777-7777-4777-8777-777777777777',
    nombre: 'E2E Realizador externo',
    perfil: 'realizador_externo',
    debeCambiarPassword: false,
    mfaHabilitado: false,
  },
  {
    key: 'operador_transmisor',
    email: 'e2e-operador@ccltpg.org',
    id: '88888888-8888-4888-8888-888888888888',
    nombre: 'E2E Operador de transmisor',
    perfil: 'operador_transmisor',
    debeCambiarPassword: false,
    mfaHabilitado: false,
  },
];

/** Datos deterministas del recorrido E2E de la emisora (RF-01…RF-03). */
export const E2E_EMISORA = {
  anio: 2026,
  fechaProgramacion: '2026-01-19',
  fechaComite: '2026-02-10',
  actaArchivoId: 'cccccccc-0000-4000-8000-000000000009',
} as const;

export const userByKey = (key: E2eUserKey): E2eUserFixture => {
  const found = E2E_USERS.find((user) => user.key === key);
  if (!found) throw new Error(`Fixture E2E desconocida: ${key}`);
  return found;
};
