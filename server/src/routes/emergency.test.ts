import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

// Chainable query-builder mocks. We overwrite `from()` per test to return
// different fakes depending on which table is being queried.
const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: getUserMock },
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { app } from '../app'

function authedAs(userId = 'rec-1', email = 'rec@example.com') {
  getUserMock.mockResolvedValueOnce({
    data: { user: { id: userId, email } },
    error: null,
  })
}

describe('POST /api/emergency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/emergency')
    expect(res.status).toBe(401)
  })

  it('inserts a notification per active supporter and returns the count', async () => {
    authedAs('rec-1')

    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

    fromMock.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { display_name: 'Sam' },
                  error: null,
                }),
            }),
          }),
        }
      }
      if (table === 'relationships') {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { supporter_id: 'sup-1' },
                    { supporter_id: 'sup-2' },
                  ],
                  error: null,
                }),
            }),
          }),
        }
      }
      if (table === 'notifications') {
        return { insert: insertMock }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/emergency')
      .set('Authorization', 'Bearer valid')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ supporters_notified: 2 })

    expect(insertMock).toHaveBeenCalledTimes(1)
    const rows = insertMock.mock.calls[0][0] as Array<{
      recipient_id: string
      type: string
      payload: { from_display_name: string }
    }>
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      recipient_id: 'sup-1',
      type: 'emergency',
      payload: { from_display_name: 'Sam' },
    })
    expect(rows[1]).toMatchObject({
      recipient_id: 'sup-2',
      type: 'emergency',
      payload: { from_display_name: 'Sam' },
    })
  })

  it('returns supporters_notified: 0 without inserting when there are no supporters', async () => {
    authedAs('rec-1')

    const insertMock = vi.fn()

    fromMock.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { display_name: 'Alex' },
                  error: null,
                }),
            }),
          }),
        }
      }
      if (table === 'relationships') {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }
      if (table === 'notifications') {
        return { insert: insertMock }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/emergency')
      .set('Authorization', 'Bearer valid')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ supporters_notified: 0 })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 500 when the insert fails', async () => {
    authedAs('rec-1')

    fromMock.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { display_name: 'Sam' },
                  error: null,
                }),
            }),
          }),
        }
      }
      if (table === 'relationships') {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data: [{ supporter_id: 'sup-1' }],
                  error: null,
                }),
            }),
          }),
        }
      }
      if (table === 'notifications') {
        return {
          insert: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'boom' } }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const res = await request(app)
      .post('/api/emergency')
      .set('Authorization', 'Bearer valid')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'notification_insert_failed' })
  })
})
