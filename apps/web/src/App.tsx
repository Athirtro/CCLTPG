import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
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
import NotFound from './pages/NotFound';

const theme = createTheme({
  palette: {
    primary: { main: '#1a237e' },
    secondary: { main: '#ff4081' },
  },
});

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            {/* Rutas públicas (sin layout de sidebar) */}
            <Route path="/login" element={<Login />} />
            <Route path="/mfa-verify" element={<MfaVerify />} />
            <Route path="/mfa-enroll" element={<MfaEnroll />} />
            <Route path="/password-change" element={<PasswordChange />} />
            {/* Redirección automática según estado de auth */}
            <Route path="/auth-redirect" element={<AuthRedirect />} />

            {/* Rutas privadas (con layout de sidebar) */}
            <Route element={<MainLayout />}>
              <Route index element={<Home />} />
              <Route path="/estudiantes" element={<Estudiantes />} />
              <Route path="/programas" element={<Programas />} />
              <Route path="/grupos" element={<Grupos />} />
              <Route path="/matriculas" element={<Matriculas />} />
              <Route path="/admin" element={<Admin />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
