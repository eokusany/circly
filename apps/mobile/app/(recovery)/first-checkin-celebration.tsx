import { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { spacing, radii, type, layout } from '../../constants/theme'

/**
 * Spec §4.3 — celebratory screen after the first-ever check-in submit.
 * Shown exactly once, gated by profiles.first_checkin_celebration_seen.
 */
export default function FirstCheckinCelebrationScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [advancing, setAdvancing] = useState(false)

  async function handleContinue() {
    if (!user || advancing) return
    setAdvancing(true)
    await supabase
      .from('profiles')
      .update({ first_checkin_celebration_seen: true })
      .eq('user_id', user.id)
    setUser({ ...user, firstCheckinCelebrationSeen: true })
    router.replace('/(recovery)')
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          day one. you showed up.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="continue"
        onPress={handleContinue}
        disabled={advancing}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.accent,
            opacity: advancing ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={styles.buttonText}>{advancing ? '...' : 'continue'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.display, textAlign: 'center' },
  button: {
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
