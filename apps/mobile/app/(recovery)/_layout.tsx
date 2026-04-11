import { Tabs } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'

export default function RecoveryLayout() {
  const colors = useColors()

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
    </Tabs>
  )
}
