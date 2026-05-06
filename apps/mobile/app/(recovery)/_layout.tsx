import { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { useColors, ForcedSchemeContext } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'
import { CenterSOSButton } from '../../components/CenterSOSButton'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { scheduleOkayReminder, cancelOkayReminder, parseTime } from '../../lib/notifications'
import { usePushToken } from '../../hooks/usePushToken'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'
import { useEmergencyAlert } from '../../hooks/useEmergencyAlert'

export default function RecoveryLayout() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  usePushToken(user?.id)
  useRealtimeNotifications(user?.id)
  const { trigger: triggerEmergency } = useEmergencyAlert()

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
    <ForcedSchemeContext.Provider value="dark">
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingBottom: 8,
            height: 64,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'home',
            tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: 'journal',
            tabBarIcon: ({ color, size }) => <Icon name="book-open" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="sos"
          options={{
            title: '',
            tabBarButton: () => <CenterSOSButton onArmed={triggerEmergency} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'messages',
            tabBarIcon: ({ color, size }) => <Icon name="message-circle" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'add',
            tabBarIcon: ({ color, size }) => <Icon name="user-plus" size={size} color={color} />,
          }}
        />
        {/* Hidden routes — still navigable but not in the tab bar. */}
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="journal-entry" options={{ href: null }} />
        <Tabs.Screen name="supporter-settings" options={{ href: null }} />
        <Tabs.Screen name="silence-settings" options={{ href: null }} />
        <Tabs.Screen name="start-fresh" options={{ href: null }} />
        <Tabs.Screen name="first-checkin-intro" options={{ href: null }} />
        <Tabs.Screen name="first-checkin-celebration" options={{ href: null }} />
      </Tabs>
    </ForcedSchemeContext.Provider>
  )
}
