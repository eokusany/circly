import { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { spacing, radii, type as t } from '../constants/theme'

interface Props {
  /** Dates (ISO strings) that have at least one journal entry. */
  entryDates: string[]
  /** Called when a date with an entry is tapped. */
  onDatePress?: (date: string) => void
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  // Monday = 0, Sunday = 6
  const startDay = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function getStreak(dates: Set<string>): number {
  let streak = 0
  const d = new Date()
  // Check if today has an entry, otherwise start from yesterday
  if (!dates.has(dateKey(d))) {
    d.setDate(d.getDate() - 1)
  }
  while (dates.has(dateKey(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export function StreakCalendar({ entryDates, onDatePress }: Props) {
  const colors = useColors()
  const now = new Date()
  const [offset, setOffset] = useState(0)
  const viewDate = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    return d
  }, [offset])
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const todayKey = dateKey(now)
  const isCurrentMonth = offset === 0

  const entrySet = useMemo(
    () => new Set(entryDates.map((iso) => dateKey(new Date(iso)))),
    [entryDates],
  )
  const cells = useMemo(() => getMonthGrid(year, month), [year, month])
  const streak = useMemo(() => getStreak(entrySet), [entrySet])

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: offset === 0 ? undefined : 'numeric' }).toLowerCase()

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setOffset((o) => o - 1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Icon name="chevron-left" size={18} color={colors.textMuted} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>{monthLabel}</Text>
          {streak > 0 && isCurrentMonth && (
            <View style={styles.streakRow}>
              <Icon name="edit-3" size={12} color={colors.accent} />
              <Text style={[styles.streakText, { color: colors.accent }]}>
                {streak} day streak
              </Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => setOffset((o) => Math.min(o + 1, 0))}
          hitSlop={8}
          disabled={isCurrentMonth}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={{ opacity: isCurrentMonth ? 0.3 : 1 }}
        >
          <Icon name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Day labels */}
      <View style={styles.row}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.cell}>
            <Text style={[styles.dayLabel, { color: colors.textMuted }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <View key={week} style={styles.row}>
          {cells.slice(week * 7, week * 7 + 7).map((day, i) => {
            if (day === null) {
              return <View key={i} style={styles.cell} />
            }

            const key = dateKey(new Date(year, month, day))
            const hasEntry = entrySet.has(key)
            const isToday = key === todayKey

            return (
              <View key={i} style={styles.cell}>
                <Pressable
                  onPress={hasEntry && onDatePress ? () => onDatePress(key) : undefined}
                  style={[
                    styles.dayCell,
                    hasEntry && {
                      backgroundColor: colors.accentSoft,
                      borderColor: colors.accent,
                      borderWidth: 1,
                    },
                    !hasEntry && {
                      backgroundColor: colors.surfaceRaised,
                    },
                    isToday && !hasEntry && {
                      borderColor: colors.accent,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: hasEntry
                          ? colors.accent
                          : isToday
                            ? colors.textPrimary
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              </View>
            )
          })}
        </View>
      ))}
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
    marginBottom: spacing.xs,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  monthLabel: { ...t.h3 },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  streakText: { ...t.small, fontWeight: '600' },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dayCell: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
  },
})
