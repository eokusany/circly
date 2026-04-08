import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { findMood } from '../../lib/mood'
import { spacing, radii, type as t, layout } from '../../constants/theme'

interface JournalRow {
  id: string
  body: string
  mood_tag: string | null
  created_at: string
}

export default function JournalScreen() {
  const colors = useColors()
  const { user } = useAuthStore()
  const [entries, setEntries] = useState<JournalRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadEntries = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('journal_entries')
      .select('id, body, mood_tag, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setEntries((data as JournalRow[]) ?? [])
    setLoading(false)
  }, [user])

  useFocusEffect(
    useCallback(() => {
      loadEntries()
    }, [loadEntries])
  )

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.back, { color: colors.accent }]}>← back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>journal</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            a private space for your thoughts. only you can see this.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.emptyEmoji}>📓</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              your first entry is waiting
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              write whatever comes to mind. a feeling, a memory, a gratitude.
              no one else will ever read this.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push('/(recovery)/journal-entry')}
        style={[styles.fab, { backgroundColor: colors.accent }]}
      >
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

function EntryCard({ entry }: { entry: JournalRow }) {
  const colors = useColors()
  const mood = findMood(entry.mood_tag)
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() =>
        router.push({ pathname: '/(recovery)/journal-entry', params: { id: entry.id } })
      }
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardDate, { color: colors.textPrimary }]}>
          {formatDate(entry.created_at)}
        </Text>
        {mood && (
          <View style={[styles.moodPill, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
            <Text style={[styles.moodLabel, { color: colors.textSecondary }]}>
              {mood.label}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.cardBody, { color: colors.textSecondary }]}
        numberOfLines={3}
      >
        {entry.body}
      </Text>
    </TouchableOpacity>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()

  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `today · ${time}`

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return `yesterday · ${time}`

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: 120,
    gap: spacing.xl,
  },
  header: { gap: spacing.xs },
  back: { ...t.bodyStrong, marginBottom: spacing.sm },
  title: { ...t.h1 },
  subtitle: { ...t.body },

  emptyCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  emptyEmoji: { fontSize: 36, marginBottom: spacing.xs },
  emptyTitle: { ...t.h3 },
  emptyBody: { ...t.small, textAlign: 'center' },

  list: { gap: spacing.md },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: { ...t.smallStrong },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  moodEmoji: { fontSize: 13 },
  moodLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  cardBody: { ...t.small, lineHeight: 20 },

  fab: {
    position: 'absolute',
    right: layout.screenPadding,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  fabPlus: { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 },
})
