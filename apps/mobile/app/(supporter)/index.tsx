import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { api, ApiError } from '../../lib/api'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'
import { SkeletonCard } from '../../components/SkeletonCard'
import { Icon, type IconName } from '../../components/Icon'
import { tapMedium, notifySuccess } from '../../lib/haptics'
import { streakDays, toISODate, type MilestoneType } from '../../lib/streak'
import { spacing, radii, type as t, layout } from '../../constants/theme'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'good morning'
  if (h < 17) return 'good afternoon'
  return 'good evening'
}

type CheckInStatus = 'sober' | 'struggling' | 'good_day'

interface LinkedPerson {
  relationship_id: string
  recovery_user_id: string
  display_name: string
  sobriety_start_date: string | null
  today_check_in: CheckInStatus | null
  latest_milestone: MilestoneType | null
}

const CHECKIN_META: Record<CheckInStatus, { icon: IconName; label: string }> = {
  good_day: { icon: 'sun', label: 'good day' },
  sober: { icon: 'anchor', label: 'sober' },
  struggling: { icon: 'cloud', label: 'struggling' },
}

const MILESTONE_LABEL: Record<MilestoneType, string> = {
  '1d': '1 day',
  '7d': '1 week',
  '30d': '1 month',
  '90d': '3 months',
  '1y': '1 year',
}

const PRESETS = ['thinking of you', 'proud of you', "you've got this"]

