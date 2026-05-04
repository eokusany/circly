import { Tabs } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'
import { useAuthStore } from '../../store/auth'
import { useNotificationStore } from '../../store/notifications'
import { usePushToken } from '../../hooks/usePushToken'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'

export default function SupporterLayout() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  usePushToken(user?.id)
  useRealtimeNotifications(user?.id)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
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
        name="notifications"
        options={{
          title: 'alerts',
          tabBarIcon: ({ color, size }) => <Icon name="bell" size={size} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="invite"
        options={{
          title: 'add',
          tabBarIcon: ({ color, size }) => <Icon name="user-plus" size={size} color={color} />,
        }}
      />
      {/* Hidden routes */}
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  )
}
