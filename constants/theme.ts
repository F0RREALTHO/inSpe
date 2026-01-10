/**
 * Updated to match the Obsidian Plum Theme 🟣
 */

import { Platform } from 'react-native';

const tintColorLight = '#3A1C71'; // Deep Purple
const tintColorDark = '#D76D77';  // Neon Pink

export const Colors = {
  light: {
    text: '#1C1C1E',
    background: '#F2F2F7',
    tint: tintColorLight,
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#FFFFFF',
    background: '#150C25', // ✅ Obsidian Dark BG
    tint: tintColorDark,
    icon: '#9F8DA5',
    tabIconDefault: '#9F8DA5',
    tabIconSelected: tintColorDark,
  },
};

// ✅ YES, this controls your Font Families
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal', // You can change this to 'Roboto' or 'Inter' if loaded
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});