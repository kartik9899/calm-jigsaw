// Spacing scale (4-pt grid)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// Type scale (sp)
export const typeScale = {
  caption: 11,
  label: 13,
  body: 15,
  subheading: 17,
  heading: 22,
  display: 32,
} as const;

// One muted accent: slate-blue
const palette = {
  sand50: '#FAF9F7',
  sand100: '#F0EDE7',
  sand200: '#E0D9D0',
  sand300: '#C8BFB4',
  sand400: '#A89E94',
  sand700: '#5C5247',
  sand900: '#1C1714',
  accent: '#6B7FA0', // muted slate-blue
  accentLight: '#8B9FC0',
  accentDark: '#4B5F80',
  white: '#FFFFFF',
} as const;

export const lightColors = {
  background: palette.sand50,
  surface: palette.white,
  surfaceRaised: palette.sand100,
  border: palette.sand200,
  textPrimary: palette.sand900,
  textSecondary: palette.sand700,
  textTertiary: palette.sand400,
  accent: palette.accent,
  accentForeground: palette.white,
} as const;

export const darkColors = {
  background: palette.sand900,
  surface: '#2A2320',
  surfaceRaised: '#352F2A',
  border: palette.sand700,
  textPrimary: palette.sand100,
  textSecondary: palette.sand300,
  textTertiary: palette.sand400,
  accent: palette.accentLight,
  accentForeground: palette.white,
} as const;

export type Colors = typeof lightColors;

export const theme = {
  spacing,
  typeScale,
  light: lightColors,
  dark: darkColors,
} as const;
