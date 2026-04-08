// Design tokens. Import from here instead of hardcoding numbers in StyleSheets.
// Scale is 4px-based to avoid pixel drift (no more 13px / 28px magic numbers).

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const

export const type = {
  // Display — screen/hero numbers
  display: { fontSize: 56, fontWeight: '700' as const, letterSpacing: -1.5, lineHeight: 60 },
  // Titles
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.6, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 28 },
  h3: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.1, lineHeight: 22 },
  // Body
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  smallStrong: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  // Labels / overline
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    lineHeight: 14,
  },
} as const

export const layout = {
  screenPadding: spacing.xl,
  screenTopPadding: 60,
  sectionGap: spacing.xxl,
  contentGap: spacing.lg,
} as const
