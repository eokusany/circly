import { useMemo, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { tapMedium, notifySuccess } from '../lib/haptics'
import { spacing, radii, type as t } from '../constants/theme'

interface Props {
  tapped: boolean
  onTap: () => void
  prompt: string
  doneMessage: string
}

export function OkayTapCard({ tapped, onTap, prompt, doneMessage }: Props) {
  const colors = useColors()
  const scale = useMemo(() => new Animated.Value(1), [])

  useEffect(() => {
    if (tapped) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.05, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      ]).start()
    }
  }, [tapped, scale])

  function handlePress() {
    if (tapped) return
    tapMedium()
    onTap()
    notifySuccess()
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        disabled={tapped}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: tapped ? colors.successSoft : colors.accentSoft,
            borderColor: tapped ? colors.success : colors.accent,
            opacity: pressed && !tapped ? 0.85 : 1,
          },
        ]}
        accessibilityLabel={tapped ? doneMessage : prompt}
        accessibilityRole="button"
      >
        <View style={styles.iconCircle}>
          <Icon
            name={tapped ? 'check' : 'heart'}
            size={28}
            color={tapped ? colors.success : colors.accent}
          />
        </View>
        <Text
          style={[
            styles.label,
            { color: tapped ? colors.success : colors.accent },
          ]}
        >
          {tapped ? doneMessage : prompt}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...t.h3,
    textAlign: 'center',
  },
})
