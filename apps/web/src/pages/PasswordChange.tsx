import { useState } from 'react';
import { Box, Button, CssBaseline, Paper, TextField, Typography, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth, apiClient } from '../contexts/AuthContext';
import { getErrorMessage } from '../api/errors';
import type { LoginResponseDto } from '../api/client';

export default function PasswordChange() {
  const navigate = useNavigate();
  const { user, loadMe, isLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
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
            Contraseña actualizada
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Tu contraseña se ha cambiado correctamente.
          </Typography>
          <Button fullWidth variant="contained" onClick={() => navigate('/')}>
            Volver al inicio
          </Button>
        </Paper>
      </Box>
    );
  }

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
          Cambio de contraseña
        </Typography>
        {user && (
          <Typography variant="body2" align="center" sx={{ mb: 3, color: 'text.secondary' }}>
            Cambiando contraseña para {user.email}
          </Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit} noValidate>
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
            sx={{ mb: 2 }}
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
            onChange={(e) => setNewPassword(e.target.value)}
            sx={{ mb: 3 }}
          />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={isLoading}>
            {isLoading ? 'Cambiando…' : 'Cambiar contraseña'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
