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

import { confirmationFor } from './notificationActions'

describe('confirmationFor', () => {
  it('returns non-tappable copy for good_day', () => {
    const c = confirmationFor('good_day')
    expect(c.body).toBe('logged. have a good one. ✓')
    expect(c.tappable).toBe(false)
    expect(c.tapRoute).toBeUndefined()
  })

  it('returns non-tappable copy for sober', () => {
    const c = confirmationFor('sober')
    expect(c.body).toBe('logged. one foot in front of the other. ✓')
    expect(c.tappable).toBe(false)
  })

  it('returns tappable copy for struggling that deep-links to chat', () => {
    const c = confirmationFor('struggling')
    expect(c.body).toBe('logged. your circle has been notified. tap to talk →')
    expect(c.tappable).toBe(true)
    expect(c.tapRoute).toBe('/(recovery)/chat')
  })
})
