import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  apiClient,
  getCsrfCookie,
  hasSessionMarker,
  setSessionCredentials,
  setSessionCsrf,
  type MeResponseDto,
  type ProblemDetailsDto,
} from '../api/client';

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
  isRestoring: boolean;
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

function describeAuthError(
  error: ProblemDetailsDto | string | undefined,
  response: Response | undefined,
  fallback: string,
): Error {
  if (response?.status === 429) {
    return new Error('Demasiados intentos. Espera unos minutos antes de volver a intentarlo.');
  }
  if (response && response.status >= 500) {
    return new Error('El servidor no está disponible. Intenta de nuevo más tarde.');
  }
  const detail = typeof error === 'object' ? error?.detail : undefined;
  return new Error(detail || fallback);
}

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

type AuthProviderProps = {
  children: ReactNode;
  /** Solo para pruebas: evita la llamada real a `/me` al montar. */
  initialUser?: User;
  /** Solo para pruebas: token de verificación MFA en memoria. */
  initialSessionToken?: string;
};

export function AuthProvider({ children, initialUser, initialSessionToken }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(
    () => !initialUser && hasSessionMarker() && getCsrfCookie() !== null,
  );
  const [authStatus, setAuthStatus] = useState<AuthContextType['authStatus']>(
    initialUser ? 'authenticated' : null,
  );
  // El token de verificación MFA vive solo en memoria (diseño §15 / ADR-0002).
  const [sessionToken, setSessionToken] = useState<string | null>(initialSessionToken ?? null);

  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  );

  const hasProfile = useCallback(
    (profile: string) => user?.profiles.includes(profile) ?? false,
    [user],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.POST('/auth/logout');
    } catch {
      // Ignorar errores de red en logout; siempre limpiamos el estado local.
    }
    setUser(null);
    setAuthStatus(null);
    setSessionToken(null);
    setSessionCredentials(null);
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const { data, error } = await apiClient.GET('/me');
      if (!error && data) {
        setUser(mapToUser(data));
        setAuthStatus('authenticated');
      } else {
        await logout();
      }
    } catch {
      await logout();
    }
  }, [logout]);

  // Al recargar, el access token vive solo en memoria: se restaura desde la
  // cookie de refresh (AC-SEC-21) y solo entonces se consulta `/me`.
  const restoreAttempted = useRef(false);
  useEffect(() => {
    if (initialUser || restoreAttempted.current) return;
    restoreAttempted.current = true;

    const csrf = getCsrfCookie();
    if (!hasSessionMarker() || !csrf) {
      setIsRestoring(false);
      return;
    }

    setSessionCsrf(csrf);
    void (async () => {
      try {
        const { data, error, response } = await apiClient.POST('/auth/refresh');
        if (error || !data || response?.status !== 200) {
          setSessionCredentials(null);
          return;
        }
        setSessionCredentials(data);
        setAuthStatus('authenticated');
        await loadMe();
      } catch {
        setSessionCredentials(null);
      } finally {
        setIsRestoring(false);
      }
    })();
  }, [initialUser, loadMe]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error, response } = await apiClient.POST('/auth/login', {
        body: { email, password },
      });

      if (error || !data || response?.status !== 200) {
        throw describeAuthError(error, response, 'Credenciales inválidas');
      }

      setAuthStatus(data.status);
      setSessionToken(data.sessionToken ?? null);
      setSessionCredentials(data);

      if (data.status === 'authenticated') {
        await loadMe();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMfa = async (sessionToken: string, code: string, method?: 'totp' | 'recovery') => {
    setIsLoading(true);
    try {
      const { data, error, response } = await apiClient.POST('/auth/mfa/verify', {
        body: { sessionToken, code, method },
      });

      if (error || !data || response?.status !== 200) {
        throw describeAuthError(error, response, 'Código MFA inválido');
      }

      setAuthStatus(data.status);
      setSessionToken(data.sessionToken ?? null);
      setSessionCredentials(data);

      if (data.status === 'authenticated') {
        await loadMe();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isRestoring,
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
