import { useState } from 'react';
import {
  Box,
  Button,
  CssBaseline,
  Paper,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function MfaVerify() {
  const navigate = useNavigate();
  const { verifyMfa, isLoading } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const partialSessionId = localStorage.getItem('ccltpg_partial_session') ?? '';
      await verifyMfa(partialSessionId, code);
      navigate('/');
    } catch {
      setError('Código MFA inválido');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <CssBaseline />
      <Paper
        elevation={3}
        sx={{ p: 4, width: 400, maxWidth: '100%', borderRadius: 2 }}
      >
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
            sx={{ mb: 3 }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={isLoading}
          >
            {isLoading ? 'Verificando…' : 'Verificar'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
