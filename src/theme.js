// ─── Dark Neon Glassmorphic Design System ─────────────────────────────
export const COLORS = {
  bg: '#0a0a1a',
  bgCard: '#12122a',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.12)',
  primary: '#00e5ff',
  primaryDim: 'rgba(0,229,255,0.15)',
  secondary: '#7c4dff',
  secondaryDim: 'rgba(124,77,255,0.15)',
  success: '#00e676',
  successDim: 'rgba(0,230,118,0.15)',
  danger: '#ff1744',
  dangerDim: 'rgba(255,23,68,0.15)',
  warning: '#ffab00',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.35)',
  tabBar: 'rgba(10,10,26,0.92)',
  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: 'rgba(255,255,255,0.1)',
};

export const GRADIENTS = {
  primary: ['#00e5ff', '#7c4dff'],
  card: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'],
  success: ['#00e676', '#00bfa5'],
  danger: ['#ff1744', '#d50000'],
  bg: ['#0a0a1a', '#12122a', '#0a0a1a'],
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
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
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    hero: 36,
  },
};

export const SHADOWS = {
  glow: (color = COLORS.primary) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  }),
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
};
