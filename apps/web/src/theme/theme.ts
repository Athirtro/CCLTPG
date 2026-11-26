import { createTheme } from '@mui/material/styles';
import { components } from './components';
import { tokens } from './palette';
import { typography } from './typography';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { ...tokens.primary, contrastText: '#FFFFFF' },
    secondary: { ...tokens.secondary, contrastText: '#241208' },
    background: { default: tokens.background, paper: tokens.surface },
    text: { primary: tokens.textPrimary, secondary: tokens.textSecondary },
    divider: tokens.divider,
    success: { main: tokens.success, contrastText: '#FFFFFF' },
    warning: { main: tokens.warning, contrastText: '#241704' },
    error: { main: tokens.error, contrastText: '#FFFFFF' },
    info: { main: tokens.info, contrastText: '#FFFFFF' },
  },
  shape: { borderRadius: 10 },
  typography,
  components,
});

export { tokens, statusTones } from './palette';
export type { StatusTone } from './palette';
