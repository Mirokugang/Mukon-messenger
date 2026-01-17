import { MD3DarkTheme as DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6366F1', // Indigo - actions, links
    secondary: '#22C55E', // Green - success, online status
    background: '#0D0D0D', // Near black
    surface: '#1A1A1A', // Cards, inputs
    textPrimary: '#FFFFFF',
    textSecondary: '#9CA3AF', // Gray-400
    accent: '#F59E0B', // Amber - notifications, warnings
    error: '#EF4444',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onBackground: '#FFFFFF',
    onSurface: '#FFFFFF',
  },
  roundness: 8,
};

export type Theme = typeof theme;