export default function SupporterHome() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const [people, setPeople] = useState<LinkedPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sendingFor, setSendingFor] = useState<LinkedPerson | null>(null)
  const [nudges, setNudges] = useState<SilenceNudge[]>([])
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([])

  interface SilenceNudge {
    id: string
    for_user_id: string
    from_display_name: string
    days_since: number
  }

  interface EmergencyAlert {
    id: string
    from_display_name: string
    created_at: string
  }

  async function sendWarmPing(person: LinkedPerson) {
    try {
      await api('/api/warm-ping', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: person.recovery_user_id }),
      })
      notifySuccess()
      Alert.alert('sent', `${person.display_name} will feel your warmth.`)
    } catch (err) {
      const msg =
        err instanceof ApiError && (err.body as { error?: string })?.error === 'daily_limit_reached'
          ? "you've reached today's limit for this person."
          : 'something went wrong. try again.'
      Alert.alert('could not send', msg)
    }
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: rels, error: relErr } = await supabase
      .from('relationships')
      .select(
        'id, recovery_user_id, users:recovery_user_id(display_name, profiles(sobriety_start_date))',
      )
      .eq('supporter_id', user.id)
      .eq('status', 'active')

    if (relErr || !rels) {
      setPeople([])
      setLoading(false)
      return
    }

    const base = (rels as unknown as Array<{
      id: string
      recovery_user_id: string
      users: {
        display_name: string
        profiles: { sobriety_start_date: string | null } | null
      } | null
    }>).map((r) => ({
      relationship_id: r.id,
      recovery_user_id: r.recovery_user_id,
      display_name: r.users?.display_name ?? 'friend',
      sobriety_start_date: r.users?.profiles?.sobriety_start_date ?? null,
      today_check_in: null as CheckInStatus | null,
      latest_milestone: null as MilestoneType | null,
    }))

    if (base.length === 0) {
      setPeople([])
      setLoading(false)
      return
    }

    // Batch check-ins + milestones in two queries total (not 2N). RLS
    // silently hides rows the supporter isn't allowed to see — missing
    // data is rendered as "not shared", not as an error.
    const ids = base.map((p) => p.recovery_user_id)
    const today = toISODate(new Date())

    const [checkInsRes, milestonesRes, nudgesRes, emergencyRes] = await Promise.all([
      supabase
        .from('check_ins')
        .select('user_id, status')
        .in('user_id', ids)
        .eq('check_in_date', today),
      supabase
        .from('milestones')
        .select('user_id, type, reached_on')
        .in('user_id', ids)
        .order('reached_on', { ascending: false })
        .limit(ids.length),
      supabase
        .from('notifications')
        .select('id, payload')
        .eq('recipient_id', user.id)
        .eq('type', 'silence_nudge')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('notifications')
        .select('id, payload, created_at')
        .eq('recipient_id', user.id)
        .eq('type', 'emergency')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const checkInByUser = new Map<string, CheckInStatus>()
    for (const row of (checkInsRes.data ?? []) as Array<{
      user_id: string
      status: CheckInStatus
    }>) {
      checkInByUser.set(row.user_id, row.status)
    }

    // milestones is sorted desc by reached_on, so first occurrence per
    // user_id is the latest.
    const latestMilestoneByUser = new Map<string, MilestoneType>()
    for (const row of (milestonesRes.data ?? []) as Array<{
      user_id: string
      type: MilestoneType
    }>) {
      if (!latestMilestoneByUser.has(row.user_id)) {
        latestMilestoneByUser.set(row.user_id, row.type)
      }
    }

    // Parse silence nudges
    const parsedNudges: SilenceNudge[] = []
    for (const row of (nudgesRes.data ?? []) as Array<{
      id: string
      payload: { for_user_id?: string; from_display_name?: string; days_since_last_signal?: number }
    }>) {
      if (row.payload?.for_user_id) {
        parsedNudges.push({
          id: row.id,
          for_user_id: row.payload.for_user_id,
          from_display_name: row.payload.from_display_name ?? 'someone',
          days_since: row.payload.days_since_last_signal ?? 0,
        })
      }
    }
    setNudges(parsedNudges)

    // Parse emergency alerts
    const parsedEmergencies: EmergencyAlert[] = []
    for (const row of (emergencyRes.data ?? []) as Array<{
      id: string
      payload: { from_display_name?: string }
      created_at: string
    }>) {
      parsedEmergencies.push({
        id: row.id,
        from_display_name: row.payload?.from_display_name ?? 'someone',
        created_at: row.created_at,
      })
    }
    setEmergencies(parsedEmergencies)

    const enriched = base.map((p) => ({
      ...p,
      today_check_in: checkInByUser.get(p.recovery_user_id) ?? null,
      latest_milestone: latestMilestoneByUser.get(p.recovery_user_id) ?? null,
    }))

    setPeople(enriched)
    setLoading(false)
  }, [user])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const checkedInCount = useMemo(
    () => people.filter((p) => p.today_check_in !== null).length,
    [people],
  )

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <SkeletonCard count={3} height={140} />
      </View>
    )
  }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
            tintColor={colors.accent}
          />
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
            {people.length > 0 && (
              <Text style={[styles.summary, { color: colors.textMuted }]}>
                {people.length} {people.length === 1 ? 'person' : 'people'} in your circle
                {checkedInCount > 0
                  ? ` · ${checkedInCount} checked in today`
                  : ''}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => router.push('/(supporter)/invite')}
            style={({ pressed }) => [
              styles.headerButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityLabel="invite someone"
          >
            <Icon name="user-plus" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {emergencies.length > 0 && (
          <View style={styles.list}>
            {emergencies.map((e) => (
              <EmergencyCard
                key={e.id}
                alert={e}
                onDismiss={async () => {
                  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', e.id)
                  setEmergencies((prev) => prev.filter((x) => x.id !== e.id))
                }}
              />
            ))}
          </View>
        )}

        {nudges.length > 0 && (
          <View style={styles.list}>
            {nudges.map((n) => (
              <NudgeCard
                key={n.id}
                nudge={n}
                onSendPing={async () => {
                  try {
                    await api('/api/warm-ping', {
                      method: 'POST',
                      body: JSON.stringify({ recipient_id: n.for_user_id }),
                    })
                    notifySuccess()
                    // Mark nudge as read and remove from list
                    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
                    setNudges((prev) => prev.filter((x) => x.id !== n.id))
                  } catch {
                    Alert.alert('could not send', 'something went wrong. try again.')
                  }
                }}
                onDismiss={async () => {
                  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
                  setNudges((prev) => prev.filter((x) => x.id !== n.id))
                }}
              />
            ))}
          </View>
        )}

        {people.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={styles.peopleSection}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              your circle
            </Text>
            <View style={styles.list}>
              {people.map((p) => (
                <PersonCard
                  key={p.relationship_id}
                  person={p}
                  onEncourage={() => setSendingFor(p)}
                  onWarmPing={() => sendWarmPing(p)}
                />
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      <EncouragementSheet
        person={sendingFor}
        onClose={() => setSendingFor(null)}
      />
    </>
  )
}

function EmptyState() {
  const colors = useColors()
  return (
    <View
      style={[
        styles.emptyCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.accentSoft }]}>
        <Icon name="users" size={28} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        no one linked yet
      </Text>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        your circle is where you show up for the people{'\n'}who matter most. invite someone to get started.
      </Text>
      <Button
        label="get started"
        onPress={() => router.push('/(supporter)/invite')}
      />
    </View>
  )
}

const PersonCard = React.memo(function PersonCard({
  person,
  onEncourage,
  onWarmPing,
}: {
  person: LinkedPerson
  onEncourage: () => void
  onWarmPing: () => void
}) {
  const colors = useColors()
  const days = useMemo(
    () => person.sobriety_start_date ? streakDays(person.sobriety_start_date) : null,
    [person.sobriety_start_date],
  )

  const checkIn = person.today_check_in ? CHECKIN_META[person.today_check_in] : null

  const milestoneLine = person.latest_milestone
    ? MILESTONE_LABEL[person.latest_milestone]
    : 'none yet'

  const initial = person.display_name.trim().charAt(0).toUpperCase()

  const statusBorder =
    person.today_check_in === 'struggling'
      ? colors.warning
      : person.today_check_in === 'good_day'
        ? colors.success
        : colors.border

  const statusAvatarBg =
    person.today_check_in === 'struggling'
      ? colors.warningSoft
      : person.today_check_in === 'good_day'
        ? colors.successSoft
        : colors.accentSoft

  const statusAvatarColor =
    person.today_check_in === 'struggling'
      ? colors.warning
      : person.today_check_in === 'good_day'
        ? colors.success
        : colors.accent

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: statusBorder },
      ]}
    >
      <View style={styles.cardHeaderRow}>
        <View style={[styles.avatar, { backgroundColor: statusAvatarBg }]}>
          <Text style={[styles.avatarText, { color: statusAvatarColor }]}>{initial}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardName, { color: colors.textPrimary }]}>
            {person.display_name}
          </Text>
          {days !== null && (
            <Text style={[styles.cardStreak, { color: colors.accent }]}>
              {days} {days === 1 ? 'day' : 'days'}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaBlock}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
            today
          </Text>
          {checkIn ? (
            <View style={styles.checkInRow}>
              <Icon name={checkIn.icon} size={14} color={colors.textPrimary} />
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                {checkIn.label}
              </Text>
            </View>
          ) : (
            <Text style={[styles.metaValue, { color: colors.textMuted }]}>
              not yet today
            </Text>
          )}
        </View>
        <View style={styles.metaBlock}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
            latest milestone
          </Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
            {milestoneLine}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <View style={{ flex: 1 }}>
          <Button label="send encouragement" onPress={() => { tapMedium(); onEncourage() }} />
        </View>
        <Pressable
          onPress={() => { tapMedium(); onWarmPing() }}
          style={({ pressed }) => [
            styles.warmPingBtn,
            {
              backgroundColor: colors.accentSoft,
              borderColor: colors.accent,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel={`send warm ping to ${person.display_name}`}
        >
          <Icon name="heart" size={20} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  )
})

const EmergencyCard = React.memo(function EmergencyCard({
  alert,
  onDismiss,
}: {
  alert: { from_display_name: string }
  onDismiss: () => void
}) {
  const colors = useColors()
  return (
    <View
      style={[
        styles.emergencyCard,
        { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
      ]}
    >
      <Icon name="alert-triangle" size={20} color={colors.danger} />
      <View style={styles.nudgeBody}>
        <Text style={[t.bodyStrong, { color: colors.danger }]}>
          {alert.from_display_name} needs support right now.
        </Text>
        <Text style={[t.small, { color: colors.textSecondary }]}>
          reach out as soon as you can.
        </Text>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingTop: spacing.sm })}
        >
          <Text style={[t.small, { color: colors.textMuted }]}>dismiss</Text>
        </Pressable>
      </View>
    </View>
  )
})

