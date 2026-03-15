// ─── Responsive & Mobile UI Helpers ─────────────────────────────────────
// Safe areas, touch targets, and responsive scaling

import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Reference: 375 is typical iPhone width
const BASE_WIDTH = 375;

/** Scale value proportionally to screen width */
export const scale = (size) => {
    const scaleFactor = Math.min(SCREEN_WIDTH / BASE_WIDTH, 1.5);
    return Math.round(size * scaleFactor);
};

export const rs = scale;

/** Minimum touch target size (Material: 48dp, Apple: 44pt) */
export const MIN_TOUCH_TARGET = Platform.OS === 'ios' ? 44 : 48;

/** Tab bar height + extra for safe scroll */
export const TAB_BAR_EXTRA_PADDING = 100;

/** Responsive horizontal padding */
export const horizontalPadding = () => Math.max(16, Math.min(SCREEN_WIDTH * 0.05, 24));

export { SCREEN_WIDTH, SCREEN_HEIGHT };
