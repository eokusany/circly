import { useEffect, useCallback } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import type { UserRole } from '../store/auth'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const scheme = useColorScheme()
  const { setUser, setLoading } = useAuthStore()

  const loadUser = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('id, email, display_name, role')
      .eq('id', userId)
      .single()

    if (data) {
      setUser({
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        role: data.role as UserRole,
      })
      setLoading(false)
      router.replace(roleHome(data.role as UserRole))
    } else {
      setLoading(false)
      router.replace('/(auth)/role-select')
    }
  }, [setUser, setLoading])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadUser(session.user.id)
      } else {
        setLoading(false)
        router.replace('/(auth)/sign-in')
      }
      SplashScreen.hideAsync()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null)
          router.replace('/(auth)/sign-in')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadUser, setLoading, setUser])

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}

function roleHome(role: UserRole): string {
  switch (role) {
    case 'recovery': return '/(recovery)'
    case 'supporter': return '/(supporter)'
    case 'sponsor':   return '/(sponsor)'
  }
}
