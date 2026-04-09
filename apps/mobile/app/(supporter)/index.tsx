import { useCallback, useState } from 'react'
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
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { api, ApiError } from '../../lib/api'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'
import { streakDays, toISODate, type MilestoneType } from '../../lib/streak'
import { spacing, radii, type as t, layout } from '../../constants/theme'

type CheckInStatus = 'sober' | 'struggling' | 'good_day'

interface LinkedPerson {
  relationship_id: string
  recovery_user_id: string
  display_name: string
  sobriety_start_date: string | null
  today_check_in: CheckInStatus | null
  latest_milestone: MilestoneType | null
}

const CHECKIN_META: Record<CheckInStatus, { emoji: string; label: string }> = {
  good_day: { emoji: '🌿', label: 'good day' },
  sober: { emoji: '🌊', label: 'sober' },
  struggling: { emoji: '🌙', label: 'struggling' },
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
  const { user, signOut } = useAuthStore()
  const [people, setPeople] = useState<LinkedPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingFor, setSendingFor] = useState<LinkedPerson | null>(null)

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

    // Fetch today's check-in and latest milestone per person in parallel.
    // RLS silently hides rows the supporter isn't allowed to see — missing
    // data is rendered as "not shared", not as an error.
    const today = toISODate(new Date())
    const enriched = await Promise.all(
      base.map(async (p) => {
        const [checkIn, milestone] = await Promise.all([
          supabase
            .from('check_ins')
            .select('status')
            .eq('user_id', p.recovery_user_id)
            .eq('check_in_date', today)
            .maybeSingle<{ status: CheckInStatus }>(),
          supabase
            .from('milestones')
            .select('type')
            .eq('user_id', p.recovery_user_id)
            .order('reached_on', { ascending: false })
            .limit(1)
            .maybeSingle<{ type: MilestoneType }>(),
        ])
        return {
          ...p,
          today_check_in: checkIn.data?.status ?? null,
          latest_milestone: milestone.data?.type ?? null,
        }
      }),
    )

    setPeople(enriched)
    setLoading(false)
  }, [user])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            hey
          </Text>
          <Text style={[styles.name, { color: colors.textPrimary }]}>
            {user?.displayName ?? 'friend'}
          </Text>
        </View>

        {people.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={styles.list}>
            {people.map((p) => (
              <PersonCard
                key={p.relationship_id}
                person={p}
                onEncourage={() => setSendingFor(p)}
              />
            ))}
          </View>
        )}

        <TouchableOpacity onPress={signOut} style={styles.signOut}>
          <Text style={{ color: colors.textMuted }}>sign out</Text>
        </TouchableOpacity>
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
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        no one linked yet
      </Text>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        enter an invite code to start supporting someone.
      </Text>
      <Button
        label="enter invite code"
        onPress={() => router.push('/(auth)/invite-code')}
      />
    </View>
  )
}

function PersonCard({
  person,
  onEncourage,
}: {
  person: LinkedPerson
  onEncourage: () => void
}) {
  const colors = useColors()
  const days = person.sobriety_start_date
    ? streakDays(person.sobriety_start_date)
    : null

  const checkInLine = person.today_check_in
    ? `${CHECKIN_META[person.today_check_in].emoji}  ${
        CHECKIN_META[person.today_check_in].label
      }`
    : 'not yet today · not shared'

  const milestoneLine = person.latest_milestone
    ? MILESTONE_LABEL[person.latest_milestone]
    : 'none yet'

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.cardName, { color: colors.textPrimary }]}>
        {person.display_name}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaBlock}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
            streak
          </Text>
          <Text style={[styles.metaValue, { color: colors.accent }]}>
            {days !== null ? `${days}d` : '–'}
          </Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
            today
          </Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
            {checkInLine}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaBlock}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
            latest milestone
          </Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
            {milestoneLine}
          </Text>
        </View>
      </View>

      <Button label="send encouragement" onPress={onEncourage} />
    </View>
  )
}

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
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                onPress={() => send(p)}
                disabled={sending}
                style={({ pressed }) => [
                  styles.preset,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: sending ? 0.5 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.textPrimary }}>{p}</Text>
              </Pressable>
            ))}
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
  },
  header: { gap: spacing.xs },
  greeting: { ...t.body },
  name: { ...t.h1 },
  list: { gap: spacing.md },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardName: { ...t.h2 },
  metaRow: { flexDirection: 'row', gap: spacing.lg },
  metaBlock: { flex: 1, gap: spacing.xs },
  metaLabel: { ...t.label },
  metaValue: { ...t.body, fontWeight: '600' },

  emptyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: { ...t.h3 },
  emptyBody: { ...t.small },

  signOut: { alignSelf: 'center', marginTop: spacing.xl, padding: spacing.md },

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
  cancelLink: { alignItems: 'center', padding: spacing.md },
})
