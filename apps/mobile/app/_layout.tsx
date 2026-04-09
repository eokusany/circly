import { useEffect, useCallback } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import type { AppContext, UserRole } from '../store/auth'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const scheme = useColorScheme()
  const { setUser, setLoading } = useAuthStore()

  const loadUser = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('id, email, display_name, role, context, profiles(sobriety_start_date)')
      .eq('id', userId)
      .single<{
        id: string
        email: string
        display_name: string
        role: UserRole
        context: AppContext | null
        profiles: { sobriety_start_date: string | null } | null
      }>()

    if (data) {
      const sobrietyStartDate = data.profiles?.sobriety_start_date ?? null
      setUser({
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        role: data.role,
        context: data.context,
        sobrietyStartDate,
      })
      setLoading(false)
      // Recovery-context users at the "center" role need a sobriety start date.
      // Family-context users skip this step entirely.
      if (data.role === 'recovery' && data.context === 'recovery' && !sobrietyStartDate) {
        router.replace('/(auth)/sobriety-start')
      } else {
        router.replace(roleHome(data.role))
      }
    } else {
      // No public.users row yet — this session is mid-onboarding. Route to
      // context-select, which will flow into role-select when complete.
      setLoading(false)
      router.replace('/(auth)/context-select')
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
        // PASSWORD_RECOVERY: ignore here — verify-reset.tsx handles this flow
        // in-screen (OTP verify + updateUser + signOut) so we don't want to
        // route the transient recovery session into the app home.
        if (event === 'PASSWORD_RECOVERY') return
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null)
          router.replace('/(auth)/sign-in')
        } else if (event === 'SIGNED_IN' && session.user) {
          await loadUser(session.user.id)
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
