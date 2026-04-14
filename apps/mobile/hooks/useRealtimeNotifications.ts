import { useEffect, useRef } from 'react'
import { Alert, Vibration } from 'react-native'
import { supabase } from '../lib/supabase'
import { useNotificationStore } from '../store/notifications'
import { playEmergencySound } from '../lib/sounds'
import { notifySuccess } from '../lib/haptics'

/**
 * Subscribes to realtime notifications for the given user.
 * Handles badge count, emergency alerts with sound/vibration, and haptics.
 */
export function useRealtimeNotifications(userId: string | undefined) {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)
  const increment = useNotificationStore((s) => s.increment)
  const channelRef = useRef(0)

  useEffect(() => {
    if (!userId) return

    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null)
      .then(({ count }) => setUnreadCount(count ?? 0))

    const channelName = `layout-notifications-${++channelRef.current}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as { type?: string; payload?: { from_display_name?: string } }
          increment()

          if (newNotif.type === 'emergency') {
            playEmergencySound()
            Vibration.vibrate([0, 500, 200, 500, 200, 500])
            const name = newNotif.payload?.from_display_name ?? 'someone'
            Alert.alert('emergency', `${name} needs support right now.`)
          } else {
            notifySuccess()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, increment, setUnreadCount])
}
