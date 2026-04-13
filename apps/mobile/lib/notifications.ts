import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

const OKAY_REMINDER_ID = 'okay-tap-daily'

/**
 * Request notification permissions. Returns true if granted.
 */
export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

/**
 * Schedule a daily "I'm okay" reminder at the given hour and minute.
 * Cancels any existing reminder first so there's only ever one scheduled.
 */
export async function scheduleOkayReminder(hour: number, minute: number): Promise<void> {
  await cancelOkayReminder()

  const granted = await requestPermissions()
  if (!granted) return

  // Set notification handler so it shows when app is foregrounded
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })

  await Notifications.scheduleNotificationAsync({
    identifier: OKAY_REMINDER_ID,
    content: {
      title: 'circly',
      body: "tap to say you're okay — your circle is thinking of you.",
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  })
}

/**
 * Cancel the daily "I'm okay" reminder.
 */
export async function cancelOkayReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(OKAY_REMINDER_ID)
}

/**
 * Parse an "HH:MM" time string into { hour, minute }.
 */
export function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number)
  return { hour: h ?? 9, minute: m ?? 0 }
}
