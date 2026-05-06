import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { spacing, radii, type } from '../../constants/theme'
import { MILESTONES, type Milestone } from '../../lib/streak'

interface StreakCardProps {
  days: number
  next: Milestone | null
  streakLabel: string
  showResetChip: boolean
}

export function StreakCard({ days, next, streakLabel, showResetChip }: StreakCardProps) {
  const colors = useColors()

  const prevDays = prevMilestoneDays(days)
  const targetDays = next?.days ?? days
  const range = Math.max(targetDays - prevDays, 1)
  const progress = next ? Math.min((days - prevDays) / range, 1) : 1

  return (
    <View
      style={[
        styles.streakCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.streakLabel, { color: colors.textMuted }]}>
        {streakLabel}
      </Text>

      <View style={styles.streakNumberRow}>
        <Text style={[styles.streakNumber, { color: colors.accent }]}>{days}</Text>
        <Text style={[styles.streakUnit, { color: colors.textSecondary }]}>
          {days === 1 ? 'day' : 'days'}
        </Text>
        {showResetChip && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="reset streak"
            onPress={() => router.push('/(recovery)/start-fresh')}
            style={({ pressed }) => [
              styles.resetChip,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
                marginLeft: 'auto',
              },
            ]}
          >
            <Text style={[styles.resetChipText, { color: colors.textSecondary }]}>
              {'\u21bb'} reset
            </Text>
          </Pressable>
        )}
      </View>

      {next ? (
        <View style={styles.progressWrap}>
          <View
            style={[styles.progressTrack, { backgroundColor: colors.surfaceRaised }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.accent,
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
            {next.days - days} {next.days - days === 1 ? 'day' : 'days'} until{' '}
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {next.label}
            </Text>
          </Text>
        </View>
      ) : (
        <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
          every milestone reached. incredible.
        </Text>
      )}

      {/* §2.4 — milestone dots */}
      <View style={styles.dotsRow}>
        {MILESTONES.map((m) => {
          const reached = days >= m.days
          const isCurrent = !reached && next?.days === m.days
          return (
            <View key={m.type} style={styles.dotItem}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: reached
                      ? colors.success
                      : isCurrent
                        ? colors.accentSoft
                        : 'transparent',
                    borderColor: reached
                      ? colors.success
                      : isCurrent
                        ? colors.accent
                        : colors.border,
                    borderWidth: isCurrent ? 2 : 1,
                  },
                ]}
              />
              <Text
                style={[
                  styles.dotLabel,
                  {
                    color: reached
                      ? colors.textPrimary
                      : isCurrent
                        ? colors.accent
                        : colors.textMuted,
                  },
                ]}
              >
                {m.label}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function prevMilestoneDays(days: number): number {
  let prev = 0
  for (const m of MILESTONES) {
    if (days < m.days) return prev
    prev = m.days
  }
  return prev
}

const styles = StyleSheet.create({
  streakCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  streakLabel: { ...type.label },
  streakNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  streakNumber: { ...type.display },
  streakUnit: { fontSize: 18, fontWeight: '500' },
  progressWrap: { gap: spacing.sm, marginTop: spacing.xs },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  progressCaption: { ...type.small },
  resetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  resetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  dotItem: {
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
})
