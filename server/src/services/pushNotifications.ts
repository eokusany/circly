import { supabase } from '../lib/supabase'

interface ExpoPushMessage {
  to: string
  title?: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  channelId?: string
}

interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

/**
 * Send push notifications via Expo's push API.
 */
async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return []

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN && {
        Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
      }),
    },
    body: JSON.stringify(messages),
  })

  const json = (await res.json()) as { data: ExpoPushTicket[] }
  return json.data
}

interface NotificationPayload {
  type: string
  payload: Record<string, unknown>
}

const TITLE_MAP: Record<string, string> = {
  encouragement: 'circly',
  silence_nudge: 'circly',
  emergency: 'circly - emergency',
  warm_ping: 'circly',
  message: 'circly',
  milestone: 'circly',
}

const BODY_MAP: Record<string, (p: Record<string, unknown>) => string> = {
  encouragement: (p) => `${p.from_display_name ?? 'someone'} sent you support`,
  silence_nudge: (p) => `${p.from_display_name ?? 'someone in your circle'} hasn't checked in. let them know you're here.`,
  emergency: (p) => `${p.from_display_name ?? 'someone'} needs support right now`,
  warm_ping: (p) => `${p.from_display_name ?? 'someone'} is with you`,
  message: () => 'you have a new message',
  milestone: () => 'you reached a new milestone!',
}

/**
 * Send push notifications to a list of user IDs.
 * Looks up their push tokens and sends via Expo.
 */
export async function sendPushToUsers(
  recipientIds: string[],
  notification: NotificationPayload,
): Promise<void> {
  if (recipientIds.length === 0) return

  let tokens: { token: string }[] | null = null
  try {
    const result = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', recipientIds)
    tokens = result.data as { token: string }[] | null
  } catch {
    return
  }

  if (!tokens || tokens.length === 0) return

  const title = TITLE_MAP[notification.type] ?? 'circly'
  const bodyFn = BODY_MAP[notification.type]
  const body = bodyFn ? bodyFn(notification.payload) : 'you have a new notification'

  const messages: ExpoPushMessage[] = tokens.map((t: { token: string }) => ({
    to: t.token,
    title,
    body,
    sound: 'default',
    data: { type: notification.type, ...notification.payload },
  }))

  try {
    await sendExpoPush(messages)
  } catch {
    // Push delivery is best-effort; don't fail the request
    console.error('[push] failed to send push notifications')
  }
}
