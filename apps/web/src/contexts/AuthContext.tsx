import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { apiClient } from '../api/client';

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  profiles: string[];
  permissions: string[];
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  verifyMfa: (partialSessionId: string, code: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasProfile: (profile: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('ccltpg_access_token'),
  );
  const [isLoading, setIsLoading] = useState(false);

  const hasPermission = useCallback(
    (permission: string) => {
      return user?.permissions.includes(permission) ?? false;
    },
    [user],
  );

  const hasProfile = useCallback(
    (profile: string) => {
      return user?.profiles.includes(profile) ?? false;
    },
    [user],
  );

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error, response } = await apiClient.POST('/auth/login', {
        body: { email, password },
      });

      if (error || !data || response?.status !== 200) {
        throw new Error('Credenciales inválidas');
      }

      if (data.mfaRequired && data.partialSessionId) {
        localStorage.setItem('ccltpg_partial_session', data.partialSessionId);
        throw new Error('MFA_REQUIRED');
      }

      if (data.accessToken) {
        setToken(data.accessToken);
        localStorage.setItem('ccltpg_access_token', data.accessToken);
        await loadMe();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMfa = async (partialSessionId: string, code: string) => {
    setIsLoading(true);
    try {
      const { data, error, response } = await apiClient.POST('/auth/mfa/verify', {
        body: { partialSessionId, code },
      });

      if (error || !data || response?.status !== 200) {
        throw new Error('Código MFA inválido');
      }

      if (data.accessToken) {
        setToken(data.accessToken);
        localStorage.setItem('ccltpg_access_token', data.accessToken);
        localStorage.removeItem('ccltpg_partial_session');
        await loadMe();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadMe = async () => {
    if (!token) return;
    try {
      const { data, error } = await apiClient.GET('/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!error && data) {
        setUser(data);
      }
    } catch {
      logout();
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('ccltpg_access_token');
    localStorage.removeItem('ccltpg_partial_session');
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    verifyMfa,
    logout,
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
