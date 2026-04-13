// Palette — warm, grounded, recovery-first.
// Intentionally NOT a monochromatic purple ramp:
// - background/surfaces are warm neutral (charcoal / cream), not purple-tinted
// - primary accent is honey amber — evokes warmth and growth
// - success is sage — used for reached milestones to read distinctly from CTA
// - purple kept as a tertiary/informational accent, not dominant

export const Colors = {
  light: {
    background: '#FBF9F4',       // warm cream
    surface: '#FFFFFF',
    surfaceRaised: '#F3EFE6',    // sand
    surfaceSunken: '#F0ECE2',

    textPrimary: '#1C1A17',      // warm near-black
    textSecondary: '#6B665C',    // warm gray
    textMuted: '#A39E92',        // for disabled / far-future states

    accent: '#C58A3F',            // honey amber — primary CTA
    accentSoft: '#F5E9D4',       // tinted fill (8% feel)
    accentPressed: '#A9721F',

    success: '#5C9E7A',          // sage — reached milestones
    successSoft: '#E2EFE6',
    warning: '#D6923A',
    warningSoft: '#F5EBD8',
    danger: '#C65D52',
    dangerSoft: '#F5E0DD',

    border: '#E8E2D4',           // warm low-contrast divider
    borderStrong: '#D6CFBE',
    overlay: 'rgba(28,26,23,0.4)',
  },
  dark: {
    background: '#12110F',       // warm charcoal, not purple
    surface: '#1B1A17',
    surfaceRaised: '#242220',
    surfaceSunken: '#0E0D0B',

    textPrimary: '#F4F1EA',      // warm off-white
    textSecondary: '#9A958A',    // warm gray
    textMuted: '#5E5B53',

    accent: '#D9A766',            // honey amber, slightly lifted for dark
    accentSoft: '#2E261A',       // deep amber tint
    accentPressed: '#B4833F',

    success: '#7DB896',          // sage
    successSoft: '#1F2A24',
    warning: '#E0A558',
    warningSoft: '#2A231A',
    danger: '#D9736A',
    dangerSoft: '#2B1B19',

    border: '#2A2825',
    borderStrong: '#3A3733',
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const

export type ColorScheme = keyof typeof Colors
export type ColorToken = keyof typeof Colors.light
