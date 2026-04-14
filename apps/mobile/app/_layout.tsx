import { useEffect, useCallback, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import { initSentry } from '../lib/sentry'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { supabase } from '../lib/supabase'

initSentry()

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})
import { useAuthStore } from '../store/auth'
import type { AppContext, UserRole } from '../store/auth'

SplashScreen.preventAutoHideAsync()

const SPLASH_DURATION = 1800

export default function RootLayout() {
  const scheme = useColorScheme()
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)
  const initialRouteComplete = useRef(false)

  const loadUser = useCallback(async (userId: string) => {
    try {
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
        if (data.role === 'recovery' && data.context === 'recovery' && !sobrietyStartDate) {
          router.replace('/(auth)/sobriety-start')
        } else {
          router.replace(roleHome(data.role))
        }
      } else {
        setLoading(false)
        router.replace('/(auth)/context-select')
      }
    } catch {
      setLoading(false)
      router.replace('/(auth)/sign-in')
    }
  }, [setUser, setLoading])

  useEffect(() => {
    const splashStart = Date.now()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Hide system splash so branded splash (index.tsx) is visible
      SplashScreen.hideAsync()

      // Wait remaining splash duration so the logo is seen
      const elapsed = Date.now() - splashStart
      const remaining = Math.max(0, SPLASH_DURATION - elapsed)
      await new Promise((r) => setTimeout(r, remaining))

      initialRouteComplete.current = true

      if (session?.user) {
        await loadUser(session.user.id)
      } else {
        setLoading(false)
        router.replace('/(auth)/sign-in')
      }
    }).catch(() => {
      SplashScreen.hideAsync()
      setLoading(false)
      router.replace('/(auth)/sign-in')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') return
        // Ignore auth events until the initial splash route is done
        if (!initialRouteComplete.current) return
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null)
          router.replace('/(auth)/sign-in')
        } else if (event === 'TOKEN_REFRESHED' && session.user) {
          // Token was refreshed — no navigation needed, just keep going
        } else if (event === 'SIGNED_IN' && session.user) {
          await loadUser(session.user.id)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadUser, setLoading, setUser])

  return (
    <ErrorBoundary>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </ErrorBoundary>
  )
}

function roleHome(role: UserRole): string {
  switch (role) {
    case 'recovery': return '/(recovery)'
    case 'supporter': return '/(supporter)'
  }
}
