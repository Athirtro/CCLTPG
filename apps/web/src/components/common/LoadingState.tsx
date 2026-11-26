import { CircularProgress, Paper, Typography } from '@mui/material';

type Props = {
  label?: string;
  minHeight?: number | string;
};

export default function LoadingState({ label = 'Cargando información…', minHeight = 220 }: Props) {
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
        gap: 1.5,
      }}
      role="status"
      aria-live="polite"
    >
      <CircularProgress size={32} aria-hidden="true" />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}
