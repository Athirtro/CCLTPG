import type { ReactNode } from 'react';
import { Avatar, Box, Paper, Typography } from '@mui/material';
import { SchoolOutlined as SchoolOutlinedIcon } from '@mui/icons-material';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footnote?: ReactNode;
};

/** Marco compartido por login, MFA y cambio de contraseña. */
export default function AuthShell({ title, subtitle, children, footnote }: Props) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 0.85fr) minmax(0, 1.15fr)' },
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          bgcolor: 'primary.main',
          color: 'common.white',
          p: 6,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar variant="rounded" sx={{ bgcolor: 'rgba(255,255,255,0.16)' }}>
            <SchoolOutlinedIcon />
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ color: 'inherit' }}>
              CCLTPG
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
              Gestión académica y cultural
            </Typography>
          </Box>
        </Box>
        <Box>
          <Typography variant="h2" component="p" sx={{ color: 'inherit', maxWidth: 420, mb: 1 }}>
            Centro Cultural Lucy Tejada
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.78)', maxWidth: 420 }}>
            Un espacio para la formación artística, la gestión ordenada y el seguimiento de cada
            estudiante.
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
          Pereira, Colombia
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 4 },
        }}
      >
        <Paper
          elevation={0}
          sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 4 }, borderRadius: 2 }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography component="h1" variant="h1">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {children}
          {footnote && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {footnote}
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
