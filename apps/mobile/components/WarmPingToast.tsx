import { useEffect, useMemo } from 'react'
import { Text, StyleSheet, Animated } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { notifySuccess } from '../lib/haptics'
import { spacing, radii, type } from '../constants/theme'

interface WarmPingToastProps {
  senderName: string | null
  onDismiss: () => void
}

export function WarmPingToast({ senderName, onDismiss }: WarmPingToastProps) {
  const colors = useColors()
  const opacity = useMemo(() => new Animated.Value(0), [])
  const translateY = useMemo(() => new Animated.Value(-20), [])

  useEffect(() => {
    if (!senderName) return

    notifySuccess()

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start()

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 400, useNativeDriver: true }),
      ]).start(() => onDismiss())
    }, 3000)

    return () => clearTimeout(timer)
  }, [senderName, opacity, translateY, onDismiss])

  if (!senderName) return null

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.accentSoft,
          borderColor: colors.accent,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Icon name="heart" size={20} color={colors.accent} />
      <Text style={[styles.text, { color: colors.textPrimary }]}>
        {senderName} is with you.
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 100,
  },
  text: {
    ...type.body,
    fontWeight: '600',
    flex: 1,
  },
})
