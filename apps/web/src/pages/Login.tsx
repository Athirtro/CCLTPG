import { useState } from 'react';
import { Box, Button, CssBaseline, Paper, TextField, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';

export default function Login() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f5f5f5',
      }}
    >
      <CssBaseline />
      <Paper elevation={3} sx={{ p: 4, width: 400, maxWidth: '100%', borderRadius: 2 }}>
        <Typography component="h1" variant="h5" align="center" gutterBottom sx={{ mb: 3 }}>
          CCLTPG — Iniciar sesión
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit} noValidate>
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
            sx={{ mb: 2 }}
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
            sx={{ mb: 3 }}
          />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={isLoading}>
            {isLoading ? 'Entrando…' : 'Iniciar sesión'}
          </Button>
        </form>
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Las cuentas son asignadas por el administrador del sistema.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
