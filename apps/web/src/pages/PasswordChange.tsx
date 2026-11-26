import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/common/AuthShell';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import { setSessionCredentials, type LoginResponseDto } from '../api/client';

export default function PasswordChange() {
  const navigate = useNavigate();
  const { user, loadMe, isLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    // Validación solo de UI: el cuerpo enviado sigue siendo { currentPassword, newPassword }.
    if (confirmPassword && confirmPassword !== newPassword) {
      setConfirmError('Las contraseñas no coinciden.');
      return;
    }
    setConfirmError(null);
    try {
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/auth/password', {
        body: { currentPassword, newPassword },
      });

      if (apiError || response?.status === 401) {
        throw new Error('Contraseña actual inválida');
      }

      if (response?.status === 204) {
        // Cambio exitoso sin sesión parcial
        setSuccess(true);
        await loadMe();
        void navigate('/');
        return;
      }

      if (data && (data as LoginResponseDto).status === 'authenticated') {
        setSessionCredentials(data);
        setSuccess(true);
        await loadMe();
        void navigate('/');
      } else {
        setError('Respuesta inesperada del servidor');
      }
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al cambiar la contraseña');
    }
  };

  if (success) {
    return (
      <AuthShell
        title="Contraseña actualizada"
        subtitle="Tu contraseña se ha cambiado correctamente."
        footnote="Ya puedes continuar con el uso del sistema."
      >
        <Button fullWidth variant="contained" onClick={() => navigate('/')}>
          Volver al inicio
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Cambio de contraseña"
      subtitle={
        user
          ? `Cambiando contraseña para ${user.email}`
          : 'Define una nueva contraseña para tu cuenta.'
      }
      footnote="La nueva contraseña debe cumplir la política de seguridad del sistema."
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
          id="current-password"
          label="Contraseña actual"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <TextField
          required
          fullWidth
          id="new-password"
          label="Nueva contraseña"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setConfirmError(null);
          }}
          helperText="Debe cumplir la política de seguridad del sistema."
        />
        <TextField
          required
          fullWidth
          id="confirm-password"
          label="Confirmar contraseña"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setConfirmError(null);
          }}
          error={Boolean(confirmError)}
          helperText={confirmError ?? undefined}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={isLoading}
          sx={{ mt: 1 }}
        >
          {isLoading ? 'Cambiando…' : 'Cambiar contraseña'}
        </Button>
      </Box>
    </AuthShell>
  );
}
