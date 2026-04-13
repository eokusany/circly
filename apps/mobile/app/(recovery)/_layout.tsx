import { useEffect, useState } from 'react'
import { Alert, Vibration } from 'react-native'
import { Tabs } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { scheduleOkayReminder, cancelOkayReminder, parseTime } from '../../lib/notifications'
import { playEmergencySound } from '../../lib/sounds'
import { notifySuccess } from '../../lib/haptics'

export default function RecoveryLayout() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const [unreadCount, setUnreadCount] = useState(0)

  // Realtime subscription for instant notification delivery.
  // Lives at the layout level so it's always active regardless of which tab.
  useEffect(() => {
    if (!user) return

    // Fetch initial unread count
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null)
      .then(({ count }) => setUnreadCount(count ?? 0))

    const channel = supabase
      .channel('layout-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as { type?: string; payload?: { from_display_name?: string } }
          setUnreadCount((c) => c + 1)

          if (newNotif.type === 'emergency') {
            playEmergencySound()
            Vibration.vibrate([0, 500, 200, 500, 200, 500])
            const name = newNotif.payload?.from_display_name ?? 'someone'
            Alert.alert('emergency', `${name} needs support right now.`)
          } else {
            notifySuccess()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

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
      screenOptions={{
        headerShown: false,
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
        name="chat"
        options={{
          title: 'messages',
          tabBarIcon: ({ color, size }) => <Icon name="message-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'notifications',
          tabBarIcon: ({ color, size }) => <Icon name="bell" size={size} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'profile',
          tabBarIcon: ({ color, size }) => <Icon name="user" size={size} color={color} />,
        }}
      />
      {/* Hide sub-screens from the tab bar */}
      <Tabs.Screen name="check-in" options={{ href: null }} />
      <Tabs.Screen name="journal-entry" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="supporter-settings" options={{ href: null }} />
      <Tabs.Screen name="silence-settings" options={{ href: null }} />
    </Tabs>
  )
}
