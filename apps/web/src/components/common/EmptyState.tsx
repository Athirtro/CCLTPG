import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { InboxOutlined as InboxOutlinedIcon } from '@mui/icons-material';

type Props = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  minHeight?: number | string;
};

export default function EmptyState({
  title = 'Sin resultados',
  description,
  icon,
  action,
  minHeight = 220,
}: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 1,
      }}
    >
      <Box sx={{ color: 'text.secondary', '& svg': { fontSize: 40 } }}>
        {icon ?? <InboxOutlinedIcon />}
      </Box>
      <Typography variant="h3">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Paper>
  );
}
