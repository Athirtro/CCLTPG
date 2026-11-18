import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import MfaVerify from './pages/MfaVerify';
import Home from './pages/Home';
import Estudiantes from './pages/Estudiantes';
import Programas from './pages/Programas';
import Grupos from './pages/Grupos';
import Matriculas from './pages/Matriculas';
import Admin from './pages/Admin';
import Health from './pages/Health';
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
            <Route path="/login" element={<Login />} />
            <Route path="/mfa-verify" element={<MfaVerify />} />
            <Route element={<MainLayout />}>
              <Route index element={<Home />} />
              <Route path="/estudiantes" element={<Estudiantes />} />
              <Route path="/programas" element={<Programas />} />
              <Route path="/grupos" element={<Grupos />} />
              <Route path="/matriculas" element={<Matriculas />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/estado" element={<Health />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
