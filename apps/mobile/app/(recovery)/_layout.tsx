import { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { RecoveryTabBar } from '../../components/RecoveryTabBar'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { scheduleOkayReminder, cancelOkayReminder, parseTime } from '../../lib/notifications'
import { usePushToken } from '../../hooks/usePushToken'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'

export default function RecoveryLayout() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  usePushToken(user?.id)
  useRealtimeNotifications(user?.id)
  // Schedule daily "I'm okay" reminder based on user's silence settings.
  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function setupReminder() {
      const { data } = await supabase
        .from('silence_settings')
        .select('okay_tap_enabled, okay_tap_time, snooze_until')
        .eq('user_id', user!.id)
        .maybeSingle()

      if (cancelled) return

      const settings = data as {
        okay_tap_enabled: boolean
        okay_tap_time: string
        snooze_until: string | null
      } | null

      // If disabled or snoozed, cancel any existing reminder
      const snoozed = settings?.snooze_until && settings.snooze_until >= new Date().toISOString().split('T')[0]
      if (!settings?.okay_tap_enabled || snoozed) {
        await cancelOkayReminder()
        return
      }

      const { hour, minute } = parseTime(settings?.okay_tap_time ?? '09:00')
      await scheduleOkayReminder(hour, minute)
    }

    setupReminder()
    return () => { cancelled = true }
  }, [user])

  return (
    <Tabs
      tabBar={(props) => <RecoveryTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index"         options={{ title: 'home'    }} />
      <Tabs.Screen name="journal"       options={{ title: 'journal' }} />
      <Tabs.Screen name="notifications" options={{ title: 'alerts'  }} />
      <Tabs.Screen name="profile"       options={{ title: 'profile' }} />
      {/* Accessible from header, not tab bar */}
      <Tabs.Screen name="chat"          options={{ href: null }} />
      {/* Sub-screens */}
      <Tabs.Screen name="check-in"             options={{ href: null }} />
      <Tabs.Screen name="journal-entry"        options={{ href: null }} />
      <Tabs.Screen name="settings"             options={{ href: null }} />
      <Tabs.Screen name="supporter-settings"   options={{ href: null }} />
      <Tabs.Screen name="silence-settings"     options={{ href: null }} />
    </Tabs>
  )
}
