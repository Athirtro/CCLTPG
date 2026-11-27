import { useState } from 'react';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { ContentCopy as ContentCopyIcon, Shield as ShieldIcon } from '@mui/icons-material';

import { apiClient } from '../api/client';
import { getErrorMessage } from '../api/errors';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';

export default function Seguridad() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regenerar = async () => {
    if (!code.trim()) {
      setError('Ingresa un código TOTP o de recuperación válido.');
      return;
    }
    setEnviando(true);
    setError(null);
    setCodes([]);
    try {
      const {
        data,
        error: apiError,
        response,
      } = await apiClient.POST('/auth/mfa/recovery-codes', { body: { code: code.trim() } });
      if (apiError || response?.status !== 200 || !data) {
        setError(apiError?.detail || 'No se pudieron regenerar los códigos de recuperación.');
        return;
      }
      setCodes(data.recoveryCodes);
      setCode('');
    } catch (err) {
      setError(getErrorMessage(err) || 'Error al regenerar los códigos de recuperación.');
    } finally {
      setEnviando(false);
    }
  };

  const copiar = async () => {
    if (codes.length === 0 || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(codes.join('\n'));
  };

  return (
    <Box>
      <PageHeader
        title="Seguridad"
        description="Gestiona los códigos de recuperación de tu cuenta MFA."
        icon={<ShieldIcon />}
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Seguridad' }]}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <SectionCard
        title="Códigos de recuperación"
        subtitle="Se muestran una sola vez: guárdalos en un lugar seguro antes de cerrar esta vista."
      >
        <Alert severity="info" sx={{ mb: 2 }}>
          {user?.mfaEnabled
            ? 'MFA está habilitado. Necesitas un código TOTP o de recuperación vigente para generar otros nuevos.'
            : 'Aún no tienes MFA habilitado. Puedes usar esta acción cuando completes el enrolamiento.'}
        </Alert>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <TextField
            label="Código TOTP o de recuperación"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="one-time-code"
            sx={{ flex: '1 1 260px' }}
          />
          <Button
            variant="contained"
            onClick={() => void regenerar()}
            disabled={enviando || !code.trim()}
          >
            {enviando ? 'Generando…' : 'Regenerar códigos'}
          </Button>
        </Box>

        {codes.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="h4" component="h3">
                Nuevos códigos
              </Typography>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void copiar()}>
                Copiar
              </Button>
            </Box>
            <Paper
              variant="outlined"
              component="ul"
              sx={{
                m: 0,
                p: 2,
                listStyle: 'none',
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {codes.map((recoveryCode, indice) => (
                <Typography
                  component="li"
                  key={`${recoveryCode}-${indice}`}
                  sx={{ fontFamily: 'monospace', letterSpacing: 1 }}
                >
                  {recoveryCode}
                </Typography>
              ))}
            </Paper>
            <Alert severity="warning" sx={{ mt: 2 }}>
              Estos códigos reemplazan a los anteriores y no volverán a mostrarse.
            </Alert>
          </Box>
        )}
      </SectionCard>
    </Box>
  );
}
