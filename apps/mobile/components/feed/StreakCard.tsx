import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { spacing, radii, type, displayHero, elevation } from '../../constants/theme'
import { Colors } from '../../constants/colors'
import { MILESTONES, prevMilestoneDays, type Milestone } from '../../lib/streak'
import { pickEncouragement } from '../../lib/copy/encouragements'

interface StreakCardProps {
  days: number
  next: Milestone | null
  streakLabel: string
  showResetChip: boolean
  /** Optional override for testability. Defaults to today's day-of-year. */
  dayOfYear?: number
}

function todayDayOfYear(): number {
  return Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
}

export function StreakCard({
  days,
  next,
  streakLabel,
  showResetChip,
  dayOfYear,
}: StreakCardProps) {
  const [trackWidth, setTrackWidth] = useState(0)

  const doy = dayOfYear ?? todayDayOfYear()
  const encouragement = pickEncouragement(doy)

  const prevDays = prevMilestoneDays(days)
  const targetDays = next?.days ?? days
  const range = Math.max(targetDays - prevDays, 1)
  const progress = next ? Math.min(Math.max((days - prevDays) / range, 0), 1) : 1
  const fillWidth = trackWidth * progress

  const numberStyle = days >= 1000 ? styles.streakNumberFallback : styles.streakNumberHero

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width)
  }

  return (
    <LinearGradient
      colors={['#2A2218', '#1B1A17']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      {/* Encouragement line */}
      <Text style={styles.encouragement}>{encouragement}</Text>

      {/* Hero number */}
      <View style={styles.numberRow}>
        <Text style={numberStyle}>{days}</Text>
        {showResetChip && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="reset streak"
            onPress={() => router.push('/(recovery)/start-fresh')}
            style={({ pressed }) => [
              styles.resetChip,
              { opacity: pressed ? 0.7 : 1, marginLeft: 'auto' },
            ]}
          >
            <Text style={styles.resetChipText}>{'\u21bb'} reset</Text>
          </Pressable>
        )}
      </View>

      {/* DAYS SOBER label */}
      <Text style={styles.daysSoberLabel}>DAYS SOBER</Text>

      {/* Progress bar + pill */}
      <View style={styles.progressSection}>
        <View
          style={styles.progressTrack}
          onLayout={handleTrackLayout}
        >
          {trackWidth > 0 && (
            <LinearGradient
              colors={['#C58A3F', '#D9A766']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[
                styles.progressFill,
                {
                  width: fillWidth,
                  shadowColor: 'rgba(217,167,102,0.4)',
                  shadowRadius: 12,
                  shadowOpacity: 1,
                  shadowOffset: { width: 0, height: 0 },
                },
              ]}
            />
          )}
        </View>

        {next ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {next.days - days} {next.days - days === 1 ? 'day' : 'days'} to your{' '}
              {next.label}
            </Text>
          </View>
        ) : (
          <View style={styles.pill}>
            <Text style={styles.pillText}>every milestone reached. incredible.</Text>
          </View>
        )}
      </View>

      {/* Milestone dots */}
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
                      ? Colors.dark.success
                      : isCurrent
                        ? Colors.dark.accentSoft
                        : 'transparent',
                    borderColor: reached
                      ? Colors.dark.success
                      : isCurrent
                        ? Colors.dark.accent
                        : Colors.dark.border,
                    borderWidth: isCurrent ? 2 : 1,
                  },
                ]}
              />
              <Text
                style={[
                  styles.dotLabel,
                  {
                    color: reached
                      ? Colors.dark.textPrimary
                      : isCurrent
                        ? Colors.dark.accent
                        : Colors.dark.textMuted,
                  },
                ]}
              >
                {m.label}
              </Text>
            </View>
          )
        })}
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.xl,
    ...elevation.hero,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(217,167,102,0.18)',
  },
  encouragement: {
    ...type.body,
    color: Colors.dark.textSecondary,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakNumberHero: {
    ...displayHero,
    color: Colors.dark.textPrimary,
  },
  streakNumberFallback: {
    ...type.display,
    color: Colors.dark.textPrimary,
  },
  daysSoberLabel: {
    ...type.label,
    color: Colors.dark.accent,
    marginTop: -spacing.sm,
  },
  progressSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(217,167,102,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillText: {
    ...type.small,
    color: Colors.dark.accent,
  },
  resetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceRaised,
  },
  resetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
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
