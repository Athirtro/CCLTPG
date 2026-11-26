import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

type Props = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  sx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
};

/** Tarjeta de sección: evita anidar Papers sin una razón funcional. */
export default function SectionCard({ title, subtitle, action, children, sx, contentSx }: Props) {
  return (
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, ...sx }}>
      {(title || action) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
            mb: 2,
          }}
        >
          <Box>
            {title && (
              <Typography variant="h3" component="h2">
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Box>
      )}
      <Box sx={contentSx}>{children}</Box>
    </Paper>
  );
}
