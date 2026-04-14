import { Stack, Redirect } from 'expo-router'
import { useAuthStore } from '../../store/auth'

export default function ProfileLayout() {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Redirect href="/(auth)/sign-in" />
  return <Stack screenOptions={{ headerShown: false }} />
}
