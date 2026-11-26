import { Box, Button, Paper, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { ErrorOutlined as ErrorOutlineIcon, Refresh as RefreshIcon } from '@mui/icons-material';

type Props = {
  message: string;
  onRetry?: () => void;
  minHeight?: number | string;
  sx?: SxProps<Theme>;
};

export default function ErrorState({ message, onRetry, minHeight = 220, sx }: Props) {
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
        ...sx,
      }}
      role="alert"
    >
      <ErrorOutlineIcon color="error" sx={{ fontSize: 40 }} />
      <Typography variant="h3">No se pudo cargar la información</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
        {message}
      </Typography>
      {onRetry && (
        <Box sx={{ mt: 1 }}>
          <Button startIcon={<RefreshIcon />} onClick={onRetry}>
            Reintentar
          </Button>
        </Box>
      )}
    </Paper>
  );
}
