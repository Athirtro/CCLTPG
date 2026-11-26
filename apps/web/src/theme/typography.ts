import type { TypographyVariantsOptions } from '@mui/material/styles';

/** Inter si está disponible; en caso contrario se usan fuentes del sistema. */
export const typography: TypographyVariantsOptions = {
  fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 600,
  h1: { fontSize: '1.875rem', fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.02em' },
  h2: { fontSize: '1.375rem', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },
  h3: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.35 },
  h4: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
  h5: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.45 },
  h6: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.45 },
  subtitle1: { fontSize: '0.9375rem', fontWeight: 500, lineHeight: 1.5 },
  subtitle2: { fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.5 },
  body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.55 },
  caption: { fontSize: '0.75rem', lineHeight: 1.5 },
  overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em' },
  button: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
};
