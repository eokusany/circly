import { Pressable, Text, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { spacing, type as t } from '../constants/theme'

interface Props {
  label?: string
  onPress?: () => void
}

export function BackButton({ label = 'back', onPress }: Props) {
  const colors = useColors()

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => [styles.container, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`Go ${label}`}
    >
      <Icon name="chevron-left" size={20} color={colors.accent} />
      <Text style={[styles.label, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  label: { ...t.bodyStrong },
})
