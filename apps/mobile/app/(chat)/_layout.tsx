import { Stack, Redirect } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'

export default function ChatLayout() {
  const user = useAuthStore((s) => s.user)
  const colors = useColors()
  if (!user) return <Redirect href="/(auth)/sign-in" />
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  )
}
