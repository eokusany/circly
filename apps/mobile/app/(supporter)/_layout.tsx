import { Tabs } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { usePushToken } from '../../hooks/usePushToken'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'
import { SupporterTabBar } from '../../components/SupporterTabBar'

export default function SupporterLayout() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  usePushToken(user?.id)
  useRealtimeNotifications(user?.id)

  return (
    <Tabs
      tabBar={(props) => <SupporterTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index"         options={{ title: 'home'        }} />
      <Tabs.Screen name="invite"        options={{ title: 'connections' }} />
      <Tabs.Screen name="notifications" options={{ title: 'alerts'      }} />
      <Tabs.Screen name="profile"       options={{ title: 'profile'     }} />
      <Tabs.Screen name="chat"          options={{ href: null }} />
    </Tabs>
  )
}
