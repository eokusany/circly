import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { api } from '../lib/api'

/**
 * Registers for push notifications and sends the token to the server.
 * Call once when the user is authenticated.
 */
export function usePushToken(userId: string | undefined) {
  const registered = useRef(false)

  useEffect(() => {
    if (!userId || registered.current) return
    if (Platform.OS === 'web') return

    ;(async () => {
      const { status: existing } = await Notifications.getPermissionsAsync()
      let finalStatus = existing

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') return

      const projectId = Constants.expoConfig?.extra?.eas?.projectId
      const tokenData = await Notifications.getExpoPushTokenAsync({
        ...(projectId ? { projectId } : {}),
      })
      const token = tokenData.data

      try {
        await api('/api/push-token', {
          method: 'POST',
          body: JSON.stringify({ token }),
        })
        registered.current = true
      } catch {
        // Best-effort; will retry next app launch
      }
    })()
  }, [userId])
}
