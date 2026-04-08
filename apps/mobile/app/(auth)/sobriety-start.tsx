import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput as RNTextInput } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { toISODate, parseISODate } from '../../lib/streak'
import { spacing, radii, type as t, layout } from '../../constants/theme'

type Preset = { key: string; label: string; daysAgo: number }

const PRESETS: Preset[] = [
  { key: 'today', label: 'today', daysAgo: 0 },
  { key: 'yesterday', label: 'yesterday', daysAgo: 1 },
  { key: 'week', label: '1 week ago', daysAgo: 7 },
  { key: 'month', label: '1 month ago', daysAgo: 30 },
]

function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISODate(d)
}

export default function SobrietyStartScreen() {
  const colors = useColors()
  const { user, setUser } = useAuthStore()
  const [selectedPreset, setSelectedPreset] = useState<string | null>('today')
  const [customMode, setCustomMode] = useState(false)
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [day, setDay] = useState(String(new Date().getDate()))
  const [loading, setLoading] = useState(false)

  function resolveStartDate(): string | null {
    if (customMode) {
      const y = parseInt(year, 10)
      const m = parseInt(month, 10)
      const d = parseInt(day, 10)
      if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      // Validate real calendar date and not in the future
      const parsed = parseISODate(iso)
      if (
        parsed.getFullYear() !== y ||
        parsed.getMonth() + 1 !== m ||
        parsed.getDate() !== d
      ) {
        return null
      }
      if (parsed.getTime() > Date.now()) return null
      return iso
    }
    const preset = PRESETS.find((p) => p.key === selectedPreset)
    if (!preset) return null
    return daysAgoISO(preset.daysAgo)
  }

  async function handleContinue() {
    if (!user) return
    const iso = resolveStartDate()
    if (!iso) {
      Alert.alert('invalid date', 'please enter a valid date that is not in the future')
      return
    }

    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ sobriety_start_date: iso, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    if (error) {
      setLoading(false)
      Alert.alert('something went wrong', error.message)
      return
    }

    setUser({ ...user, sobrietyStartDate: iso })
    setLoading(false)
    router.replace('/(recovery)')
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>when did you start?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          this is day one of your streak. you can always reset it later.
        </Text>
      </View>

      {!customMode && (
        <View style={styles.presets}>
          {PRESETS.map((preset) => {
            const isSelected = selectedPreset === preset.key
            return (
              <TouchableOpacity
                key={preset.key}
                onPress={() => setSelectedPreset(preset.key)}
                activeOpacity={0.85}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: isSelected ? colors.accent : colors.textPrimary },
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {customMode && (
        <View style={styles.dateRow}>
          <DateField label="year" value={year} onChangeText={setYear} maxLength={4} />
          <DateField label="month" value={month} onChangeText={setMonth} maxLength={2} />
          <DateField label="day" value={day} onChangeText={setDay} maxLength={2} />
        </View>
      )}

      <TouchableOpacity
        onPress={() => setCustomMode((v) => !v)}
        activeOpacity={0.7}
        style={styles.toggleWrap}
      >
        <Text style={[styles.toggle, { color: colors.accent }]}>
          {customMode ? 'use a quick option' : 'pick an exact date'}
        </Text>
      </TouchableOpacity>

      <Button label="continue" onPress={handleContinue} loading={loading} />
    </ScrollView>
  )
}

function DateField({
  label,
  value,
  onChangeText,
  maxLength,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  maxLength: number
}) {
  const colors = useColors()
  return (
    <View style={styles.dateField}>
      <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{label}</Text>
      <RNTextInput
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={maxLength}
        style={[
          styles.dateInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    gap: spacing.xl,
  },
  header: { gap: spacing.sm },
  title: { ...t.h1 },
  subtitle: { ...t.body },
  presets: { gap: spacing.md },
  chip: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  chipLabel: { ...t.h3 },
  dateRow: { flexDirection: 'row', gap: spacing.md },
  dateField: { flex: 1, gap: spacing.sm },
  dateLabel: { ...t.label },
  dateInput: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    textAlign: 'center',
  },
  toggleWrap: { alignItems: 'center' },
  toggle: { ...t.smallStrong },
})
