import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/** Rutas donde el estado de autenticación decide la navegación. */
const AUTH_ROUTES = new Set([
  '/',
  '/login',
  '/auth-redirect',
  '/mfa-verify',
  '/mfa-enroll',
  '/password-change',
]);

export default function AuthRedirect() {
  const { authStatus, user, sessionToken, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (isLoading) return;
    // En una ruta privada (deep-link o recarga) el guard decide; no lo
    // redirigimos al home solo porque la sesión ya esté autenticada.
    if (!AUTH_ROUTES.has(pathname)) return;

    // Si no hay usuario ni sesión, no redirigir (dejamos que las rutas públicas manejen)
    if (!user && !authStatus && !sessionToken) return;

    switch (authStatus) {
      case 'mfa_required':
        void navigate('/mfa-verify', { replace: true });
        break;
      case 'password_change_required':
        void navigate('/password-change', { replace: true });
        break;
      case 'mfa_enrollment_required':
        void navigate('/mfa-enroll', { replace: true });
        break;
      case 'authenticated':
        if (user) {
          void navigate('/', { replace: true });
        }
        break;
      default:
        // Sin estado de auth definido: si hay usuario, ir al home
        if (user) {
          void navigate('/', { replace: true });
        }
    }
  }, [authStatus, user, sessionToken, isLoading, navigate, pathname]);

  return null;
}
