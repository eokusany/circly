import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import { Sentry } from '../../lib/sentry'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { useCopy } from '../../lib/copy'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'
import { tapLight } from '../../lib/haptics'
import {
  loadTodayCheckIn,
  saveTodayCheckIn,
  type CheckInRow,
  type CheckInStatus,
} from '../../lib/checkIns'

interface Props {
  onSaved?: (row: CheckInRow) => void
}

const STATUS_ORDER: CheckInStatus[] = ['good_day', 'sober', 'struggling']

export function TodayCheckInCard({ onSaved }: Props) {
  const colors = useColors()
  const copy = useCopy()
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [row, setRow] = useState<CheckInRow | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const userId = user.id
    ;(async () => {
      try {
        const initial = await loadTodayCheckIn(userId)
        if (cancelled) return
        setRow(initial)
        setNote(initial?.note ?? '')
        setCollapsed(initial !== null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  const handleChipTap = useCallback(async (status: CheckInStatus) => {
    if (!user) return
    if (!user.firstCheckinIntroSeen && !row) {
      router.replace('/(recovery)/first-checkin-intro')
      return
    }
    tapLight()
    setSaving(true)
    try {
      const wasFirstEver = !row
      const next = await saveTodayCheckIn({ userId: user.id, status, note })
      setRow(next)
      onSaved?.(next)
      if (wasFirstEver && !user.firstCheckinCelebrationSeen) {
        router.replace('/(recovery)/first-checkin-celebration')
      } else {
        setCollapsed(true)
      }
    } catch (err) {
      Sentry.captureException(err)
      Alert.alert('couldn\u2019t save check-in', 'please try again in a moment.')
    } finally {
      setSaving(false)
    }
  }, [user, note, row, onSaved])

  const handleNoteBlur = useCallback(async () => {
    if (!user || !row) return
    if ((row.note ?? '') === note) return
    setSaving(true)
    try {
      const next = await saveTodayCheckIn({ userId: user.id, status: row.status, note })
      setRow(next)
      onSaved?.(next)
    } catch (err) {
      Sentry.captureException(err)
      Alert.alert('couldn\u2019t save check-in', 'please try again in a moment.')
    } finally {
      setSaving(false)
    }
  }, [user, row, note, onSaved])

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (collapsed && row) {
    const label = copy.dashboard.checkInStatuses[row.status]?.label ?? row.status
    return (
      <Pressable
        onPress={() => setCollapsed(false)}
        accessibilityRole="button"
        accessibilityLabel="edit today's check-in"
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        ]}
      >
        <Text style={[type.body, { color: colors.textPrimary }]}>
          today: {label}
        </Text>
        <Text style={[type.small, { color: colors.textMuted }]}>edit</Text>
      </Pressable>
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[type.label, { color: colors.textMuted }]}>today's check-in</Text>
      <Text style={[type.body, { color: colors.textPrimary }]}>{copy.dashboard.checkInPrompt}</Text>
      <View style={styles.chips}>
        {STATUS_ORDER.map((status) => {
          const meta = copy.dashboard.checkInStatuses[status]
          const isSelected = row?.status === status
          return (
            <Pressable
              key={status}
              onPress={() => handleChipTap(status)}
              accessibilityRole="button"
              accessibilityLabel={`chip-${status}`}
              disabled={saving}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.accentSoft : colors.surfaceRaised,
                  borderColor: isSelected ? colors.accent : colors.border,
                },
              ]}
            >
              <Icon name={meta.icon} size={14} color={isSelected ? colors.accent : colors.textSecondary} />
              <Text style={[type.small, { color: isSelected ? colors.accent : colors.textPrimary, fontWeight: '600' }]}>
                {meta.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        onBlur={handleNoteBlur}
        placeholder="anything on your mind? (optional)"
        placeholderTextColor={colors.textMuted}
        multiline
        scrollEnabled={false}
        style={[
          styles.note,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  note: {
    minHeight: 40,
    maxHeight: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
})
