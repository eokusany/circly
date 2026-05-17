jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

import AsyncStorage from '@react-native-async-storage/async-storage'

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
    expect(c.body).toBe('Logged. Have a good one. ✓')
    expect(c.tappable).toBe(false)
    expect(c.tapRoute).toBeUndefined()
  })

  it('returns non-tappable copy for sober', () => {
    const c = confirmationFor('sober')
    expect(c.body).toBe('Logged. One foot in front of the other. ✓')
    expect(c.tappable).toBe(false)
  })

  it('returns tappable copy for struggling that deep-links to chat', () => {
    const c = confirmationFor('struggling')
    expect(c.body).toBe('Logged. Your circle has been notified. Tap to talk →')
    expect(c.tappable).toBe(true)
    expect(c.tapRoute).toBe('/(recovery)/chat')
  })
})

import {
  PENDING_QUEUE_KEY,
  enqueuePending,
  readPending,
  clearPending,
  type PendingCheckIn,
} from './notificationActions'

describe('pending queue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('uses the documented storage key', () => {
    expect(PENDING_QUEUE_KEY).toBe('pending_notification_checkins')
  })

  it('returns an empty list when nothing is queued', async () => {
    expect(await readPending()).toEqual([])
  })

  it('appends a pending entry', async () => {
    const entry: PendingCheckIn = {
      userId: 'user-1',
      status: 'sober',
      checkInDate: '2026-05-05',
    }
    await enqueuePending(entry)
    expect(await readPending()).toEqual([entry])
  })

  it('appends without overwriting existing entries', async () => {
    await enqueuePending({ userId: 'a', status: 'sober', checkInDate: '2026-05-05' })
    await enqueuePending({ userId: 'b', status: 'good_day', checkInDate: '2026-05-05' })
    const queue = await readPending()
    expect(queue).toHaveLength(2)
    expect(queue[1]?.userId).toBe('b')
  })

  it('clears the queue', async () => {
    await enqueuePending({ userId: 'a', status: 'sober', checkInDate: '2026-05-05' })
    await clearPending()
    expect(await readPending()).toEqual([])
  })

  it('returns an empty list when the stored value is corrupted', async () => {
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, 'not-json')
    expect(await readPending()).toEqual([])
  })
})

import { recordNotificationCheckIn } from './notificationActions'

function makeFakeSupabase(behavior: 'ok' | 'error') {
  const upsert = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue(
        behavior === 'ok'
          ? { data: { id: 'row-1' }, error: null }
          : { data: null, error: { message: 'network down' } },
      ),
    }),
  })
  const from = jest.fn().mockReturnValue({ upsert })
  return { from, upsert } as const
}

