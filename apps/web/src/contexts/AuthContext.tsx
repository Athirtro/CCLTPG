import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { apiClient, type MeResponseDto } from '../api/client';

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  profiles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  mustChangePassword: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  authStatus:
    | 'authenticated'
    | 'password_change_required'
    | 'mfa_required'
    | 'mfa_enrollment_required'
    | null;
  sessionToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  verifyMfa: (sessionToken: string, code: string, method?: 'totp' | 'recovery') => Promise<void>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasProfile: (profile: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  initialUser,
}: { children: ReactNode; initialUser?: User }) {
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<
    AuthContextType['authStatus']
  >(initialUser ? 'authenticated' : null);
  const [sessionToken, setSessionToken] = useState<string | null>(
    () => localStorage.getItem('ccltpg_session_token')
  );

  const mapToUser = (dto: MeResponseDto): User => ({
    id: dto.userId,
    email: dto.email,
    fullName: dto.nombre,
    role: dto.activeProfile ?? '',
    profiles: dto.profiles.map((p) => p.codigo),
    permissions: dto.permissions,
    mfaEnabled: dto.mfaEnabled,
    mustChangePassword: dto.mustChangePassword,
  });

  const hasPermission = useCallback((permission: string) => {
    return user?.permissions.includes(permission) ?? false;
  }, [user]);

  const hasProfile = useCallback((profile: string) => {
    return user?.profiles.includes(profile) ?? false;
  }, [user]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error, response } = await apiClient.POST('/auth/login', {
        body: { email, password },
      });

      if (error || !data || response?.status !== 200) {
        throw new Error('Credenciales inválidas o error del servidor');
      }

      setAuthStatus(data.status);
      setSessionToken(data.sessionToken ?? null);
      if (data.sessionToken) {
        localStorage.setItem('ccltpg_session_token', data.sessionToken);
      } else {
        localStorage.removeItem('ccltpg_session_token');
      }

      if (data.status === 'authenticated') {
        await loadMe();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMfa = async (
    sessionToken: string,
    code: string,
    method?: 'totp' | 'recovery',
  ) => {
    setIsLoading(true);
    try {
      const { data, error, response } = await apiClient.POST('/auth/mfa/verify', {
        body: { sessionToken, code, method },
      });

      if (error || !data || response?.status !== 200) {
        throw new Error('Código MFA inválido');
      }

      setAuthStatus(data.status);
      setSessionToken(data.sessionToken ?? null);
      if (data.sessionToken) {
        localStorage.setItem('ccltpg_session_token', data.sessionToken);
      } else {
        localStorage.removeItem('ccltpg_session_token');
      }

      if (data.status === 'authenticated') {
        await loadMe();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadMe = async () => {
    try {
      const { data, error } = await apiClient.GET('/me');
      if (!error && data) {
        setUser(mapToUser(data));
        setAuthStatus('authenticated');
      } else {
        logout();
      }
    } catch {
      logout();
    }
  };

  const logout = async () => {
    try {
      await apiClient.POST('/auth/logout');
    } catch {
      // Ignorar errores de red en logout; siempre limpiamos localmente
    }
    setUser(null);
    setAuthStatus(null);
    setSessionToken(null);
    localStorage.removeItem('ccltpg_session_token');
  };

  const value: AuthContextType = {
    user,
    isLoading,
    authStatus,
    sessionToken,
    login,
    verifyMfa,
    logout,
    loadMe,
    hasPermission,
    hasProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}

export { apiClient };
