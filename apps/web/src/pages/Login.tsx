import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, TextField } from '@mui/material';
import AuthShell from '../components/common/AuthShell';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';

export default function Login() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      // El login gestiona la navegación interna según el authStatus:
      // - authenticated → /me → Home
      // - mfa_required → /mfa-verify
      // - password_change_required → /password-change
      // - mfa_enrollment_required → /mfa-enroll
    } catch (err) {
      setError(getErrorMessage(err) || 'Credenciales inválidas o error del servidor');
    }
  };

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Ingresa tus credenciales para acceder al sistema."
      footnote="Las cuentas son asignadas por el administrador del sistema."
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <TextField
          required
          fullWidth
          id="email"
          label="Correo electrónico"
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          required
          fullWidth
          name="password"
          label="Contraseña"
          type="password"
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={isLoading}
          sx={{ mt: 1 }}
        >
          {isLoading ? 'Entrando…' : 'Iniciar sesión'}
        </Button>
      </Box>
    </AuthShell>
  );
}
