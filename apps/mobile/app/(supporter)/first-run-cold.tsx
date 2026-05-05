import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { spacing, radii, type, layout } from '../../constants/theme'

/**
 * Spec §5.2 — first-run for supporters with no connections (signed up
 * without an invite code). Three actions: enter a code, create one, or
 * skip. All three flip supporter_first_run_seen so the user lands on
 * the standard feed next time.
 */
export default function FirstRunColdScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  async function markSeen() {
    if (!user) return
    await supabase
      .from('profiles')
      .update({ supporter_first_run_seen: true })
      .eq('user_id', user.id)
    setUser({ ...user, supporterFirstRunSeen: true })
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.headerWrap}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          who are you here for?
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="i have an invite code"
          onPress={async () => {
            await markSeen()
            router.replace('/(auth)/invite-code')
          }}
          style={({ pressed }) => [
            styles.bigBtn,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.bigBtnText}>i have an invite code</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="i want to invite someone"
          onPress={async () => {
            await markSeen()
            router.replace('/(supporter)/invite')
          }}
          style={({ pressed }) => [
            styles.bigBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.accent,
              borderWidth: 1,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.bigBtnText, { color: colors.accent }]}>
            i want to invite someone
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="skip for now"
          onPress={async () => {
            await markSeen()
            router.replace('/(supporter)')
          }}
          style={({ pressed }) => [styles.skip, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.skipText, { color: colors.textMuted }]}>
            skip for now
          </Text>
        </Pressable>
      </View>
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
  headerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.h1, textAlign: 'center' },
  actions: { gap: spacing.lg },
  bigBtn: {
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skip: { alignItems: 'center', paddingVertical: spacing.md },
  skipText: { ...type.small },
})
