import { useEffect, useMemo } from 'react'
import { Modal, View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useColors } from '../hooks/useColors'
import { spacing, radii, type } from '../constants/theme'

export function MilestoneTakeover({
  visible,
  label,
  onContinue,
}: {
  visible: boolean
  label: string
  onContinue: () => void
}) {
  const colors = useColors()
  const fade = useMemo(() => new Animated.Value(0), [])

  useEffect(() => {
    if (visible) {
      fade.setValue(0)
      Animated.timing(fade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, fade])

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onContinue}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Animated.View style={[styles.center, { opacity: fade }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
          <Text style={[styles.affirm, { color: colors.textSecondary }]}>
            you did this.
          </Text>
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="continue"
          onPress={onContinue}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.buttonText}>continue</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  label: {
    ...type.display,
    textAlign: 'center',
  },
  affirm: {
    ...type.h3,
    textAlign: 'center',
  },
  button: {
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
