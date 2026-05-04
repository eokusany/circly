export const NOTIFICATION_CATEGORY_ID = 'daily-checkin'

export type CheckInStatus = 'good_day' | 'sober' | 'struggling'

const ACTION_TO_STATUS: Record<string, CheckInStatus> = {
  'mood-good': 'good_day',
  'mood-okay': 'sober',
  'mood-struggling': 'struggling',
}

export function actionToStatus(actionIdentifier: string): CheckInStatus | null {
  return ACTION_TO_STATUS[actionIdentifier] ?? null
}

export interface ConfirmationCopy {
  body: string
  tappable: boolean
  tapRoute?: string
}

const CONFIRMATIONS: Record<CheckInStatus, ConfirmationCopy> = {
  good_day: {
    body: 'logged. have a good one. ✓',
    tappable: false,
  },
  sober: {
    body: 'logged. one foot in front of the other. ✓',
    tappable: false,
  },
  struggling: {
    body: 'logged. your circle has been notified. tap to talk →',
    tappable: true,
    tapRoute: '/(recovery)/chat',
  },
}

export function confirmationFor(status: CheckInStatus): ConfirmationCopy {
  return CONFIRMATIONS[status]
}
