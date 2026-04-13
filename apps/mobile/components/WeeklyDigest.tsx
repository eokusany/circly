import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { findMood } from '../lib/mood'
import { spacing, radii, type as t } from '../constants/theme'

interface Entry {
  mood_tag: string | null
  created_at: string
}

interface Props {
  entries: Entry[]
}

const ENCOURAGEMENTS = [
  'keep it up — every entry counts.',
  'you showed up for yourself this week.',
  'writing is a form of healing.',
  'consistency builds clarity.',
  'your words matter.',
]

function getWeekId(): string {
  const now = new Date()
  const jan1 = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7)
  return `${now.getFullYear()}-W${week}`
}

function getLastWeekRange(): { start: Date; end: Date } {
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7 // Monday = 0
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - dayOfWeek)
  thisMonday.setHours(0, 0, 0, 0)

  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)

  const lastSunday = new Date(thisMonday)
  lastSunday.setDate(thisMonday.getDate() - 1)
  lastSunday.setHours(23, 59, 59, 999)

  return { start: lastMonday, end: lastSunday }
}

export function WeeklyDigest({ entries }: Props) {
  const colors = useColors()
  const [dismissed, setDismissed] = useState(true)

  const weekId = getWeekId()
  const storageKey = `journal_digest_dismissed_${weekId}`

  useEffect(() => {
    SecureStore.getItemAsync(storageKey).then((val) => {
      setDismissed(val === 'true')
    })
  }, [storageKey])

  // Only show on Monday+ (after the week has ended)
  const today = new Date().getDay()
  // getDay: 0=Sun, 1=Mon. Show Mon–Wed (days 1,2,3) to give time to see it
  if (today === 0 || today > 3) return null

  const { start, end } = getLastWeekRange()
  const weekEntries = entries.filter((e) => {
    const d = new Date(e.created_at)
    return d >= start && d <= end
  })

  if (weekEntries.length < 3 || dismissed) return null

  // Compute stats
  const count = weekEntries.length
  const moodEntries = weekEntries.filter((e) => e.mood_tag)
  const firstMood = moodEntries.length > 0 ? findMood(moodEntries[0].mood_tag) : null
  const lastMood = moodEntries.length > 1 ? findMood(moodEntries[moodEntries.length - 1].mood_tag) : null

  // Most common mood
  const moodCounts: Record<string, number> = {}
  moodEntries.forEach((e) => {
    if (e.mood_tag) moodCounts[e.mood_tag] = (moodCounts[e.mood_tag] ?? 0) + 1
  })
  const topMoodTag = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const topMood = findMood(topMoodTag)

  const encouragement = ENCOURAGEMENTS[weekEntries.length % ENCOURAGEMENTS.length]

  function handleDismiss() {
    setDismissed(true)
    SecureStore.setItemAsync(storageKey, 'true')
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="bar-chart-2" size={16} color={colors.accent} />
          <Text style={[styles.headerLabel, { color: colors.accent }]}>last week</Text>
        </View>
        <Pressable onPress={handleDismiss} hitSlop={12}>
          <Icon name="x" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <Text style={[styles.stat, { color: colors.textPrimary }]}>
        you wrote {count} {count === 1 ? 'entry' : 'entries'} last week.
      </Text>

      {firstMood && lastMood && firstMood.tag !== lastMood.tag && (
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          your mood shifted from {firstMood.label} → {lastMood.label}
        </Text>
      )}

      {topMood && (
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          you felt {topMood.label} most often.
        </Text>
      )}

      <Text style={[styles.encouragement, { color: colors.accent }]}>
        {encouragement}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerLabel: { ...t.label },
  stat: { ...t.bodyStrong },
  detail: { ...t.small },
  encouragement: {
    ...t.small,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
})
