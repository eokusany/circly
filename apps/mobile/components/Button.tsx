import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native'
import { useColors } from '../hooks/useColors'

interface Props {
  label: string
  onPress: () => void
  loading?: boolean
  variant?: 'primary' | 'ghost'
  style?: ViewStyle
}

export function Button({ label, onPress, loading = false, variant = 'primary', style }: Props) {
  const colors = useColors()

  const isPrimary = variant === 'primary'

  return (
    <TouchableOpacity
      style={[
        styles.base,
        isPrimary
          ? { backgroundColor: colors.accent }
          : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
        style,
      ]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.accent} />
      ) : (
        <Text style={[styles.label, { color: isPrimary ? '#fff' : colors.textPrimary }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
