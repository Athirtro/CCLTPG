import type { ReactNode } from 'react';
import { Avatar, Box, Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';

export type Breadcrumb = { label: string; to?: string };

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  sx?: SxProps<Theme>;
};

export default function PageHeader({
  title,
  description,
  icon,
  breadcrumbs,
  actions,
  sx,
}: Props) {
  return (
    <Box sx={{ mb: 3, ...sx }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs aria-label="Ruta de navegación" separator="›" sx={{ mb: 1.5, fontSize: '0.8125rem' }}>
          {breadcrumbs.map((crumb, index) => {
            const esUltimo = index === breadcrumbs.length - 1;
            return esUltimo || !crumb.to ? (
              <Typography key={`${crumb.label}-${index}`} color="text.primary" sx={{ fontSize: 'inherit' }}>
                {crumb.label}
              </Typography>
            ) : (
              <MuiLink
                key={`${crumb.label}-${index}`}
                component={RouterLink}
                to={crumb.to}
                color="inherit"
                underline="hover"
                sx={{ fontSize: 'inherit' }}
              >
                {crumb.label}
              </MuiLink>
            );
          })}
        </Breadcrumbs>
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          {icon && (
            <Avatar
              variant="rounded"
              sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 44, height: 44 }}
            >
              {icon}
            </Avatar>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" variant="h1" color="text.primary">
              {title}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
                {description}
              </Typography>
            )}
          </Box>
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {actions}
          </Box>
        )}
      </Box>
    </Box>
  );
}
