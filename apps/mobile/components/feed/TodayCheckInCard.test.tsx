import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { TodayCheckInCard } from './TodayCheckInCard'
import * as checkInsLib from '../../lib/checkIns'
import { router } from 'expo-router'

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }))
jest.mock('../../lib/checkIns', () => ({
  loadTodayCheckIn: jest.fn(),
  saveTodayCheckIn: jest.fn(),
}))
jest.mock('../../lib/haptics', () => ({ tapLight: jest.fn(), tapMedium: jest.fn() }))
jest.mock('../../store/auth', () => ({
  useAuthStore: (sel: any) =>
    sel({
      user: {
        id: 'u1',
        context: 'recovery',
        firstCheckinIntroSeen: true,
        firstCheckinCelebrationSeen: true,
      },
    }),
}))

const loadMock = checkInsLib.loadTodayCheckIn as jest.MockedFunction<typeof checkInsLib.loadTodayCheckIn>
const saveMock = checkInsLib.saveTodayCheckIn as jest.MockedFunction<typeof checkInsLib.saveTodayCheckIn>

describe('<TodayCheckInCard />', () => {
  beforeEach(() => {
    loadMock.mockReset()
    saveMock.mockReset()
    ;(router.replace as jest.Mock).mockReset()
  })

  it('renders all three status chips when no row exists', async () => {
    loadMock.mockResolvedValueOnce(null)
    const { findByLabelText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    expect(await findByLabelText('chip-good_day')).toBeTruthy()
    expect(await findByLabelText('chip-sober')).toBeTruthy()
    expect(await findByLabelText('chip-struggling')).toBeTruthy()
  })

  it('saves when a chip is tapped and notifies parent via onSaved', async () => {
    loadMock.mockResolvedValueOnce(null)
    saveMock.mockResolvedValueOnce({
      id: 'r1', status: 'sober', note: null, check_in_date: '2026-05-05',
    })
    const onSaved = jest.fn()
    const { findByLabelText } = render(<TodayCheckInCard onSaved={onSaved} />)
    const chip = await findByLabelText('chip-sober')
    await act(async () => { fireEvent.press(chip) })
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith({
      userId: 'u1', status: 'sober', note: '',
    }))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ status: 'sober' }))
  })

  it('collapses to a summary once a row exists', async () => {
    loadMock.mockResolvedValueOnce({
      id: 'r1', status: 'good_day', note: null, check_in_date: '2026-05-05',
    })
    const { findByText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    expect(await findByText(/today: good day/i)).toBeTruthy()
  })

  it('expands the summary back into the editor when tapped', async () => {
    loadMock.mockResolvedValueOnce({
      id: 'r1', status: 'sober', note: null, check_in_date: '2026-05-05',
    })
    const { findByLabelText, findByText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    fireEvent.press(await findByText(/edit/i))
    expect(await findByLabelText('chip-sober')).toBeTruthy()
  })
})
