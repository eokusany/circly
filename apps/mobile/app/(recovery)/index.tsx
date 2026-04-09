import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { api, ApiError } from '../../lib/api'
import { spacing, radii, type, layout } from '../../constants/theme'
import {
  MILESTONES,
  nextMilestone,
  streakDays,
  toISODate,
  type Milestone,
} from '../../lib/streak'
import { useCopy } from '../../lib/copy'

type CheckInStatus = 'sober' | 'struggling' | 'good_day'

export default function RecoveryHome() {
  const colors = useColors()
  const copy = useCopy()
  const { user } = useAuthStore()
  const [todayStatus, setTodayStatus] = useState<CheckInStatus | null>(null)
  const [sendingEmergency, setSendingEmergency] = useState(false)

  async function handleGetSupport() {
    Alert.alert(
      'alert your supporters',
      'this will notify all your supporters right now. continue?',
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'yes, alert them',
          style: 'destructive',
          onPress: async () => {
            setSendingEmergency(true)
            try {
              const result = await api<{ supporters_notified: number }>(
                '/api/emergency',
                { method: 'POST' },
              )
              if (result.supporters_notified === 0) {
                Alert.alert(
                  'no supporters yet',
                  'add someone to your circle so they can be there for you.',
                )
              } else {
                Alert.alert(
                  'your supporters have been notified',
                  `${result.supporters_notified} ${
                    result.supporters_notified === 1 ? 'person has' : 'people have'
                  } been alerted.`,
                )
              }
            } catch (err) {
              const message =
                err instanceof ApiError
                  ? 'something went wrong. please try again.'
                  : 'check your connection and try again.'
              Alert.alert('could not send alert', message)
            } finally {
              setSendingEmergency(false)
            }
          },
        },
      ],
    )
  }

  const days = user?.sobrietyStartDate ? streakDays(user.sobrietyStartDate) : 0
  const next = nextMilestone(days)

  const loadTodayCheckIn = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('check_ins')
      .select('status')
      .eq('user_id', user.id)
      .eq('check_in_date', toISODate(new Date()))
      .maybeSingle<{ status: CheckInStatus }>()
    setTodayStatus(data?.status ?? null)
  }, [user])

  useFocusEffect(
    useCallback(() => {
      loadTodayCheckIn()
    }, [loadTodayCheckIn])
  )

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            {getGreeting()}
          </Text>
          <Text style={[styles.name, { color: colors.textPrimary }]}>
            {user?.displayName ?? 'friend'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/(profile)')}
          style={({ pressed }) => [
            styles.profileButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel="profile"
        >
          <Text style={[styles.profileIcon, { color: colors.textPrimary }]}>
            {(user?.displayName ?? '?').trim().charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <StreakCard days={days} next={next} streakLabel={copy.dashboard.streakLabel} />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          milestones
        </Text>
        <MilestonePath days={days} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>today</Text>
        <View style={styles.tiles}>
          <CheckInTile status={todayStatus} />
          <ActionTile
            label={copy.dashboard.journalLabel}
            description={copy.dashboard.journalDescription}
            onPress={() => router.push('/(recovery)/journal')}
          />
          <ActionTile
            label={copy.dashboard.getSupportLabel}
            description={copy.dashboard.getSupportDescription}
            danger
            loading={sendingEmergency}
            onPress={handleGetSupport}
          />
        </View>
      </View>

    </ScrollView>
  )
}

// ─── streak card ────────────────────────────────────────────────────────
// Surface-based card (no full-bleed accent slab). Inline progress bar
// gives visual meaning to "X days until Y", and the accent is used
// sparingly on the numeral and progress fill rather than the whole card.

function StreakCard({
  days,
  next,
  streakLabel,
}: {
  days: number
  next: Milestone | null
  streakLabel: string
}) {
  const colors = useColors()

  // progress within the *current* milestone segment
  const prevDays = prevMilestoneDays(days)
  const targetDays = next?.days ?? days
  const range = Math.max(targetDays - prevDays, 1)
  const progress = next ? Math.min((days - prevDays) / range, 1) : 1

  return (
    <View
      style={[
        styles.streakCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.streakLabel, { color: colors.textMuted }]}>
        {streakLabel}
      </Text>

      <View style={styles.streakNumberRow}>
        <Text style={[styles.streakNumber, { color: colors.accent }]}>{days}</Text>
        <Text style={[styles.streakUnit, { color: colors.textSecondary }]}>
          {days === 1 ? 'day' : 'days'}
        </Text>
      </View>

      {next ? (
        <View style={styles.progressWrap}>
          <View
            style={[styles.progressTrack, { backgroundColor: colors.surfaceRaised }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.accent,
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
            {next.days - days} {next.days - days === 1 ? 'day' : 'days'} until{' '}
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {next.label}
            </Text>
          </Text>
        </View>
      ) : (
        <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
          every milestone reached. incredible.
        </Text>
      )}
    </View>
  )
}

function prevMilestoneDays(days: number): number {
  let prev = 0
  for (const m of MILESTONES) {
    if (days < m.days) return prev
    prev = m.days
  }
  return prev
}

// ─── milestone path ─────────────────────────────────────────────────────
// Horizontal "path" of connected circles. Each milestone shows one state:
//   reached  → filled sage circle (milestone earned)
//   current  → ringed amber circle with dot (you are here)
//   future   → outlined muted circle
// Labels live underneath as a single line — no more "1d / 1 day" redundancy.

function MilestonePath({ days }: { days: number }) {
  const colors = useColors()
  const currentIdx = firstUnreachedIndex(days)

  return (
    <View style={styles.path}>
      {MILESTONES.map((m, i) => {
        const reached = days >= m.days
        const isCurrent = !reached && i === currentIdx
        const prevConnectorReached = reached
        const nextConnectorReached = days >= (MILESTONES[i + 1]?.days ?? Infinity)

        return (
          <View key={m.type} style={styles.pathItem}>
            <View style={styles.pathRow}>
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor:
                      i === 0
                        ? 'transparent'
                        : prevConnectorReached
                        ? colors.success
                        : colors.border,
                  },
                ]}
              />
              <MilestoneNode reached={reached} isCurrent={isCurrent} />
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor:
                      i === MILESTONES.length - 1
                        ? 'transparent'
                        : nextConnectorReached
                        ? colors.success
                        : colors.border,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.pathLabel,
                {
                  color: reached
                    ? colors.textPrimary
                    : isCurrent
                    ? colors.accent
                    : colors.textMuted,
                  fontWeight: reached || isCurrent ? '600' : '500',
                },
              ]}
            >
              {m.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

function firstUnreachedIndex(days: number): number {
  const i = MILESTONES.findIndex((m) => days < m.days)
  return i === -1 ? MILESTONES.length : i
}

function MilestoneNode({ reached, isCurrent }: { reached: boolean; isCurrent: boolean }) {
  const colors = useColors()

  if (reached) {
    return (
      <View style={[styles.node, { backgroundColor: colors.success }]}>
        <Text style={styles.nodeCheck}>✓</Text>
      </View>
    )
  }

  if (isCurrent) {
    return (
      <View
        style={[
          styles.node,
          {
            backgroundColor: colors.accentSoft,
            borderWidth: 2,
            borderColor: colors.accent,
          },
        ]}
      >
        <View style={[styles.nodeDot, { backgroundColor: colors.accent }]} />
      </View>
    )
  }

  return (
    <View
      style={[
        styles.node,
        {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.border,
        },
      ]}
    />
  )
}

// ─── tiles ──────────────────────────────────────────────────────────────

function CheckInTile({ status }: { status: CheckInStatus | null }) {
  const colors = useColors()
  const copy = useCopy()
  const checkedIn = status !== null
  const meta = status ? copy.dashboard.checkInStatuses[status] : null

  return (
    <Pressable
      onPress={() => router.push('/(recovery)/check-in')}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: checkedIn ? colors.accentSoft : colors.surface,
          borderColor: checkedIn ? colors.accent : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.tileHeader}>
        <Text style={[styles.tileLabel, { color: colors.textPrimary }]}>
          {checkedIn ? 'checked in' : 'check in'}
        </Text>
        {checkedIn && meta && <Text style={styles.tileEmoji}>{meta.emoji}</Text>}
      </View>
      <Text style={[styles.tileDescription, { color: colors.textSecondary }]}>
        {checkedIn && meta
          ? `today: ${meta.label} · tap to edit`
          : copy.dashboard.checkInPrompt}
      </Text>
    </Pressable>
  )
}

function ActionTile({
  label,
  description,
  disabled,
  danger,
  loading,
  onPress,
}: {
  label: string
  description: string
  disabled?: boolean
  danger?: boolean
  loading?: boolean
  onPress?: () => void
}) {
  const colors = useColors()
  const inactive = disabled || loading
  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: danger ? colors.danger : colors.border,
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.tileLabel,
          { color: danger ? colors.danger : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
      <Text style={[styles.tileDescription, { color: colors.textSecondary }]}>
        {loading ? 'sending...' : description}
      </Text>
      {disabled && !loading && (
        <Text style={[styles.tileSoon, { color: colors.textMuted }]}>coming soon</Text>
      )}
    </Pressable>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'late night'
  if (h < 12) return 'good morning'
  if (h < 17) return 'good afternoon'
  if (h < 21) return 'good evening'
  return 'good night'
}

const NODE = 36

const styles = StyleSheet.create({
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: spacing.xs },
  greeting: { ...type.body },
  name: { ...type.h1 },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIcon: {
    fontSize: 17,
    fontWeight: '600',
  },

  // streak card
  streakCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  streakLabel: { ...type.label },
  streakNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  streakNumber: { ...type.display },
  streakUnit: { fontSize: 18, fontWeight: '500' },
  progressWrap: { gap: spacing.sm, marginTop: spacing.xs },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  progressCaption: { ...type.small },

  // sections
  section: { gap: spacing.lg },
  sectionTitle: { ...type.label },

  // milestone path
  path: { flexDirection: 'row', alignItems: 'flex-start' },
  pathItem: { flex: 1, alignItems: 'center', gap: spacing.sm },
  pathRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  connector: { flex: 1, height: 2 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCheck: { color: '#fff', fontSize: 16, fontWeight: '700' },
  nodeDot: { width: 8, height: 8, borderRadius: 4 },
  pathLabel: {
    fontSize: 11,
    letterSpacing: 0.1,
  },

  // tiles
  tiles: { gap: spacing.md },
  tile: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileEmoji: { fontSize: 20 },
  tileLabel: { ...type.h3 },
  tileDescription: { ...type.small },
  tileSoon: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },

})
