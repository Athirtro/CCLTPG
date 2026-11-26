import type { Components } from '@mui/material/styles';
import { tokens } from './palette';

/** Una sola fuente de estilos para todos los componentes de MUI. */
export const components: Components = {
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        backgroundColor: tokens.background,
        color: tokens.textPrimary,
        WebkitFontSmoothing: 'antialiased',
      },
    },
  },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        borderRadius: 8,
        minHeight: 36,
        paddingInline: 16,
        boxShadow: 'none',
        transition: 'background-color 150ms ease, border-color 150ms ease, transform 150ms ease',
        '&:active': { transform: 'translateY(1px)' },
        '&.MuiButton-containedPrimary:hover': { backgroundColor: tokens.primary.dark },
        '&.MuiButton-containedSecondary': {
          color: '#241208',
          '&:hover': { backgroundColor: '#B4623C' },
        },
        '&.MuiButton-outlined': { borderColor: tokens.divider },
        '&.MuiButton-sizeSmall': { minHeight: 30, paddingInline: 12 },
        '&.MuiButton-sizeLarge': { minHeight: 44, paddingInline: 20 },
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: { borderRadius: 8, transition: 'background-color 150ms ease' },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        border: `1px solid ${tokens.divider}`,
      },
      elevation1: { boxShadow: '0 1px 3px rgba(16, 24, 40, 0.06)' },
      elevation3: { boxShadow: '0 8px 24px rgba(16, 24, 40, 0.10)' },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        backgroundColor: tokens.surface,
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.primary.light },
      },
      notchedOutline: { borderColor: tokens.divider },
    },
  },
  MuiInputLabel: {
    styleOverrides: {
      root: { fontSize: '0.875rem', color: tokens.textSecondary },
    },
  },
  MuiTextField: {
    defaultProps: { size: 'small' },
  },
  MuiTableContainer: {
    styleOverrides: {
      root: { border: `1px solid ${tokens.divider}`, borderRadius: 10, overflowX: 'auto' },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        padding: '12px 16px',
        borderBottom: `1px solid ${tokens.divider}`,
        fontSize: '0.875rem',
      },
      head: {
        backgroundColor: '#F8FAFC',
        color: tokens.textSecondary,
        fontWeight: 600,
        fontSize: '0.75rem',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      },
      sizeSmall: { padding: '10px 14px' },
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        '&:last-child td': { borderBottom: 0 },
        '&:hover': { backgroundColor: '#F8FAFC' },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      root: {
        '& .MuiDialogTitle-root': { paddingBottom: 8 },
      },
      paper: { borderRadius: 12, border: `1px solid ${tokens.divider}` },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: 8, fontWeight: 600, fontSize: '0.75rem' },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        marginInline: 8,
        paddingInline: 12,
        minHeight: 40,
        transition: 'background-color 150ms ease, color 150ms ease',
        '&.Mui-selected': {
          backgroundColor: tokens.primary.light,
          color: tokens.primary.main,
          '& .MuiListItemIcon-root': { color: tokens.primary.main },
          '&:hover': { backgroundColor: '#D8E5F3' },
        },
      },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: { boxShadow: 'none', borderBottom: `1px solid ${tokens.divider}` },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: { backgroundColor: tokens.primary.dark, borderRadius: 6, fontSize: '0.75rem' },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: 8, alignItems: 'flex-start', fontSize: '0.875rem' },
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: { borderRadius: 999, height: 8, backgroundColor: tokens.primary.light },
      bar: { borderRadius: 999 },
    },
  },
  MuiLink: {
    styleOverrides: {
      root: {
        textDecorationColor: tokens.divider,
        '&:hover': { textDecorationColor: 'currentColor' },
      },
    },
  },
};
