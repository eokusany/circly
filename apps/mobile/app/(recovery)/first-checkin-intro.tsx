import { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { spacing, radii, type, layout } from '../../constants/theme'

/**
 * Spec §4.1 — first-check-in intro. Shown exactly once, gated by
 * profiles.first_checkin_intro_seen. The flag is flipped on tap of "begin"
 * before routing to the standard check-in screen so the user never sees
 * this intro twice.
 */
export default function FirstCheckinIntroScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [advancing, setAdvancing] = useState(false)

  async function handleBegin() {
    if (!user || advancing) return
    setAdvancing(true)
    await supabase
      .from('profiles')
      .update({ first_checkin_intro_seen: true })
      .eq('user_id', user.id)
    setUser({ ...user, firstCheckinIntroSeen: true })
    router.replace('/(recovery)/check-in')
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          this is your daily check-in.
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          one minute, every day. that&apos;s the whole thing.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="begin"
        onPress={handleBegin}
        disabled={advancing}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.accent,
            opacity: advancing ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={styles.buttonText}>{advancing ? '...' : 'begin'}</Text>
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
    gap: spacing.md,
  },
  title: { ...type.h1, textAlign: 'center' },
  sub: { ...type.body, textAlign: 'center' },
  button: {
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
