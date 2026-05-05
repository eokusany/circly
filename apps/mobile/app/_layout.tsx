import { useEffect, useCallback, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme, AppState, type AppStateStatus } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'
import * as Notifications from 'expo-notifications'
import { initSentry } from '../lib/sentry'
import {
  registerDailyCheckinCategory,
  setupNotificationResponseListener,
  flushPendingNotificationCheckins,
} from '../lib/notifications'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { supabase } from '../lib/supabase'
import { Colors } from '../constants/colors'

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
        .select('id, email, display_name, avatar_url, role, context, profiles(sobriety_start_date, first_checkin_intro_seen, first_checkin_celebration_seen, supporter_first_run_seen, last_milestone_celebrated_days, last_milestone_celebrated_checkins)')
        .eq('id', userId)
        .single<{
          id: string
          email: string
          display_name: string
          avatar_url: string | null
          role: UserRole
          context: AppContext | null
          profiles: {
            sobriety_start_date: string | null
            first_checkin_intro_seen: boolean | null
            first_checkin_celebration_seen: boolean | null
            supporter_first_run_seen: boolean | null
            last_milestone_celebrated_days: number | null
            last_milestone_celebrated_checkins: number | null
          } | null
        }>()

      if (data) {
        const sobrietyStartDate = data.profiles?.sobriety_start_date ?? null
        setUser({
          id: data.id,
          email: data.email,
          displayName: data.display_name,
          avatarUrl: data.avatar_url ?? null,
          role: data.role,
          context: data.context,
          sobrietyStartDate,
          firstCheckinIntroSeen: data.profiles?.first_checkin_intro_seen ?? false,
          firstCheckinCelebrationSeen: data.profiles?.first_checkin_celebration_seen ?? false,
          supporterFirstRunSeen: data.profiles?.supporter_first_run_seen ?? false,
          lastMilestoneCelebratedDays: data.profiles?.last_milestone_celebrated_days ?? 0,
          lastMilestoneCelebratedCheckins: data.profiles?.last_milestone_celebrated_checkins ?? 0,
        })
        setLoading(false)
        if (data.role === 'recovery' && data.context === 'recovery' && !sobrietyStartDate) {
          router.replace('/(auth)/sobriety-start')
        } else {
          router.replace(roleHome(data.role))
        }
      } else {
        setLoading(false)
        router.replace('/(auth)/account-select')
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

  const themeBg = Colors[scheme ?? 'light'].background

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(themeBg)
  }, [themeBg])

  useEffect(() => {
    void registerDailyCheckinCategory()
    const listener = setupNotificationResponseListener()
    void flushPendingNotificationCheckins()

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void flushPendingNotificationCheckins()
      }
    }
    const sub = AppState.addEventListener('change', onChange)

    return () => {
      listener.remove()
      sub.remove()
    }
  }, [])

  return (
    <ErrorBoundary>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: themeBg },
        }}
      />
    </ErrorBoundary>
  )
}

function roleHome(role: UserRole): string {
  switch (role) {
    case 'recovery': return '/(recovery)'
    case 'supporter': return '/(supporter)'
  }
}
