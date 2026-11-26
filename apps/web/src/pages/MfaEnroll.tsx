import { useState } from 'react';
import { Box, Button, CssBaseline, Paper, TextField, Typography, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import { setSessionCredentials, type LoginResponseDto } from '../api/client';

export default function MfaEnroll() {
  const navigate = useNavigate();
  const { loadMe } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'secret' | 'confirm' | 'done'>('secret');
  const [secret, setSecret] = useState<string>('');
  const [otpauthUri, setOtpauthUri] = useState<string>('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enroll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: apiError, response } = await apiClient.POST('/auth/mfa/enroll');

      if (apiError || !data || response?.status !== 200) {
        throw new Error('No se pudo iniciar la inscripción MFA');
      }

      const dto = data;
      setSecret(dto.secret);
      setOtpauthUri(dto.otpauthUri);
      setStep('confirm');
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al inscribir MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const confirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/auth/mfa/enroll/confirm', {
        body: { code },
      });

      if (apiError || !data || response?.status !== 200) {
        throw new Error('Código de verificación inválido');
      }

      const dto = data as LoginResponseDto & { recoveryCodes: string[] };
      if (dto.status === 'authenticated') {
        setSessionCredentials(dto);
        await loadMe();
        setStep('done');
      } else {
        setError('Respuesta inesperada del servidor');
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al confirmar MFA');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'secret') {
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
            Inscripción MFA
          </Typography>
          <Typography variant="body2" align="center" sx={{ mb: 3 }}>
            Haz clic para generar tu secreto TOTP y configurar tu aplicación de autenticación.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Button fullWidth variant="contained" size="large" disabled={isLoading} onClick={enroll}>
            {isLoading ? 'Generando…' : 'Generar secreto TOTP'}
          </Button>
        </Paper>
      </Box>
    );
  }

  if (step === 'confirm') {
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
            Confirmar MFA
          </Typography>
          <Typography variant="body2" align="center" sx={{ mb: 2 }}>
            Escanea este QR con tu app de autenticación o ingresa el secreto manualmente:
          </Typography>
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" sx={{ mb: 1, fontFamily: 'monospace' }}>
              {secret}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {otpauthUri}
            </Typography>
          </Box>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <form noValidate>
            <TextField
              required
              fullWidth
              id="mfa-confirm-code"
              label="Código de verificación (6 dígitos)"
              name="code"
              type="text"

              value={code}
              onChange={(e) => setCode(e.target.value)}
              sx={{ mb: 3 }}
            />
            <Button
              type="button"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              onClick={confirm}
            >
              {isLoading ? 'Verificando…' : 'Activar MFA'}
            </Button>
          </form>
        </Paper>
      </Box>
    );
  }

  // done
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
      <Paper
        elevation={3}
        sx={{ p: 4, width: 400, maxWidth: '100%', borderRadius: 2, textAlign: 'center' }}
      >
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          MFA activado
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Tu autenticación de dos factores está configurada. Guarda tus códigos de recuperación en
          un lugar seguro.
        </Typography>
        <Button fullWidth variant="contained" onClick={() => navigate('/')}>
          Volver al inicio
        </Button>
      </Paper>
    </Box>
  );
}
