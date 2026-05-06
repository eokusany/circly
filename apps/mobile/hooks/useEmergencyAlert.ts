import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { api, ApiError } from '../lib/api'
import { notifyWarning } from '../lib/haptics'

export interface UseEmergencyAlertResult {
  trigger: () => Promise<void>
  sending: boolean
}

export function useEmergencyAlert(): UseEmergencyAlertResult {
  const [sending, setSending] = useState(false)

  const trigger = useCallback(async () => {
    notifyWarning()
    setSending(true)
    try {
      const result = await api<{ supporters_notified: number }>(
        '/api/emergency',
        { method: 'POST' },
      )
      if (result.supporters_notified === 0) {
        Alert.alert(
          'no supporters yet',
          'add someone to your circle so they can be there for you.',
        )
      } else {
        Alert.alert(
          'your supporters have been notified',
          `${result.supporters_notified} ${
            result.supporters_notified === 1 ? 'person has' : 'people have'
          } been alerted.`,
        )
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? 'something went wrong. please try again.'
          : 'check your connection and try again.'
      Alert.alert('could not send alert', message)
    } finally {
      setSending(false)
    }
  }, [])

  return { trigger, sending }
}
