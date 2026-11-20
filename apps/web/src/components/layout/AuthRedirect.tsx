import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthRedirect() {
  const { authStatus, user, sessionToken, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    // Si no hay usuario ni sesión, no redirigir (dejamos que las rutas públicas manejen)
    if (!user && !authStatus && !sessionToken) return;

    switch (authStatus) {
      case 'mfa_required':
        navigate('/mfa-verify', { replace: true });
        break;
      case 'password_change_required':
        navigate('/password-change', { replace: true });
        break;
      case 'mfa_enrollment_required':
        navigate('/mfa-enroll', { replace: true });
        break;
      case 'authenticated':
        if (user) {
          navigate('/', { replace: true });
        }
        break;
      default:
        // Sin estado de auth definido: si hay usuario, ir al home
        if (user) {
          navigate('/', { replace: true });
        }
    }
  }, [authStatus, user, sessionToken, isLoading, navigate]);

  return null;
}
