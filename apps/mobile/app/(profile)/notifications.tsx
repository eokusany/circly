import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { SettingRow, SettingSection } from '../../components/SettingRow'
import { spacing, type as t, layout } from '../../constants/theme'

interface Prefs {
  encouragements: boolean
  support_alerts: boolean
  messages: boolean
}

const DEFAULT_PREFS: Prefs = {
  encouragements: true,
  support_alerts: true,
  messages: true,
}

export default function NotificationsScreen() {
  const colors = useColors()
  const { user } = useAuthStore()
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('user_id', user.id)
        .single<{ notification_preferences: Prefs }>()

      if (data?.notification_preferences) {
        // Merge with defaults so newly-added keys (future notification types)
        // don't show up as undefined for users with older rows.
        setPrefs({ ...DEFAULT_PREFS, ...data.notification_preferences })
      } else if (error) {
        // Non-fatal — show defaults and let the user save to create the row.
        console.warn('failed to load notification preferences:', error.message)
      }
      setLoading(false)
    })()
  }, [user])

  async function togglePref(key: keyof Prefs, value: boolean) {
    if (!user) return
    const next = { ...prefs, [key]: value }
    setPrefs(next) // optimistic

    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences: next })
      .eq('user_id', user.id)
    setSaving(false)

    if (error) {
      // Roll back on failure so the UI stays in sync with the DB.
      setPrefs(prefs)
      Alert.alert('could not save', error.message)
    }
  }

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.accent }]}>← back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>notifications</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          choose what you&apos;d like to hear about
        </Text>
      </View>

      <SettingSection>
        <SettingRow
          label="encouragements"
          value="when someone sends you support"
          hideChevron
          right={
            <Switch
              value={prefs.encouragements}
              onValueChange={(v) => togglePref('encouragements', v)}
              trackColor={{ false: colors.border, true: colors.accent }}
              disabled={saving}
            />
          }
        />
        <SettingRow
          label="support alerts"
          value="when someone taps get support"
          hideChevron
          right={
            <Switch
              value={prefs.support_alerts}
              onValueChange={(v) => togglePref('support_alerts', v)}
              trackColor={{ false: colors.border, true: colors.accent }}
              disabled={saving}
            />
          }
        />
        <SettingRow
          label="new messages"
          value="when someone sends you a message"
          hideChevron
          right={
            <Switch
              value={prefs.messages}
              onValueChange={(v) => togglePref('messages', v)}
              trackColor={{ false: colors.border, true: colors.accent }}
              disabled={saving}
            />
          }
        />
      </SettingSection>

      <Text style={[styles.footnote, { color: colors.textMuted }]}>
        push notifications will honor these choices once we add them in a future update.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    gap: spacing.xl,
  },
  header: { gap: spacing.sm },
  back: { ...t.smallStrong, marginBottom: spacing.xs },
  title: { ...t.h1 },
  subtitle: { ...t.body },
  footnote: { ...t.small, textAlign: 'center', paddingHorizontal: spacing.lg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
