import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, Animated } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { api, ApiError } from '../../lib/api'
import { Icon } from '../../components/Icon'
import { SkeletonCard } from '../../components/SkeletonCard'
import { ErrorState } from '../../components/ErrorState'
import { tapLight, tapMedium, notifyWarning, notifySuccess } from '../../lib/haptics'
import { spacing, radii, type, layout } from '../../constants/theme'
import {
  MILESTONES,
  nextMilestone,
  streakDays,
  toISODate,
  parseISODate,
  type Milestone,
} from '../../lib/streak'
import { useCopy } from '../../lib/copy'
import { OkayTapCard } from '../../components/OkayTapCard'

type CheckInStatus = 'sober' | 'struggling' | 'good_day'

interface WeeklyStats {
  checkIns: number
  journalEntries: number
}

export default function RecoveryHome() {
  const colors = useColors()
  const copy = useCopy()
  const user = useAuthStore((s) => s.user)
  const [todayStatus, setTodayStatus] = useState<CheckInStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const hasLoaded = useRef(false)
  const [sendingEmergency, setSendingEmergency] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [checkInStreak, setCheckInStreak] = useState(0)
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({ checkIns: 0, journalEntries: 0 })
  const [showCelebration, setShowCelebration] = useState(false)
  const [okayTapped, setOkayTapped] = useState(false)

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
            notifyWarning()
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

  const days = useMemo(
    () => user?.sobrietyStartDate ? streakDays(user.sobrietyStartDate) : 0,
    [user?.sobrietyStartDate],
  )
  const next = useMemo(() => nextMilestone(days), [days])

  const loadDashboard = useCallback(async () => {
    if (!user) return
    setError(false)
    if (!hasLoaded.current) setLoading(true)
    const today = new Date()
    const todayISO = toISODate(today)

    // Load all dashboard data in parallel
    let checkInRes, streakRes, weekCheckRes, weekJournalRes, okayTapRes
    try {
    ;[checkInRes, streakRes, weekCheckRes, weekJournalRes, okayTapRes] = await Promise.all([
      // Today's check-in
      supabase
        .from('check_ins')
        .select('status')
        .eq('user_id', user.id)
        .eq('check_in_date', todayISO)
        .maybeSingle<{ status: CheckInStatus }>(),
      // Recent check-ins for streak (last 30 days)
      supabase
        .from('check_ins')
        .select('check_in_date')
        .eq('user_id', user.id)
        .order('check_in_date', { ascending: false })
        .limit(30),
      // This week's check-ins count
      supabase
        .from('check_ins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('check_in_date', toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()))),
      // This week's journal entries count
      supabase
        .from('journal_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()).toISOString()),
      // Today's okay tap
      api<{ tapped: boolean }>('/api/okay-tap/today').catch(() => ({ tapped: false })),
    ])
    } catch {
      setError(true)
      setLoading(false)
      return
    }

    setTodayStatus(checkInRes.data?.status ?? null)

    // Calculate consecutive check-in days
    if (streakRes.data) {
      const dates = (streakRes.data as Array<{ check_in_date: string }>).map(r => r.check_in_date)
      let streak = 0
      const d = new Date(today)
      // If not checked in today, start from yesterday
      if (!dates.includes(todayISO)) d.setDate(d.getDate() - 1)
      while (dates.includes(toISODate(d))) {
        streak++
        d.setDate(d.getDate() - 1)
      }
      setCheckInStreak(streak)
    }

    setWeeklyStats({
      checkIns: weekCheckRes.count ?? 0,
      journalEntries: weekJournalRes.count ?? 0,
    })

    setOkayTapped(okayTapRes.tapped)
    setLoading(false)
    hasLoaded.current = true
  }, [user])

  useFocusEffect(
    useCallback(() => {
      loadDashboard()
    }, [loadDashboard])
  )

  // Milestone celebration — show when user just crossed a milestone boundary
  const prevDaysRef = useRef(days)
  useEffect(() => {
    if (days > 0 && prevDaysRef.current !== days) {
      const justReached = MILESTONES.find(m => m.days === days)
      if (justReached) {
        setShowCelebration(true)
        notifySuccess()
        setTimeout(() => setShowCelebration(false), 3000)
      }
    }
    prevDaysRef.current = days
  }, [days])

  async function handleRefresh() {
    setRefreshing(true)
    await loadDashboard()
    setRefreshing(false)
  }

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: layout.screenTopPadding }]}>
        <SkeletonCard count={4} height={100} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: layout.screenTopPadding }]}>
        <ErrorState onRetry={loadDashboard} />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
      }
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
          onPress={() => router.push('/(recovery)/settings')}
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel="invite supporters"
        >
          <Icon name="user-plus" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>

      {showCelebration && <CelebrationBanner />}

      <OkayTapCard
        tapped={okayTapped}
        onTap={async () => {
          try {
            await api('/api/okay-tap', { method: 'POST' })
            setOkayTapped(true)
          } catch {
            // silent — haptic already fired, will retry on next refresh
          }
        }}
        prompt={copy.dashboard.okayTapPrompt}
        doneMessage={copy.dashboard.okayTapDone}
      />

      {/* Streak — extra top margin to create visual breathing room */}
      <View style={{ marginTop: spacing.md }}>
        <StreakCard days={days} next={next} streakLabel={copy.dashboard.streakLabel} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          milestones
        </Text>
        <MilestonePath days={days} />
      </View>

      {/* Divider before activity section */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Weekly summary */}
      <WeeklySummary stats={weeklyStats} checkInStreak={checkInStreak} />

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

