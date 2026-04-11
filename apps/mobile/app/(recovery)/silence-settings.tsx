import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native'
import { router, useFocusEffect, Stack } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { api } from '../../lib/api'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { tapLight } from '../../lib/haptics'
import { scheduleOkayReminder, cancelOkayReminder, parseTime } from '../../lib/notifications'
import { spacing, radii, type as t, layout } from '../../constants/theme'

interface SilenceSettings {
  okay_tap_enabled: boolean
  okay_tap_time: string
  silence_threshold_days: number
  snooze_until: string | null
}

const THRESHOLD_OPTIONS = [1, 2, 3, 5, 7]
const SNOOZE_OPTIONS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
]

const TIME_OPTIONS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
]

export default function SilenceSettingsScreen() {
  const colors = useColors()
  const [settings, setSettings] = useState<SilenceSettings>({
    okay_tap_enabled: true,
    okay_tap_time: '09:00',
    silence_threshold_days: 2,
    snooze_until: null,
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api<SilenceSettings>('/api/silence-settings')
      setSettings(data)
    } catch {
      // use defaults
    }
  }, [])

  useFocusEffect(
    useCallback(() => { load() }, [load]),
  )

  async function save(patch: Partial<SilenceSettings>) {
    setSaving(true)
    try {
      await api('/api/silence-settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const updated = { ...settings, ...patch }
      setSettings(updated)

      // Reschedule or cancel the daily notification
      const snoozed = updated.snooze_until && updated.snooze_until >= new Date().toISOString().split('T')[0]
      if (!updated.okay_tap_enabled || snoozed) {
        await cancelOkayReminder()
      } else {
        const { hour, minute } = parseTime(updated.okay_tap_time)
        await scheduleOkayReminder(hour, minute)
      }
    } catch {
      Alert.alert('could not save', 'check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSnooze(days: number) {
    tapLight()
    const until = new Date()
    until.setDate(until.getDate() + days)
    await save({ snooze_until: until.toISOString().split('T')[0] })
  }

  async function handleCancelSnooze() {
    tapLight()
    await save({ snooze_until: null })
  }

  const snoozeActive = settings.snooze_until && new Date(settings.snooze_until) > new Date()

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Icon name="chevron-left" size={20} color={colors.accent} />
            <Text style={[styles.back, { color: colors.accent }]}>back</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            silence detection
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            when you go quiet, your circle gets a gentle nudge to reach out.
          </Text>
        </View>

        {/* Threshold */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            how long before a nudge?
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            your supporters get nudged after this many days of silence.
          </Text>
          <View style={styles.chipRow}>
            {THRESHOLD_OPTIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => { tapLight(); save({ silence_threshold_days: d }) }}
                disabled={saving}
                style={[
                  styles.chip,
                  {
                    backgroundColor: d === settings.silence_threshold_days ? colors.accent : colors.surface,
                    borderColor: d === settings.silence_threshold_days ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: d === settings.silence_threshold_days ? '#fff' : colors.textPrimary,
                    },
                  ]}
                >
                  {d} {d === 1 ? 'day' : 'days'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Okay tap time */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            daily reminder time
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            when should we remind you to tap "I'm okay"?
          </Text>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map((time) => (
              <Pressable
                key={time}
                onPress={() => { tapLight(); save({ okay_tap_time: time }) }}
                disabled={saving}
                style={[
                  styles.chip,
                  {
                    backgroundColor: time === settings.okay_tap_time ? colors.accent : colors.surface,
                    borderColor: time === settings.okay_tap_time ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: time === settings.okay_tap_time ? '#fff' : colors.textPrimary,
                    },
                  ]}
                >
                  {time}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Snooze */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            taking a break?
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            snooze detection so your circle doesn't get nudged while you're away.
          </Text>
          {snoozeActive ? (
            <View
              style={[
                styles.snoozeCard,
                { backgroundColor: colors.accentSoft, borderColor: colors.accent },
              ]}
            >
              <Icon name="pause-circle" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[t.bodyStrong, { color: colors.textPrimary }]}>
                  snoozed until {settings.snooze_until}
                </Text>
                <Text style={[t.small, { color: colors.textSecondary }]}>
                  your circle won't be nudged during this time.
                </Text>
              </View>
              <Button
                label="cancel"
                variant="ghost"
                onPress={handleCancelSnooze}
                loading={saving}
              />
            </View>
          ) : (
            <View style={styles.chipRow}>
              {SNOOZE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.days}
                  onPress={() => handleSnooze(opt.days)}
                  disabled={saving}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.textPrimary }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
  },
  header: { gap: spacing.sm },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  back: { ...t.bodyStrong },
  title: { ...t.h1 },
  subtitle: { ...t.body },
  section: { gap: spacing.md },
  sectionTitle: { ...t.label },
  hint: { ...t.small },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chipText: {
    ...t.smallStrong,
  },
  snoozeCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
})
