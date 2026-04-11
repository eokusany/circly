import { useEffect, useState } from 'react'
import { Alert, Vibration } from 'react-native'
import { Tabs } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { playEmergencySound } from '../../lib/sounds'
import { notifySuccess } from '../../lib/haptics'

export default function SupporterLayout() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return

    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null)
      .then(({ count }) => setUnreadCount(count ?? 0))

    const channel = supabase
      .channel('supporter-notifications')
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
          fontSize: 11,
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
      <Tabs.Screen name="invite" options={{ href: null }} />
    </Tabs>
  )
}
