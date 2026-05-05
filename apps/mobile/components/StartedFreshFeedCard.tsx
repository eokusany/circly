import { Text, StyleSheet, Pressable } from 'react-native'
import { useColors } from '../hooks/useColors'
import { spacing, radii, type } from '../constants/theme'

export function StartedFreshFeedCard({
  name,
  onPress,
}: {
  name: string
  onPress: () => void
}) {
  const colors = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} started fresh today. tap to send encouragement.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.warning,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.body, { color: colors.textPrimary }]}>
        {name} started fresh today
      </Text>
      <Text style={[styles.cta, { color: colors.warning }]}>
        send encouragement
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderLeftWidth: 4,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  body: { ...type.body, fontWeight: '600' },
  cta: { ...type.small, fontWeight: '600' },
})