const NudgeCard = React.memo(function NudgeCard({
  nudge,
  onSendPing,
  onDismiss,
}: {
  nudge: { from_display_name: string; days_since: number }
  onSendPing: () => void
  onDismiss: () => void
}) {
  const colors = useColors()
  return (
    <View
      style={[
        styles.nudgeCard,
        { backgroundColor: colors.accentSoft, borderColor: colors.warning },
      ]}
    >
      <Icon name="alert-circle" size={20} color={colors.warning} />
      <View style={styles.nudgeBody}>
        <Text style={[t.body, { color: colors.textPrimary }]}>
          it&apos;s been {nudge.days_since} {nudge.days_since === 1 ? 'day' : 'days'} since{' '}
          {nudge.from_display_name} checked in.
        </Text>
        <View style={styles.nudgeActions}>
          <Pressable
            onPress={onSendPing}
            style={({ pressed }) => [
              styles.nudgeBtn,
              { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Icon name="heart" size={14} color="#fff" />
            <Text style={[t.small, { color: '#fff', fontWeight: '600' }]}>send warm ping</Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: spacing.sm })}
          >
            <Text style={[t.small, { color: colors.textMuted }]}>dismiss</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
})

function EncouragementSheet({
  person,
  onClose,
}: {
  person: LinkedPerson | null
  onClose: () => void
}) {
  const colors = useColors()
  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)

  async function send(message: string) {
    if (!person) return
    const trimmed = message.trim()
    if (!trimmed) return
    setSending(true)
    try {
      await api('/api/encouragements', {
        method: 'POST',
        body: JSON.stringify({
          relationship_id: person.relationship_id,
          message: trimmed,
        }),
      })
      setSending(false)
      setCustom('')
      onClose()
      notifySuccess()
      Alert.alert('sent', `${person.display_name} will see this soon.`)
    } catch (err) {
      setSending(false)
      const msg =
        err instanceof ApiError
          ? 'something went wrong. please try again.'
          : 'check your connection and try again.'
      Alert.alert('could not send', msg)
    }
  }

  return (
    <Modal
      visible={person !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
            send encouragement
          </Text>
          <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
            pick a message or write your own
          </Text>

          <View style={styles.presets}>
            {PRESETS.map((p, i) => {
              const emoji = ['💭', '🌟', '💪'][i]
              return (
                <Pressable
                  key={p}
                  onPress={() => send(p)}
                  disabled={sending}
                  style={({ pressed }) => [
                    styles.preset,
                    {
                      backgroundColor: colors.accentSoft,
                      borderColor: colors.accent,
                      opacity: sending ? 0.5 : pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.presetText, { color: colors.textPrimary }]}>
                    {emoji}  {p}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <TextInput
            label="your words"
            value={custom}
            onChangeText={setCustom}
            placeholder="write something..."
            autoCapitalize="sentences"
          />
          <Button
            label="send"
            onPress={() => send(custom)}
            loading={sending}
            disabled={!custom.trim()}
          />
          <TouchableOpacity onPress={onClose} style={styles.cancelLink}>
            <Text style={{ color: colors.textSecondary }}>cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    gap: spacing.md,
  },
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
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { ...t.body },
  name: { ...t.h1 },
  summary: { ...t.small, marginTop: spacing.xs },
  peopleSection: { gap: spacing.md },
  sectionLabel: { ...t.label },
  list: { gap: spacing.md },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardName: { ...t.h3 },
  cardStreak: { ...t.small, fontWeight: '600' },
  checkInRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaRow: { flexDirection: 'row', gap: spacing.lg },
  metaBlock: { flex: 1, gap: spacing.xs },
  metaLabel: { ...t.label },
  metaValue: { ...t.body, fontWeight: '600' },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  warmPingBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...t.h3 },
  emptyBody: { ...t.small, textAlign: 'center' },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  sheetTitle: { ...t.h2 },
  sheetSub: { ...t.small },
  presets: { gap: spacing.sm },
  preset: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  presetText: {
    ...t.body,
    fontWeight: '500',
  },
  cancelLink: { alignItems: 'center', padding: spacing.md },

  emergencyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  nudgeCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  nudgeBody: { flex: 1, gap: spacing.sm },
  nudgeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  nudgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
})
