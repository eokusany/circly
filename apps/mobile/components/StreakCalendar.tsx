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
  const year = now.getFullYear()
  const month = now.getMonth()
  const todayKey = dateKey(now)

  const entrySet = new Set(entryDates.map((iso) => dateKey(new Date(iso))))
  const cells = getMonthGrid(year, month)
  const streak = getStreak(entrySet)

  const monthLabel = now.toLocaleDateString(undefined, { month: 'long' }).toLowerCase()

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>{monthLabel}</Text>
          {streak > 0 && (
            <View style={styles.streakRow}>
              <Icon name="edit-3" size={12} color={colors.accent} />
              <Text style={[styles.streakText, { color: colors.accent }]}>
                {streak} day streak
              </Text>
            </View>
          )}
        </View>
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
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
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
