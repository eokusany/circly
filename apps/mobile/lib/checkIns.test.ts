import { loadTodayCheckIn, saveTodayCheckIn } from './checkIns'
import { supabase } from './supabase'
import { toISODate } from './streak'

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }))

describe('checkIns lib', () => {
  const todayISO = toISODate(new Date())

  it('loadTodayCheckIn queries the row for the user/date and returns it', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: 'r1', status: 'sober', note: 'hi', check_in_date: todayISO },
      error: null,
    })
    const eq2 = jest.fn().mockReturnValue({ maybeSingle })
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 })
    const select = jest.fn().mockReturnValue({ eq: eq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ select })

    const row = await loadTodayCheckIn('user-1')

    expect(supabase.from).toHaveBeenCalledWith('check_ins')
    expect(select).toHaveBeenCalledWith('id, status, note, check_in_date')
    expect(eq1).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eq2).toHaveBeenCalledWith('check_in_date', todayISO)
    expect(row).toEqual({ id: 'r1', status: 'sober', note: 'hi', check_in_date: todayISO })
  })

  it('saveTodayCheckIn upserts with the conflict target and returns the row', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id: 'r2', status: 'good_day', note: null, check_in_date: todayISO },
      error: null,
    })
    const select = jest.fn().mockReturnValue({ single })
    const upsert = jest.fn().mockReturnValue({ select })
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    const row = await saveTodayCheckIn({ userId: 'user-1', status: 'good_day', note: '' })

    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        status: 'good_day',
        note: null,
        check_in_date: todayISO,
        source: 'in_app',
      },
      { onConflict: 'user_id,check_in_date' },
    )
    expect(select).toHaveBeenCalledWith('id, status, note, check_in_date')
    expect(row).toEqual({ id: 'r2', status: 'good_day', note: null, check_in_date: todayISO })
  })

  it('saveTodayCheckIn throws when supabase returns an error', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'bad' } })
    const select = jest.fn().mockReturnValue({ single })
    const upsert = jest.fn().mockReturnValue({ select })
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    await expect(
      saveTodayCheckIn({ userId: 'user-1', status: 'sober', note: 'x' }),
    ).rejects.toThrow('bad')
  })
})
