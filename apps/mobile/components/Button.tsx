import { useMemo } from 'react'
import { Pressable, Text, StyleSheet, ActivityIndicator, Animated, ViewStyle } from 'react-native'
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
  const scale = useMemo(() => new Animated.Value(1), [])

  function handlePressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start()
  }

  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }).start()
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isInactive}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isInactive, busy: loading }}
        style={({ pressed }) => [
          styles.base,
          isPrimary
            ? {
                backgroundColor: pressed ? colors.accentPressed : colors.accent,
              }
            : {
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: pressed ? colors.borderStrong : colors.border,
              },
          isInactive && { opacity: 0.5 },
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
    </Animated.View>
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
