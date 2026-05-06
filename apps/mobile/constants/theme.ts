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

// Casing rules:
// - type.label  → UPPERCASE for tier indicators ("DAYS SOBER", "TODAY'S CHECK-IN")
// - type.body / type.bodyStrong → sentence case for sentences and content
// - lowercase reserved for brand voice (wordmark "circly", supportive whispers)
// Do not mix these arbitrarily within a single screen.

// Hero-scale display number. Existing display (56pt) is not heroic enough.
// Falls back to type.display when days >= 1000 (see StreakCard).
export const displayHero = {
  fontSize: 96,
  fontWeight: '700' as const,
  letterSpacing: -3,
  lineHeight: 92,
} as const

// Elevation tiers.
// Tier 1 (elevation.card): gradient surface + thin border. No shadow. Used on standard cards.
// Tier 2 (elevation.hero): warm amber halo + warmer gradient surface. Hero card and SOS active state.
// Tier 3 (elevation.pressed): reduced halo applied during touch feedback on hero-tier surfaces.
export const elevation = {
  card: {
    borderWidth: 1,
    borderColor: '#2A2825',       // Colors.dark.border — hardcoded to avoid circular import
  },
  hero: {
    shadowColor: '#D9A766',       // Colors.dark.accent
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,                 // Android (no color on Android — renders as gray drop shadow)
    borderWidth: 1,
    borderColor: 'rgba(217,167,102,0.18)',
  },
  pressed: {
    shadowColor: '#D9A766',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const

// SOS button visual tokens — single source of truth for CenterSOSButton.
export const sos = {
  gradientStart: '#D9736A',
  gradientEnd: '#A93A30',           // danger darkened ~20% for gradient depth
  haloRing: 'rgba(217,115,106,0.12)',
  haloShadowColor: 'rgba(217,115,106,0.35)',
  haloShadowRadius: 24,
  haloShadowOffsetY: 8,
} as const
