import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { NOTIFICATION_CATEGORY_ID } from './notificationActions'

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

  await Notifications.scheduleNotificationAsync({
    identifier: OKAY_REMINDER_ID,
    content: {
      title: 'circly',
      body: "how's today going? tap below to check in.",
      categoryIdentifier: NOTIFICATION_CATEGORY_ID,
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

export async function registerDailyCheckinCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
    {
      identifier: 'mood-good',
      buttonTitle: 'good',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'mood-okay',
      buttonTitle: 'okay',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'mood-struggling',
      buttonTitle: 'struggling',
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ])
}

import { confirmationFor, type CheckInStatus } from './notificationActions'

const CONFIRM_ID = 'okay-tap-confirm'

export async function fireCheckinConfirmation(status: CheckInStatus): Promise<void> {
  const copy = confirmationFor(status)
  await Notifications.scheduleNotificationAsync({
    identifier: CONFIRM_ID,
    content: {
      title: 'circly',
      body: copy.body,
      data: copy.tapRoute ? { tapRoute: copy.tapRoute } : {},
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: null,
  })
}

import { router } from 'expo-router'
import { supabase } from './supabase'
import { toISODate } from './streak'
import {
  flushPending,
  handleNotificationResponse,
  type NotificationResponseLike,
} from './notificationActions'

const SIGNED_OUT_ID = 'okay-tap-signed-out'

async function fireSignedOutPrompt(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: SIGNED_OUT_ID,
    content: {
      title: 'circly',
      body: 'open the app to check in',
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: null,
  })
}

async function getCachedUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT'

// Allowlist of routes that may be opened from a notification tap. Push
// payloads are server-supplied; without this list a compromised or malicious
// server could deep-link into any screen, including ones that perform actions.
const ALLOWED_TAP_ROUTES = new Set<string>([
  '/(recovery)/chat',
  '/(recovery)/notifications',
  '/(recovery)/index',
  '/(supporter)/index',
  '/(supporter)/notifications',
])

export function setupNotificationResponseListener(): { remove: () => void } {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    // Plain notification tap on a confirmation that carries a deep-link payload
    // (currently only the struggling confirmation): route the user there.
    if (response.actionIdentifier === DEFAULT_ACTION) {
      const data = response.notification.request.content.data as
        | { tapRoute?: string }
        | undefined
      if (data?.tapRoute && ALLOWED_TAP_ROUTES.has(data.tapRoute)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(data.tapRoute as any)
      }
      return
    }

    void handleNotificationResponse(response as NotificationResponseLike, {
      supabase,
      getUserId: getCachedUserId,
      todayISO: toISODate(new Date()),
      fireConfirmation: fireCheckinConfirmation,
      fireSignedOutPrompt,
    })
  })
  return { remove: () => sub.remove() }
}

export async function flushPendingNotificationCheckins(): Promise<void> {
  await flushPending({ supabase })
}
