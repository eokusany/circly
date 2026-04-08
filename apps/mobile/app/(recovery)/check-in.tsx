import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput as RNTextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { Button } from '../../components/Button'
import { supabase } from '../../lib/supabase'
import { toISODate, parseISODate } from '../../lib/streak'
import { spacing, radii, type as t, layout } from '../../constants/theme'

type CheckInStatus = 'sober' | 'struggling' | 'good_day'

interface CheckInRow {
  id: string
  status: CheckInStatus
  note: string | null
  check_in_date: string
}

const OPTIONS: { value: CheckInStatus; emoji: string; label: string; description: string }[] = [
  { value: 'good_day', emoji: '🌿', label: 'good day', description: 'feeling strong and steady' },
  { value: 'sober', emoji: '🌊', label: 'sober', description: 'getting through, one moment at a time' },
  { value: 'struggling', emoji: '🌙', label: 'struggling', description: 'it\'s a hard one, you showed up' },
]

export default function CheckInScreen() {
  const colors = useColors()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<CheckInStatus | null>(null)
  const [note, setNote] = useState('')
  const [history, setHistory] = useState<CheckInRow[]>([])
  const todayISO = toISODate(new Date())

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase
        .from('check_ins')
        .select('id, status, note, check_in_date')
        .eq('user_id', user.id)
        .order('check_in_date', { ascending: false })
        .limit(14)

      if (data) {
        const rows = data as CheckInRow[]
        setHistory(rows)
        const today = rows.find((r) => r.check_in_date === todayISO)
        if (today) {
          setStatus(today.status)
          setNote(today.note ?? '')
        }
      }
      setLoading(false)
    })()
  }, [user, todayISO])

  async function handleSave() {
    if (!user || !status) return
    setSaving(true)
    const { error, data } = await supabase
      .from('check_ins')
      .upsert(
        {
          user_id: user.id,
          status,
          note: note.trim() || null,
          check_in_date: todayISO,
        },
        { onConflict: 'user_id,check_in_date' }
      )
      .select('id, status, note, check_in_date')
      .single<CheckInRow>()

    setSaving(false)

    if (error || !data) {
      Alert.alert('something went wrong', error?.message ?? 'please try again')
      return
    }

    // Optimistically update history
    setHistory((prev) => {
      const without = prev.filter((r) => r.check_in_date !== todayISO)
      return [data, ...without]
    })
    router.back()
  }

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.accent }]}>← back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>today&apos;s check-in</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          how are you showing up right now?
        </Text>
      </View>

      <View style={styles.options}>
        {OPTIONS.map((opt) => {
          const isSelected = status === opt.value
          return (
            <TouchableOpacity
              key={opt.value}
              activeOpacity={0.85}
              onPress={() => setStatus(opt.value)}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                  {opt.description}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={styles.noteWrap}>
        <Text style={[styles.noteLabel, { color: colors.textMuted }]}>
          note (optional)
        </Text>
        <RNTextInput
          value={note}
          onChangeText={setNote}
          placeholder="anything on your mind?"
          placeholderTextColor={colors.textMuted}
          multiline
          style={[
            styles.noteInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
      </View>

      <Button
        label="save check-in"
        onPress={handleSave}
        loading={saving}
        style={{ opacity: status ? 1 : 0.4 }}
      />

      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={[styles.historyTitle, { color: colors.textMuted }]}>recent</Text>
          <View style={styles.historyList}>
            {history.map((row) => (
              <HistoryItem key={row.id} row={row} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  )
}

function HistoryItem({ row }: { row: CheckInRow }) {
  const colors = useColors()
  const opt = OPTIONS.find((o) => o.value === row.status)
  return (
    <View
      style={[
        styles.historyItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={styles.historyEmoji}>{opt?.emoji ?? '•'}</Text>
      <View style={styles.historyBody}>
        <Text style={[styles.historyDate, { color: colors.textPrimary }]}>
          {formatDate(row.check_in_date)}
        </Text>
        {row.note ? (
          <Text style={[styles.historyNote, { color: colors.textSecondary }]} numberOfLines={2}>
            {row.note}
          </Text>
        ) : (
          <Text style={[styles.historyNote, { color: colors.textSecondary }]}>
            {opt?.label ?? row.status}
          </Text>
        )}
      </View>
    </View>
  )
}

function formatDate(iso: string): string {
  const d = parseISODate(iso)
  const today = new Date()
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.floor((todayMid.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  header: { gap: spacing.xs },
  back: { ...t.bodyStrong, marginBottom: spacing.sm },
  title: { ...t.h1 },
  subtitle: { ...t.body },

  options: { gap: spacing.md },
  option: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionEmoji: { fontSize: 26 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { ...t.h3 },
  optionDescription: { ...t.small },

  noteWrap: { gap: spacing.sm },
  noteLabel: { ...t.label },
  noteInput: {
    minHeight: 100,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },

  historySection: { gap: spacing.lg, marginTop: spacing.sm },
  historyTitle: { ...t.label },
  historyList: { gap: spacing.sm },
  historyItem: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  historyEmoji: { fontSize: 20 },
  historyBody: { flex: 1, gap: 2 },
  historyDate: { ...t.smallStrong },
  historyNote: { ...t.small },
})
