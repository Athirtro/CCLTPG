import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import AuthShell from '../components/common/AuthShell';
import { useAuth } from '../contexts/AuthContext';

export default function MfaVerify() {
  const { verifyMfa, sessionToken, isLoading } = useAuth();
  const [code, setCode] = useState('');
  const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
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
    <AuthShell
      title="Verificación MFA"
      subtitle="Ingresa el código de 6 dígitos de tu aplicación de autenticación."
      footnote="Si no tienes acceso a la aplicación, usa un código de recuperación."
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
          id="mfa-code"
          label="Código MFA"
          name="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Método
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              type="button"
              fullWidth
              variant={method === 'totp' ? 'outlined' : 'text'}
              size="small"
              aria-pressed={method === 'totp'}
              onClick={() => setMethod('totp')}
            >
              TOTP
            </Button>
            <Button
              type="button"
              fullWidth
              variant={method === 'recovery' ? 'outlined' : 'text'}
              size="small"
              aria-pressed={method === 'recovery'}
              onClick={() => setMethod('recovery')}
            >
              Recuperación
            </Button>
          </Box>
        </Box>
        <Button type="submit" fullWidth variant="contained" size="large" disabled={isLoading}>
          {isLoading ? 'Verificando…' : 'Verificar'}
        </Button>
      </Box>
    </AuthShell>
  );
}
