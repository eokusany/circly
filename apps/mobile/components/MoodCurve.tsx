import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, LayoutChangeEvent, Pressable } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { findMood, valueFromTag } from '../lib/mood'
import { spacing, radii, type as t } from '../constants/theme'

interface Entry {
  id: string
  mood_tag: string | null
  mood_value: number | null
  created_at: string
}

interface Props {
  entries: Entry[]
  onEntryPress?: (id: string) => void
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

/** Build a smooth bezier path through a set of points. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''

  let d = `M ${points[0].x} ${points[0].y}`

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`
  }

  return d
}

/** Build a closed path for the gradient fill area. */
function fillPath(points: { x: number; y: number }[], height: number): string {
  if (points.length < 2) return ''

  const curvePart = smoothPath(points)
  const lastPt = points[points.length - 1]
  const firstPt = points[0]

  return `${curvePart} L ${lastPt.x} ${height} L ${firstPt.x} ${height} Z`
}

const CHART_HEIGHT = 100
const PADDING_X = 20
const PADDING_Y = 16

export function MoodCurve({ entries, onEntryPress }: Props) {
  const colors = useColors()
  const [width, setWidth] = useState(0)
  const [tooltip, setTooltip] = useState<{ id: string; label: string; date: string; x: number; y: number } | null>(null)

  // Filter to entries with mood data, take last 14
  const withMood = useMemo(
    () => entries
      .filter((e) => e.mood_value !== null || e.mood_tag !== null)
      .slice(0, 14)
      .reverse(),
    [entries],
  )

  function handleLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width)
  }

  const usableWidth = width - PADDING_X * 2
  const usableHeight = CHART_HEIGHT - PADDING_Y * 2

  const points = useMemo(
    () => {
      if (withMood.length < 2) return []
      return withMood.map((entry, i) => {
        const moodVal = entry.mood_value ?? valueFromTag(entry.mood_tag) ?? 50
        const x = PADDING_X + (i / (withMood.length - 1)) * usableWidth
        const y = PADDING_Y + usableHeight - (moodVal / 100) * usableHeight
        return { x, y, entry }
      })
    },
    [withMood, usableWidth, usableHeight],
  )

  const pathPoints = useMemo(
    () => points.map(({ x, y }) => ({ x, y })),
    [points],
  )

  if (withMood.length < 3) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.label, { color: colors.textMuted }]}>mood over time</Text>
        <View style={styles.emptyState}>
          <Icon name="trending-up" size={24} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            log at least 3 moods to see your curve
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onLayout={handleLayout}
    >
      <Text style={[styles.label, { color: colors.textMuted }]}>mood over time</Text>

      {width > 0 && (
        <View style={styles.chartWrap}>
          <Svg width={width - spacing.lg * 2} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.accent} stopOpacity="0.2" />
                <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* Gradient fill */}
            <Path
              d={fillPath(pathPoints, CHART_HEIGHT)}
              fill="url(#curveGrad)"
            />

            {/* Curve line */}
            <Path
              d={smoothPath(pathPoints)}
              stroke={colors.accent}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
            />

            {/* Data points */}
            {points.map((pt, i) => (
              <Circle
                key={pt.entry.id}
                cx={pt.x}
                cy={pt.y}
                r={4}
                fill={colors.accent}
                onPress={() => {
                  const mood = findMood(pt.entry.mood_tag)
                  setTooltip({
                    id: pt.entry.id,
                    label: mood?.label ?? 'neutral',
                    date: formatShortDate(pt.entry.created_at),
                    x: pt.x,
                    y: pt.y,
                  })
                  if (onEntryPress) onEntryPress(pt.entry.id)
                }}
              />
            ))}
          </Svg>

          {/* Tooltip */}
          {tooltip && (
            <Pressable
              onPress={() => setTooltip(null)}
              style={[
                styles.tooltip,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                  left: Math.max(0, Math.min(tooltip.x - 40, (width - spacing.lg * 2) - 80)),
                  top: Math.max(0, tooltip.y - 36),
                },
              ]}
            >
              <Text style={[styles.tooltipText, { color: colors.textPrimary }]}>
                {tooltip.label} · {tooltip.date}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  label: { ...t.label },
  chartWrap: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...t.small,
    textAlign: 'center' as const,
  },
})
