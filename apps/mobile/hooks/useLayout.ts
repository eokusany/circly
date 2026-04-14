import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing } from '../constants/theme'

/**
 * Returns layout values that account for the device's safe area insets.
 * Prefer this over the static `layout.screenTopPadding` constant, which
 * uses a hardcoded 60pt and doesn't adapt to Dynamic Island or smaller notches.
 */
export function useLayout() {
  const insets = useSafeAreaInsets()
  return {
    screenTopPadding: insets.top + spacing.md,
    screenBottomPadding: Math.max(insets.bottom, spacing.md),
  }
}
