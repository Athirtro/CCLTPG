/**
 * Tokens de identidad visual de CCLTPG.
 * El azul profundo domina; el terracota se reserva para acentos puntuales.
 */
export const tokens = {
  primary: { main: '#1F3A5F', dark: '#152A45', light: '#E6EEF7' },
  secondary: { main: '#C8754D', light: '#F8EAE3' },
  accent: '#D7A64A',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  textPrimary: '#202B38',
  textSecondary: '#64748B',
  divider: '#E3E8EF',
  success: '#2E7D5B',
  warning: '#B7791F',
  error: '#B54747',
  info: '#3178A5',
} as const;

/** Fondo claro + texto oscuro: contraste AA sin depender de colores de MUI. */
export const statusTones = {
  neutral: { bg: '#EEF2F6', text: '#475569' },
  success: { bg: '#E7F3ED', text: '#1E5B42' },
  warning: { bg: '#FBF2DF', text: '#6B440A' },
  error: { bg: '#FBECEC', text: '#8A2E2E' },
  info: { bg: '#E7F1F7', text: '#205A7E' },
  primary: { bg: tokens.primary.light, text: tokens.primary.main },
  secondary: { bg: tokens.secondary.light, text: '#7A3F21' },
} as const;

export type StatusTone = keyof typeof statusTones;
