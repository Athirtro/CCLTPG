import { useState } from 'react';
import { Box, Button, CssBaseline, Paper, TextField, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export default function MfaVerify() {
  const { verifyMfa, sessionToken, isLoading } = useAuth();
  const [code, setCode] = useState('');
  const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sessionToken) {
      setError('No hay sesión de verificación activa');
      return;
    }
    try {
      await verifyMfa(sessionToken, code, method);
      // AuthRedirect manejará la navegación según authStatus
    } catch {
      setError('Código MFA inválido o sesión expirada');
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
          Verificación MFA
        </Typography>
        <Typography variant="body2" align="center" sx={{ mb: 3 }}>
          Ingresa el código de 6 dígitos de tu aplicación de autenticación.
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
            id="mfa-code"
            label="Código MFA"
            name="code"
            type="text"

            value={code}
            onChange={(e) => setCode(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ mb: 1 }}>
              Método
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={method === 'totp' ? 'outlined' : 'text'}
                size="small"
                onClick={() => setMethod('totp')}
              >
                TOTP
              </Button>
              <Button
                variant={method === 'recovery' ? 'outlined' : 'text'}
                size="small"
                onClick={() => setMethod('recovery')}
              >
                Recuperación
              </Button>
            </Box>
          </Box>
          <Button type="submit" fullWidth variant="contained" size="large" disabled={isLoading}>
            {isLoading ? 'Verificando…' : 'Verificar'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
