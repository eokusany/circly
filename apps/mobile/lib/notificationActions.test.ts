import { actionToStatus, NOTIFICATION_CATEGORY_ID } from './notificationActions'

describe('actionToStatus', () => {
  it('maps mood-good to good_day', () => {
    expect(actionToStatus('mood-good')).toBe('good_day')
  })

  it('maps mood-okay to sober', () => {
    expect(actionToStatus('mood-okay')).toBe('sober')
  })

  it('maps mood-struggling to struggling', () => {
    expect(actionToStatus('mood-struggling')).toBe('struggling')
  })

  it('returns null for unknown identifiers', () => {
    expect(actionToStatus('mood-bogus')).toBeNull()
    expect(actionToStatus('default')).toBeNull()
    expect(actionToStatus('')).toBeNull()
  })
})

describe('NOTIFICATION_CATEGORY_ID', () => {
  it('is the stable category identifier used at registration and on the schedule', () => {
    expect(NOTIFICATION_CATEGORY_ID).toBe('daily-checkin')
  })
})
