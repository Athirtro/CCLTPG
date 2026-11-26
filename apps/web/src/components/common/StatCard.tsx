import type { ReactNode } from 'react';
import { Avatar, Box, Paper, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import StatusChip from './StatusChip';
import type { StatusTone } from '../../theme/palette';

type Props = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  status?: { label: string; tone: StatusTone };
  to?: string;
  sx?: SxProps<Theme>;
};

export default function StatCard({ label, value, icon, description, status, to, sx }: Props) {
  const contenido = (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      {icon && (
        <Avatar
          variant="rounded"
          sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 40, height: 40 }}
        >
          {icon}
        </Avatar>
      )}
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, fontSize: '1.75rem' }}>
          {value}
        </Typography>
        {description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {description}
          </Typography>
        )}
        {status && (
          <Box sx={{ mt: 1 }}>
            <StatusChip status={status.tone} label={status.label} />
          </Box>
        )}
      </Box>
    </Box>
  );

  const estilos: SxProps<Theme> = {
    p: 2,
    height: '100%',
    display: 'block',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    ...(to && {
      '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 14px rgba(31, 58, 95, 0.10)' },
    }),
    ...sx,
  };

  return to ? (
    <Paper component={RouterLink} to={to} elevation={0} sx={estilos}>
      {contenido}
    </Paper>
  ) : (
    <Paper elevation={0} sx={estilos}>
      {contenido}
    </Paper>
  );
}
