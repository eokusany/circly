import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { streakDays, type MilestoneType } from '../../lib/streak'
import { spacing, radii, type, layout } from '../../constants/theme'

interface ConnectedPerson {
  display_name: string
  sobriety_start_date: string | null
  today_status: string | null
  latest_milestone: MilestoneType | null
}

/**
 * Spec §5.1 — first-run intro for supporters who arrived via an invite
 * code (so they already have one connection). Two-screen flow:
 *   step 1: "[name] invited you. here's what they've been working on."
 *   step 2: rich first-time view with avatar / streak / mood / milestone.
 *
 * Dismisses by setting profiles.supporter_first_run_seen=true and
 * routing to the standard supporter feed.
 */
export default function FirstRunConnectedScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [step, setStep] = useState<1 | 2>(1)
  const [person, setPerson] = useState<ConnectedPerson | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase
        .from('relationships')
        .select(
          'recovery_user_id, users:recovery_user_id(display_name, profiles(sobriety_start_date))',
        )
        .eq('supporter_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle<{
          recovery_user_id: string
          users: {
            display_name: string
            profiles: { sobriety_start_date: string | null } | null
          } | null
        }>()
      if (!data) {
        // No connection — fall through to cold path.
        router.replace('/(supporter)/first-run-cold')
        return
      }
      // Best-effort: fetch latest milestone + today's status.
      const [todayRes, msRes] = await Promise.all([
        supabase
          .from('check_ins')
          .select('status')
          .eq('user_id', data.recovery_user_id)
          .order('check_in_date', { ascending: false })
          .limit(1)
          .maybeSingle<{ status: string }>(),
        supabase
          .from('milestones')
          .select('type')
          .eq('user_id', data.recovery_user_id)
          .order('achieved_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ type: MilestoneType }>(),
      ])
      setPerson({
        display_name: data.users?.display_name ?? 'someone',
        sobriety_start_date: data.users?.profiles?.sobriety_start_date ?? null,
        today_status: todayRes.data?.status ?? null,
        latest_milestone: msRes.data?.type ?? null,
      })
      setLoading(false)
    })()
  }, [user])

  async function dismiss() {
    if (!user) return
    await supabase
      .from('profiles')
      .update({ supporter_first_run_seen: true })
      .eq('user_id', user.id)
    setUser({ ...user, supporterFirstRunSeen: true })
    router.replace('/(supporter)')
  }

  if (loading || !person) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (step === 1) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {person.display_name} invited you.
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            here&apos;s what they&apos;ve been working on.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="see their journey"
          onPress={() => setStep(2)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.buttonText}>see their journey</Text>
        </Pressable>
      </View>
    )
  }

  const days = person.sobriety_start_date
    ? streakDays(person.sobriety_start_date)
    : null

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.avatarText, { color: colors.accent }]}>
            {person.display_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {person.display_name}
        </Text>
        {days !== null && (
          <Text style={[styles.streak, { color: colors.accent }]}>
            {days} {days === 1 ? 'day' : 'days'}
          </Text>
        )}
        {person.today_status && (
          <Text style={[styles.line, { color: colors.textSecondary }]}>
            today: {person.today_status}
          </Text>
        )}
        {person.latest_milestone && (
          <Text style={[styles.line, { color: colors.textSecondary }]}>
            latest milestone: {person.latest_milestone}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="go to feed"
        onPress={dismiss}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.buttonText}>go to feed →</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '700' },
  name: { ...type.h2 },
  streak: { ...type.h3, fontWeight: '700' },
  line: { ...type.body },
  button: {
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
