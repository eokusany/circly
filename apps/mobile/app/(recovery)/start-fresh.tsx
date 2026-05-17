import { useState } from 'react'
import { Text, StyleSheet, Pressable, Alert, View } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { toISODate } from '../../lib/streak'
import { tapMedium, notifySuccess } from '../../lib/haptics'
import { spacing, radii, type } from '../../constants/theme'

export default function StartFreshScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [submitting, setSubmitting] = useState(false)

  if (!user || user.context !== 'recovery') {
    setTimeout(() => router.replace('/(recovery)'), 0)
    return null
  }

  async function handleConfirm() {
    if (!user) return
    setSubmitting(true)
    const todayISO = toISODate(new Date())
    const previousISO = user.sobrietyStartDate

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        sobriety_start_date: todayISO,
        last_milestone_celebrated_days: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (profileErr) {
      setSubmitting(false)
      Alert.alert('something went wrong', profileErr.message)
      return
    }

    await supabase.from('sobriety_resets').insert({
      user_id: user.id,
      previous_start_date: previousISO,
    })

    setUser({
      ...user,
      sobrietyStartDate: todayISO,
      lastMilestoneCelebratedDays: 0,
    })
    setSubmitting(false)
    notifySuccess()
    router.replace('/(recovery)')
  }

  return (
    <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={() => router.replace('/(recovery)')}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            today is day one again.
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            that took courage.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="reset to today"
            disabled={submitting}
            onPress={() => {
              tapMedium()
              handleConfirm()
            }}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: colors.warning,
                opacity: submitting ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.primaryText}>
              {submitting ? 'resetting...' : 'reset to today'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="cancel"
            onPress={() => router.replace('/(recovery)')}
            style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  title: { ...type.h2 },
  body: { ...type.body },
  primary: {
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { ...type.body },
})
