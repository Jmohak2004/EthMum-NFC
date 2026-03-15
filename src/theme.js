// ─── Tapout UI Design System (from globals.css) ─────────────────────────
// Extracted from tapout-ui-main: yellow accent, dark panels, Inter typography

export const COLORS = {
  // Accent (primary actions, highlights)
  yellow: '#F5C518',
  yellowLight: '#FFF3C4',
  yellowDark: '#D4A800',
  yellowDim: 'rgba(245,197,24,0.15)',

  // Dark palette (backgrounds)
  black: '#0A0A0A',
  darkPanel: '#111111',
  darkCard: '#1A1A1A',
  darkSurface: '#252525',
  darkBorder: '#2C2C2C',

  // Light surfaces (cards, inputs)
  white: '#FFFFFF',
  offWhite: '#F7F7F7',
  lightCard: '#F2F2F2',
  lightBorder: '#EBEBEB',

  // Text
  text: '#FFFFFF',
  textSecondary: '#9A9A9A',
  textMuted: '#555555',
  textDark: '#0A0A0A',
  textDarkSecondary: '#6B6B6B',

  // Semantic
  success: '#00C896',
  successDim: 'rgba(0,200,150,0.2)',
  danger: '#FF4444',
  dangerDim: 'rgba(255,68,68,0.15)',
  blue: '#007AFF',

  // Legacy mappings (for components using old keys)
  primary: '#F5C518',
  primaryDim: 'rgba(245,197,24,0.15)',
  secondary: '#D4A800',
  secondaryDim: 'rgba(212,168,0,0.15)',
  warning: '#D4A800',

  // UI
  bg: '#0A0A0A',
  bgCard: '#111111',
  glass: 'rgba(37,37,37,0.95)',
  glassBorder: '#2C2C2C',
  tabBar: 'rgba(17,17,17,0.95)',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.12)',
};

export const GRADIENTS = {
  primary: ['#F5C518', '#D4A800'],
  card: ['rgba(37,37,37,0.6)', 'rgba(26,26,26,0.8)'],
  success: ['#00C896', '#00A67E'],
  danger: ['#FF4444', '#CC3636'],
  bg: ['#0A0A0A', '#111111', '#0A0A0A'],
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const FONT = {
  light: { fontWeight: '300' },
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  size: {
    xs: 11,
    sm: 12,
    md: 13,
    lg: 15,
    xl: 17,
    xxl: 22,
    hero: 36,
  },
};

export const SHADOWS = {
  glow: (color = COLORS.yellow) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  }),
  yellowGlow: {
    shadowColor: '#F5C518',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
};
