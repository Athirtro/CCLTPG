import { useState } from 'react';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/common/AuthShell';
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
      <AuthShell
        title="Inscripción MFA"
        subtitle="Haz clic para generar tu secreto TOTP y configurar tu aplicación de autenticación."
        footnote="La inscripción MFA es obligatoria para continuar."
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Button fullWidth variant="contained" size="large" disabled={isLoading} onClick={enroll}>
          {isLoading ? 'Generando…' : 'Generar secreto TOTP'}
        </Button>
      </AuthShell>
    );
  }

  if (step === 'confirm') {
    return (
      <AuthShell
        title="Confirmar MFA"
        subtitle="Escanea este QR con tu app de autenticación o ingresa el secreto manualmente:"
        footnote="Guarda el secreto en un lugar seguro antes de activar la verificación."
      >
        <Box
          sx={{
            mb: 2,
            p: 2,
            bgcolor: 'background.default',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" sx={{ mb: 1, fontFamily: 'monospace' }}>
            {secret}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {otpauthUri}
          </Typography>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Box
          component="form"
          noValidate
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <TextField
            required
            fullWidth
            id="mfa-confirm-code"
            label="Código de verificación (6 dígitos)"
            name="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={isLoading}>
            {isLoading ? 'Verificando…' : 'Activar MFA'}
          </Button>
        </Box>
      </AuthShell>
    );
  }

  // done
  return (
    <AuthShell
      title="MFA activado"
      subtitle="Tu autenticación de dos factores está configurada. Guarda tus códigos de recuperación en un lugar seguro."
      footnote="Ya puedes continuar con el uso del sistema."
    >
      <Button fullWidth variant="contained" onClick={() => navigate('/')}>
        Volver al inicio
      </Button>
    </AuthShell>
  );
}
