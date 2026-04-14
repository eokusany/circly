import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Animated,
  AppState,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { useJournalLock } from '../../hooks/useJournalLock'
import { supabase } from '../../lib/supabase'
import { findMood } from '../../lib/mood'
import { Icon } from '../../components/Icon'
import { JournalLock } from '../../components/JournalLock'
import { StreakCalendar } from '../../components/StreakCalendar'
import { MoodCurve } from '../../components/MoodCurve'
import { WeeklyDigest } from '../../components/WeeklyDigest'
import { spacing, radii, type as t, layout } from '../../constants/theme'

interface JournalRow {
  id: string
  body: string
  mood_tag: string | null
  mood_value: number | null
  prompt_used: string | null
  created_at: string
}

export default function JournalScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const lock = useJournalLock()
  const [unlocked, setUnlocked] = useState(false)
  const [entries, setEntries] = useState<JournalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Animations
  const fabAnim = useMemo(() => new Animated.Value(0), [])
  const contentOpacity = useMemo(() => new Animated.Value(0), [])

  // Re-lock journal when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        setUnlocked(false)
        lock.lock()
      }
    })
    return () => subscription.remove()
  }, [lock])

  const loadEntries = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('journal_entries')
      .select('id, body, mood_tag, mood_value, prompt_used, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    setEntries((data as JournalRow[]) ?? [])
    setLoading(false)

    // Animate content in
    Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start()

    // FAB slide up
    Animated.spring(fabAnim, { toValue: 1, useNativeDriver: true }).start()
  }, [user, contentOpacity, fabAnim])

  useFocusEffect(
    useCallback(() => {
      if (unlocked || lock.state === 'unlocked') {
        loadEntries()
      }
    }, [loadEntries, unlocked, lock.state])
  )

  const entryDates = useMemo(() => entries.map((e) => e.created_at), [entries])

  const fabTranslate = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  })

  // Show lock screen if not yet unlocked
  if (!unlocked && lock.state !== 'unlocked') {
    return (
      <JournalLock
        lockState={lock.state}
        biometricAvailable={lock.biometricAvailable}
        biometricEnabled={lock.biometricEnabled}
        isCoolingDown={lock.isCoolingDown}
        onSavePin={lock.savePin}
        onCheckPin={lock.checkPin}
        onBiometric={lock.authenticateBiometric}
        onUnlockComplete={() => setUnlocked(true)}
      />
    )
  }

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
          <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
            {/* Weekly digest */}
            <WeeklyDigest entries={entries} />

            {/* Streak calendar */}
            <View style={styles.section}>
              <StreakCalendar entryDates={entryDates} />
            </View>

            {/* Mood curve */}
            <View style={styles.section}>
              <MoodCurve
                entries={entries}
                onEntryPress={(id) =>
                  router.push({ pathname: '/(recovery)/journal-entry', params: { id } })
                }
              />
            </View>

            {/* Entry list */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>entries</Text>
              <View style={styles.list}>
                {entries.map((entry, index) => (
                  <AnimatedEntryCard key={entry.id} entry={entry} index={index} />
                ))}
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <Animated.View
        style={[
          styles.fabWrap,
          { transform: [{ translateY: fabTranslate }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/(recovery)/journal-entry')}
          style={[styles.fab, { backgroundColor: colors.accent }]}
        >
          <Icon name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const AnimatedEntryCard = React.memo(function AnimatedEntryCard({ entry, index }: { entry: JournalRow; index: number }) {
  const slideAnim = useMemo(() => new Animated.Value(0), [])

  useFocusEffect(
    useCallback(() => {
      slideAnim.setValue(0)
      Animated.spring(slideAnim, {
        toValue: 1,
        delay: index * 50,
        useNativeDriver: true,
      }).start()
    }, [slideAnim, index])
  )

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  })

  return (
    <Animated.View style={{ opacity: slideAnim, transform: [{ translateY }] }}>
      <EntryCard entry={entry} />
    </Animated.View>
  )
})

const EntryCard = React.memo(function EntryCard({ entry }: { entry: JournalRow }) {
  const colors = useColors()
  const mood = findMood(entry.mood_tag)

  // Strip prompt text from preview so the card shows the user's own words
  let preview = entry.body
  if (entry.prompt_used && preview.startsWith(entry.prompt_used)) {
    preview = preview.slice(entry.prompt_used.length).trim()
  }

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
        {preview || entry.body}
      </Text>
    </TouchableOpacity>
  )
})

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
  content: { gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionLabel: { ...t.label, marginTop: spacing.sm },

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

  fabWrap: {
    position: 'absolute',
    right: layout.screenPadding,
    bottom: 40,
  },
  fab: {
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