describe('recordNotificationCheckIn', () => {
  it('upserts a row with status, source=notification, note=null, todays date', async () => {
    const sb = makeFakeSupabase('ok')
    const result = await recordNotificationCheckIn(
      { userId: 'user-1', status: 'sober', todayISO: '2026-05-05' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { supabase: sb as any },
    )
    expect(result).toBe('ok')
    expect(sb.from).toHaveBeenCalledWith('check_ins')
    expect(sb.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        status: 'sober',
        note: null,
        check_in_date: '2026-05-05',
        source: 'notification',
      },
      { onConflict: 'user_id,check_in_date' },
    )
  })

  it('returns "failed" when supabase returns an error', async () => {
    const sb = makeFakeSupabase('error')
    const result = await recordNotificationCheckIn(
      { userId: 'user-1', status: 'good_day', todayISO: '2026-05-05' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { supabase: sb as any },
    )
    expect(result).toBe('failed')
  })

  it('returns "failed" when the call throws', async () => {
    const sb = {
      from: jest.fn().mockImplementation(() => {
        throw new Error('boom')
      }),
    }
    const result = await recordNotificationCheckIn(
      { userId: 'user-1', status: 'good_day', todayISO: '2026-05-05' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { supabase: sb as any },
    )
    expect(result).toBe('failed')
  })
})

import { flushPending } from './notificationActions'

describe('flushPending', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('does nothing when the queue is empty', async () => {
    const sb = makeFakeSupabase('ok')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await flushPending({ supabase: sb as any })
    expect(result).toEqual({ attempted: 0, succeeded: 0, remaining: 0 })
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('clears all entries when every retry succeeds', async () => {
    await enqueuePending({ userId: 'a', status: 'sober', checkInDate: '2026-05-05' })
    await enqueuePending({ userId: 'b', status: 'good_day', checkInDate: '2026-05-05' })
    const sb = makeFakeSupabase('ok')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await flushPending({ supabase: sb as any })
    expect(result).toEqual({ attempted: 2, succeeded: 2, remaining: 0 })
    expect(await readPending()).toEqual([])
  })

  it('keeps failed entries in the queue for next time', async () => {
    await enqueuePending({ userId: 'a', status: 'sober', checkInDate: '2026-05-05' })
    const sb = makeFakeSupabase('error')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await flushPending({ supabase: sb as any })
    expect(result).toEqual({ attempted: 1, succeeded: 0, remaining: 1 })
    expect(await readPending()).toHaveLength(1)
  })
})

import { handleNotificationResponse } from './notificationActions'

describe('handleNotificationResponse', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  function makeResponse(actionIdentifier: string) {
    return { actionIdentifier } as { actionIdentifier: string }
  }

  it('ignores unknown action identifiers (e.g. plain notification tap)', async () => {
    const sb = makeFakeSupabase('ok')
    const fireConfirmation = jest.fn()
    const fireSignedOutPrompt = jest.fn()
    await handleNotificationResponse(makeResponse('default'), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      getUserId: async () => 'user-1',
      todayISO: '2026-05-05',
      fireConfirmation,
      fireSignedOutPrompt,
    })
    expect(sb.from).not.toHaveBeenCalled()
    expect(fireConfirmation).not.toHaveBeenCalled()
    expect(fireSignedOutPrompt).not.toHaveBeenCalled()
  })

  it('writes a check-in row and fires the matching confirmation on success', async () => {
    const sb = makeFakeSupabase('ok')
    const fireConfirmation = jest.fn()
    const fireSignedOutPrompt = jest.fn()
    await handleNotificationResponse(makeResponse('mood-good'), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      getUserId: async () => 'user-1',
      todayISO: '2026-05-05',
      fireConfirmation,
      fireSignedOutPrompt,
    })
    expect(sb.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'good_day', source: 'notification' }),
      { onConflict: 'user_id,check_in_date' },
    )
    expect(fireConfirmation).toHaveBeenCalledWith('good_day')
    expect(await readPending()).toEqual([])
  })

  it('queues the entry and still fires confirmation when supabase fails', async () => {
    const sb = makeFakeSupabase('error')
    const fireConfirmation = jest.fn()
    const fireSignedOutPrompt = jest.fn()
    await handleNotificationResponse(makeResponse('mood-struggling'), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      getUserId: async () => 'user-1',
      todayISO: '2026-05-05',
      fireConfirmation,
      fireSignedOutPrompt,
    })
    const queue = await readPending()
    expect(queue).toEqual([
      { userId: 'user-1', status: 'struggling', checkInDate: '2026-05-05' },
    ])
    expect(fireConfirmation).toHaveBeenCalledWith('struggling')
  })

  it('fires the signed-out prompt when there is no user id', async () => {
    const sb = makeFakeSupabase('ok')
    const fireConfirmation = jest.fn()
    const fireSignedOutPrompt = jest.fn()
    await handleNotificationResponse(makeResponse('mood-okay'), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: sb as any,
      getUserId: async () => null,
      todayISO: '2026-05-05',
      fireConfirmation,
      fireSignedOutPrompt,
    })
    expect(sb.from).not.toHaveBeenCalled()
    expect(fireConfirmation).not.toHaveBeenCalled()
    expect(fireSignedOutPrompt).toHaveBeenCalledTimes(1)
  })
})
