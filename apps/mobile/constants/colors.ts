export const Colors = {
  light: {
    background: '#F5F3F8',
    surface: '#FFFFFF',
    surfaceRaised: '#EFECF5',
    textPrimary: '#1A1625',
    textSecondary: '#6B6480',
    accent: '#7B5EA7',
    accentLight: '#9B8EC4',
    success: '#5CAF8A',
    warning: '#E8A44A',
    danger: '#D95F5F',
    border: '#E2DCF0',
  },
  dark: {
    background: '#16131E',
    surface: '#1F1A2E',
    surfaceRaised: '#2A2440',
    textPrimary: '#F0EDF8',
    textSecondary: '#9B93B4',
    accent: '#9B8EC4',
    accentLight: '#B8ADDA',
    success: '#6DC9A0',
    warning: '#F0B866',
    danger: '#F07070',
    border: '#2E2845',
  },
} as const

export type ColorScheme = keyof typeof Colors
export type ColorToken = keyof typeof Colors.light
