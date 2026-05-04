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
