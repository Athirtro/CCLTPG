import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { Box, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import AuthRedirect from './components/layout/AuthRedirect';
import Login from './pages/Login';
import MfaVerify from './pages/MfaVerify';
import MfaEnroll from './pages/MfaEnroll';
import PasswordChange from './pages/PasswordChange';
import Home from './pages/Home';
import Estudiantes from './pages/Estudiantes';
import Programas from './pages/Programas';
import Grupos from './pages/Grupos';
import Matriculas from './pages/Matriculas';
import Admin from './pages/Admin';
import Archivos from './pages/Archivos';
import Notificaciones from './pages/Notificaciones';
import Preferencias from './pages/Preferencias';
import Exportaciones from './pages/Exportaciones';
import MiHorario from './pages/MiHorario';
import MisEvaluaciones from './pages/MisEvaluaciones';
import VistaEducador from './pages/VistaEducador';
import Kpis from './pages/Kpis';
import Reportes from './pages/Reportes';
import Health from './pages/Health';
import NotFound from './pages/NotFound';
import EmisoraRoutes from './extensions/emisora/routes';
import { theme } from './theme/theme';

/** Evita que un deep-link privado se renderice sin sesión autenticada. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isRestoring } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isRestoring && !user) {
      void navigate('/login', { replace: true });
    }
  }, [isRestoring, user, navigate]);

  if (isRestoring) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        Restaurando sesión…
      </Box>
    );
  }
  return user ? <>{children}</> : null;
}

function AppRoutes() {
  const { isRestoring } = useAuth();

  return (
    <BrowserRouter>
      {isRestoring ? (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          Restaurando sesión…
        </Box>
      ) : (
        <>
          {/* Debe estar montado también en las rutas públicas: tras login/MFA
              el estado cambia en /login o /mfa-verify y hay que navegar. */}
          <AuthRedirect />
          <Routes>
            {/* Rutas públicas (sin layout de sidebar) */}
            <Route path="/login" element={<Login />} />
            <Route path="/mfa-verify" element={<MfaVerify />} />
            <Route path="/mfa-enroll" element={<MfaEnroll />} />
            <Route path="/password-change" element={<PasswordChange />} />
            {/* Redirección automática según estado de auth */}
            <Route path="/auth-redirect" element={<AuthRedirect />} />

            {/* Rutas privadas (con layout de sidebar) */}
            <Route
              element={
                <RequireAuth>
                  <MainLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Home />} />
              <Route path="/estudiantes" element={<Estudiantes />} />
              <Route path="/programas" element={<Programas />} />
              <Route path="/grupos" element={<Grupos />} />
              <Route path="/matriculas" element={<Matriculas />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/archivos" element={<Archivos />} />
              <Route path="/notificaciones" element={<Notificaciones />} />
              <Route path="/preferencias" element={<Preferencias />} />
              <Route path="/exportaciones" element={<Exportaciones />} />
              <Route path="/mi-horario" element={<MiHorario />} />
              <Route path="/mis-evaluaciones" element={<MisEvaluaciones />} />
              <Route path="/vista-educador" element={<VistaEducador />} />
              <Route path="/kpis" element={<Kpis />} />
              <Route path="/reportes" element={<Reportes />} />
              <Route path="/emisora/*" element={<EmisoraRoutes />} />
              <Route path="/estado" element={<Health />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </>
      )}
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppRoutes />
      </ThemeProvider>
    </AuthProvider>
  );
}
