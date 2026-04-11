import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { findMood } from '../../lib/mood'
import { Icon } from '../../components/Icon'
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
  const [refreshing, setRefreshing] = useState(false)

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
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadEntries(); setRefreshing(false) }}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>journal</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            a private space for your thoughts. only you can see this.
          </Text>
        </View>

        {!loading && entries.length > 0 && <MoodTimeline entries={entries} />}

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name="book-open" size={28} color={colors.accent} />
            </View>
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
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

function MoodTimeline({ entries }: { entries: JournalRow[] }) {
  const colors = useColors()
  const recent = entries.slice(0, 14)
  const withMood = recent.filter(e => e.mood_tag)
  if (withMood.length < 2) return null

  return (
    <View style={[styles.moodTimeline, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.moodTimelineLabel, { color: colors.textMuted }]}>mood over time</Text>
      <View style={styles.moodDots}>
        {recent.reverse().map(entry => {
          const mood = findMood(entry.mood_tag)
          return (
            <View key={entry.id} style={styles.moodDotWrap}>
              {mood ? (
                <View style={[styles.moodDot, { backgroundColor: colors.accentSoft }]}>
                  <Icon name={mood.icon} size={12} color={colors.accent} />
                </View>
              ) : (
                <View style={[styles.moodDot, { backgroundColor: colors.surfaceRaised }]}>
                  <View style={[styles.moodDotEmpty, { backgroundColor: colors.border }]} />
                </View>
              )}
            </View>
          )
        })}
      </View>
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
            <Icon name={mood.icon} size={12} color={colors.textSecondary} />
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
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { ...t.h3 },
  emptyBody: { ...t.small, textAlign: 'center' },

  moodTimeline: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  moodTimelineLabel: { ...t.label },
  moodDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  moodDotWrap: {},
  moodDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodDotEmpty: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

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
})
