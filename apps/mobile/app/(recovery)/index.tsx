import React, { useState, useCallback, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { Sentry } from '../../lib/sentry'
import { getTodayIntention, setIntention as setIntentionApi } from '../../lib/api'
import { SkeletonCard } from '../../components/SkeletonCard'
import { ErrorState } from '../../components/ErrorState'
import { spacing, radii, type, layout } from '../../constants/theme'
import { useLayout } from '../../hooks/useLayout'
import {
  nextMilestone,
  streakDays,
  toISODate,
} from '../../lib/streak'
import { useCopy } from '../../lib/copy'
import { AppHeader } from '../../components/AppHeader'
import { useNotificationStore } from '../../store/notifications'
import {
  shouldCelebrateSubstance,
  shouldCelebrateLife,
  highestReachedSubstanceDays,
  highestReachedLifeCheckins,
} from '../../lib/milestones'
import { MilestoneTakeover } from '../../components/MilestoneTakeover'
import { MilestoneFeedCard } from '../../components/MilestoneFeedCard'
import { DailyPulseCard } from '../../components/feed/DailyPulseCard'
import { MemoryCard } from '../../components/feed/MemoryCard'
import { IntentionCard } from '../../components/feed/IntentionCard'
import { StrugglingCard } from '../../components/feed/StrugglingCard'
import { TodayCheckInCard } from '../../components/feed/TodayCheckInCard'
import { StartFreshNudge } from '../../components/feed/StartFreshNudge'
import { StreakCard } from '../../components/feed/StreakCard'
import { getPromptForDay } from '../../lib/reflectionPrompts'

const MILESTONES_SUBSTANCE_LABEL: Record<number, string> = {
  1: '1 day',
  3: '3 days',
  7: '1 week',
  14: '2 weeks',
  30: '1 month',
  90: '3 months',
  180: '6 months',
  365: '1 year',
  730: '2 years',
  1095: '3 years',
  1460: '4 years',
  1825: '5 years',
}

type CheckInStatus = 'sober' | 'struggling' | 'good_day'

interface OldJournalEntry {
  body: string
  created_at: string
}

export default function RecoveryHome() {
  const colors = useColors()
  const { screenTopPadding } = useLayout()
  const copy = useCopy()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const unreadNotifications = useNotificationStore((s) => s.unreadCount)
  const [todayStatus, setTodayStatus] = useState<CheckInStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const hasLoaded = useRef(false)
  const lastFetchedAt = useRef(0)
  const [refreshing, setRefreshing] = useState(false)
  const [connectionCount, setConnectionCount] = useState<number>(0)
  const [totalCheckIns, setTotalCheckIns] = useState<number>(0)
  const [milestoneTakeoverVisible, setMilestoneTakeoverVisible] = useState(false)
  const [intention, setIntention] = useState<string | null>(null)
  const [oldEntry, setOldEntry] = useState<OldJournalEntry | null>(null)

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
    const sevenDaysAgoISO = new Date(today.getTime() - 7 * 86400000).toISOString()

    let checkInRes
    let totalCheckRes: { count: number | null }
    let relationshipsRes: { count: number | null }
    let oldJournalRes: { data: OldJournalEntry[] | null }
    let intentionData: { intention: string | null }
    try {
      const results = await Promise.all([
        supabase
          .from('check_ins')
          .select('status')
          .eq('user_id', user.id)
          .eq('check_in_date', todayISO)
          .maybeSingle<{ status: CheckInStatus }>(),
        supabase
          .from('check_ins')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('relationships')
          .select('id', { count: 'exact', head: true })
          .eq('recovery_user_id', user.id)
          .eq('status', 'active'),
        supabase
          .from('journal_entries')
          .select('body, created_at')
          .eq('user_id', user.id)
          .lte('created_at', sevenDaysAgoISO)
          .order('created_at', { ascending: false })
          .limit(1),
        getTodayIntention().catch(() => ({ intention: null })),
      ])
      checkInRes = results[0]
      totalCheckRes = results[1] as { count: number | null }
      relationshipsRes = results[2] as { count: number | null }
      oldJournalRes = results[3] as { data: OldJournalEntry[] | null }
      intentionData = results[4]
    } catch {
      setError(true)
      setLoading(false)
      return
    }

    setTodayStatus(checkInRes.data?.status ?? null)
    setConnectionCount(relationshipsRes.count ?? 0)
    setTotalCheckIns(totalCheckRes.count ?? 0)
    setOldEntry(oldJournalRes.data?.[0] ?? null)
    setIntention(intentionData.intention)
    setLoading(false)
    hasLoaded.current = true
    lastFetchedAt.current = Date.now()

    if (user.context === 'recovery') {
      const m = shouldCelebrateSubstance(
        user.sobrietyStartDate ? streakDays(user.sobrietyStartDate) : 0,
        user.lastMilestoneCelebratedDays ?? 0,
      )
      if (m) setMilestoneTakeoverVisible(true)
    } else if (user.context === 'life') {
      const m = shouldCelebrateLife(
        totalCheckRes.count ?? 0,
        user.lastMilestoneCelebratedCheckins ?? 0,
      )
      if (m) setMilestoneTakeoverVisible(true)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      const stale = Date.now() - lastFetchedAt.current > 30_000
      if (!hasLoaded.current || stale) loadDashboard()
    }, [loadDashboard])
  )

  async function handleRefresh() {
    setRefreshing(true)
    await loadDashboard()
    setRefreshing(false)
  }

  async function handleSaveIntention(text: string) {
    try {
      const result = await setIntentionApi(text)
      setIntention(result.intention)
    } catch (err) {
      Sentry.captureException(err)
      Alert.alert('could not save', 'check your connection and try again.')
    }
  }

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: screenTopPadding }]}>
        <SkeletonCard count={4} height={100} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: screenTopPadding }]}>
        <ErrorState onRetry={loadDashboard} />
      </View>
    )
  }

  const substanceCelebrating =
    user?.context === 'recovery'
      ? shouldCelebrateSubstance(
          days,
          user.lastMilestoneCelebratedDays ?? 0,
        )
      : null
  const lifeCelebrating =
    user?.context === 'life'
      ? shouldCelebrateLife(
          totalCheckIns,
          user.lastMilestoneCelebratedCheckins ?? 0,
        )
      : null

  const substanceHighest = highestReachedSubstanceDays(days)
  const lifeHighest = highestReachedLifeCheckins(totalCheckIns)

  const takeoverLabel =
    substanceCelebrating
      ? `${substanceCelebrating.label}.`
      : lifeCelebrating
        ? `${lifeCelebrating.label}.`
        : ''

  async function handleTakeoverContinue() {
    if (!user) {
      setMilestoneTakeoverVisible(false)
      return
    }
    if (user.context === 'recovery' && substanceCelebrating) {
      await supabase
        .from('profiles')
        .update({ last_milestone_celebrated_days: substanceCelebrating.days })
        .eq('user_id', user.id)
      setUser({ ...user, lastMilestoneCelebratedDays: substanceCelebrating.days })
    } else if (user.context === 'life' && lifeCelebrating) {
      await supabase
        .from('profiles')
        .update({ last_milestone_celebrated_checkins: lifeCelebrating.checkins })
        .eq('user_id', user.id)
      setUser({ ...user, lastMilestoneCelebratedCheckins: lifeCelebrating.checkins })
    }
    setMilestoneTakeoverVisible(false)
  }

  // Daily Pulse card choice (spec §2.2): rotate reflection vs memory based on
  // available history. Memory needs an entry from 7+ days ago; rotate every
  // 3rd day once the user has enough history.
  const showMemory = oldEntry !== null && days >= 7 && days % 3 === 0
  const reflectionPrompt = getPromptForDay(days)
  const oldEntryDaysAgo = oldEntry
    ? Math.floor((Date.now() - new Date(oldEntry.created_at).getTime()) / 86400000)
    : 0

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
      }
    >
      <MilestoneTakeover
        visible={milestoneTakeoverVisible}
        label={takeoverLabel}
        onContinue={handleTakeoverContinue}
      />
      <AppHeader
        user={{
          id: user?.id ?? '',
          displayName: user?.displayName ?? 'friend',
          avatarUrl: user?.avatarUrl ?? null,
        }}
        onAvatarPress={() => router.push('/(profile)')}
        onNotificationsPress={() => router.push('/(recovery)/notifications')}
        unreadNotifications={unreadNotifications}
      />

      {/* §2.4 — pinned streak snapshot */}
      <StreakCard
        days={days}
        next={next}
        streakLabel={copy.dashboard.streakLabel}
        showResetChip={user?.context === 'recovery'}
      />

      {/* spec §5.1 — today's check-in inline */}
      <TodayCheckInCard onSaved={(row) => setTodayStatus(row.status)} />

      {/* §4.2 — struggling card sits below the check-in */}
      {todayStatus === 'struggling' && (
        <StrugglingCard onGetSupport={() => Alert.alert(
          'when you’re ready',
          'press and hold the SOS button at the bottom of the screen to alert your supporters.',
        )} />
      )}

      {/* spec §5.1 — start-fresh nudge moves out of the check-in screen */}
      {todayStatus === 'struggling' && user?.context === 'recovery' && (
        <StartFreshNudge />
      )}

      {/* §2.2 — milestone celebration (persistent until next) */}
      {user?.context === 'recovery' && substanceHighest > 0 && (
        <MilestoneFeedCard
          badge={
            MILESTONES_SUBSTANCE_LABEL[substanceHighest] ??
            `${substanceHighest} days`
          }
          body={`${MILESTONES_SUBSTANCE_LABEL[substanceHighest] ?? `${substanceHighest} days`} clean. quiet wins matter.`}
        />
      )}
      {user?.context === 'life' && lifeHighest > 0 && (
        <MilestoneFeedCard
          badge={`${lifeHighest} check-ins`}
          body={`${lifeHighest} check-ins. showing up matters.`}
        />
      )}

      {/* §2.2 — daily pulse: reflection or memory */}
      {showMemory && oldEntry ? (
        <MemoryCard
          entryText={oldEntry.body}
          daysAgo={oldEntryDaysAgo}
          dayNumber={Math.max(days - oldEntryDaysAgo, 1)}
        />
      ) : (
        <DailyPulseCard
          prompt={reflectionPrompt}
          onWriteAnswer={() =>
            router.push({
              pathname: '/(recovery)/journal-entry',
              params: { prompt: reflectionPrompt },
            })
          }
        />
      )}

      {/* §2.2 — intention slot, daily */}
      <IntentionCard intention={intention} onSave={handleSaveIntention} />

      {/* invite supporter nudge while user has zero connections */}
      {connectionCount === 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="invite someone who is in your corner"
          onPress={() => router.push('/(recovery)/settings')}
          style={({ pressed }) => [
            styles.inviteCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.inviteText, { color: colors.textPrimary }]}>
            {`invite someone who's in your corner →`}
          </Text>
        </Pressable>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  )
}


const styles = StyleSheet.create({
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl * 3,
    gap: spacing.lg,
  },

  inviteCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  inviteText: { ...type.body, fontWeight: '500' as const },
})
