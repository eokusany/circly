import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useColors } from '../hooks/useColors'
import { spacing, radii, type } from '../constants/theme'

export function MilestoneFeedCard({
  badge,
  body,
  cta,
  onPress,
}: {
  badge: string
  body: string
  cta?: string
  onPress?: () => void
}) {
  const colors = useColors()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.accentSoft, borderColor: colors.accent },
      ]}
      accessibilityLabel={`milestone: ${badge}`}
    >
      <View style={[styles.badgeWrap, { backgroundColor: colors.accent }]}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
      <Text style={[styles.body, { color: colors.textPrimary }]}>{body}</Text>
      {cta && onPress && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cta}
          onPress={onPress}
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.ctaText, { color: colors.accent }]}>{cta}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  body: { ...type.h3 },
  cta: { paddingTop: spacing.xs },
  ctaText: { ...type.smallStrong },
})
