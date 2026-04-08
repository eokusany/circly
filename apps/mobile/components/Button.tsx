import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native'
import { useColors } from '../hooks/useColors'
import { radii, spacing } from '../constants/theme'

interface Props {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'ghost'
  style?: ViewStyle
}

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: Props) {
  const colors = useColors()
  const isPrimary = variant === 'primary'
  const isInactive = loading || disabled

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      style={({ pressed }) => [
        styles.base,
        isPrimary
          ? {
              backgroundColor: pressed ? colors.accentPressed : colors.accent,
            }
          : {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: colors.border,
            },
        isInactive && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.accent} />
      ) : (
        <Text
          style={[
            styles.label,
            { color: isPrimary ? '#fff' : colors.textPrimary },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
})