const MilestonePath = React.memo(function MilestonePath({ days }: { days: number }) {
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
})

function firstUnreachedIndex(days: number): number {
  const i = MILESTONES.findIndex((m) => days < m.days)
  return i === -1 ? MILESTONES.length : i
}

function MilestoneNode({ reached, isCurrent }: { reached: boolean; isCurrent: boolean }) {
  const colors = useColors()

  if (reached) {
    return (
      <View style={[styles.node, { backgroundColor: colors.success }]}>
        <Icon name="check" size={16} color="#fff" />
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
        {checkedIn && meta && <Icon name={meta.icon} size={18} color={colors.accent} />}
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

// ─── celebration banner ─────────────────────────────────────────────────
// Shown briefly when a milestone is reached. Uses Animated for a scale-in effect.

function CelebrationBanner() {
  const colors = useColors()
  const scale = useRef(new Animated.Value(0.8)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start()
  }, [scale, opacity])

  return (
    <Animated.View
      style={[
        styles.celebration,
        {
          backgroundColor: colors.successSoft,
          borderColor: colors.success,
          transform: [{ scale }],
          opacity,
        },
      ]}
    >
      <Icon name="award" size={24} color={colors.success} />
      <View style={styles.celebrationText}>
        <Text style={[type.h3, { color: colors.textPrimary }]}>milestone reached</Text>
        <Text style={[type.small, { color: colors.textSecondary }]}>
          you did it. take a moment to feel this.
        </Text>
      </View>
    </Animated.View>
  )
}

// ─── weekly summary ────────────────────────────────────────────────────

const WeeklySummary = React.memo(function WeeklySummary({ stats, checkInStreak }: { stats: WeeklyStats; checkInStreak: number }) {
  const colors = useColors()
  if (stats.checkIns === 0 && stats.journalEntries === 0 && checkInStreak === 0) return null

  return (
    <View style={[styles.weeklyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>this week</Text>
      <View style={styles.weeklyRow}>
        {checkInStreak > 0 && (
          <View style={styles.weeklyItem}>
            <Icon name="zap" size={16} color={colors.accent} />
            <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>
              {checkInStreak}
            </Text>
            <Text style={[type.small, { color: colors.textSecondary }]}>
              day streak
            </Text>
          </View>
        )}
        <View style={styles.weeklyItem}>
          <Icon name="check-circle" size={16} color={colors.success} />
          <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>
            {stats.checkIns}
          </Text>
          <Text style={[type.small, { color: colors.textSecondary }]}>
            check-ins
          </Text>
        </View>
        <View style={styles.weeklyItem}>
          <Icon name="book-open" size={16} color={colors.accent} />
          <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>
            {stats.journalEntries}
          </Text>
          <Text style={[type.small, { color: colors.textSecondary }]}>
            entries
          </Text>
        </View>
      </View>
    </View>
  )
})

// ─── helpers ────────────────────────────────────────────────────────────

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
    gap: spacing.xl,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: spacing.xs },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  greeting: { ...type.body },
  name: { ...type.h1 },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  nodeDot: { width: 8, height: 8, borderRadius: 4 },
  pathLabel: {
    fontSize: 11,
    letterSpacing: 0.1,
  },

  // celebration
  celebration: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  celebrationText: { flex: 1, gap: 2 },

  // weekly summary
  weeklyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  weeklyRow: {
    flexDirection: 'row',
  },
  weeklyItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },

  divider: {
    height: 1,
    marginVertical: spacing.sm,
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
  tileLabel: { ...type.h3 },
  tileDescription: { ...type.small },
  tileSoon: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },

})
