import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { TodayCheckInCard } from './TodayCheckInCard'
import * as checkInsLib from '../../lib/checkIns'
import { router } from 'expo-router'
import { Colors } from '../../constants/colors'
import type { AppUser } from '../../store/auth'

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, style }: { children: React.ReactNode; style?: object }) => {
    const { View } = jest.requireActual('react-native')
    return <View style={style}>{children}</View>
  },
}))
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }))
jest.mock('../../lib/checkIns', () => ({
  loadTodayCheckIn: jest.fn(),
  saveTodayCheckIn: jest.fn(),
}))
jest.mock('../../lib/haptics', () => ({ tapLight: jest.fn(), tapMedium: jest.fn() }))
jest.mock('../../lib/sentry', () => ({
  Sentry: { captureException: jest.fn() },
}))

const mockUser: AppUser = {
  id: 'u1',
  email: 'u1@example.com',
  displayName: 'u1',
  avatarUrl: null,
  role: 'recovery',
  context: 'recovery',
  sobrietyStartDate: null,
  firstCheckinIntroSeen: true,
  firstCheckinCelebrationSeen: true,
}

jest.mock('../../store/auth', () => ({
  useAuthStore: (sel: (state: { user: AppUser }) => unknown) => sel({ user: mockUser }),
}))

const loadMock = checkInsLib.loadTodayCheckIn as jest.MockedFunction<typeof checkInsLib.loadTodayCheckIn>
const saveMock = checkInsLib.saveTodayCheckIn as jest.MockedFunction<typeof checkInsLib.saveTodayCheckIn>

describe('<TodayCheckInCard />', () => {
  beforeEach(() => {
    loadMock.mockReset()
    saveMock.mockReset()
    ;(router.replace as jest.Mock).mockReset()
    mockUser.firstCheckinIntroSeen = true
    mockUser.firstCheckinCelebrationSeen = true
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

  it('saves note on blur with existing row', async () => {
    loadMock.mockResolvedValueOnce({
      id: 'r1', status: 'sober', note: 'old note', check_in_date: '2026-05-05',
    })
    saveMock.mockResolvedValueOnce({
      id: 'r1', status: 'sober', note: 'new note', check_in_date: '2026-05-05',
    })
    const { findByText, findByPlaceholderText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    // expand from collapsed state
    const editBtn = await findByText(/edit/i)
    await act(async () => { fireEvent.press(editBtn) })
    const textInput = await findByPlaceholderText('anything on your mind? (optional)')
    await act(async () => { fireEvent.changeText(textInput, 'new note') })
    await act(async () => { fireEvent(textInput, 'blur') })
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith({
      userId: 'u1', status: 'sober', note: 'new note',
    }))
  })

  it('redirects to first-checkin-intro when firstCheckinIntroSeen is false and no row', async () => {
    mockUser.firstCheckinIntroSeen = false
    loadMock.mockResolvedValueOnce(null)
    const { findByLabelText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    const chip = await findByLabelText('chip-sober')
    await act(async () => { fireEvent.press(chip) })
    expect(router.replace).toHaveBeenCalledWith('/(recovery)/first-checkin-intro')
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('redirects to first-checkin-celebration on first ever save when celebration not seen', async () => {
    mockUser.firstCheckinCelebrationSeen = false
    loadMock.mockResolvedValueOnce(null)
    saveMock.mockResolvedValueOnce({
      id: 'r1', status: 'good_day', note: null, check_in_date: '2026-05-05',
    })
    const { findByLabelText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    const chip = await findByLabelText('chip-good_day')
    await act(async () => { fireEvent.press(chip) })
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(recovery)/first-checkin-celebration'))
    expect(saveMock).toHaveBeenCalled()
  })

  it('shows an alert and keeps editor open when saveTodayCheckIn rejects', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    loadMock.mockResolvedValueOnce(null)
    saveMock.mockRejectedValueOnce(new Error('network error'))
    const { findByLabelText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    const chip = await findByLabelText('chip-sober')
    await act(async () => { fireEvent.press(chip) })
    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
    // chip is still rendered — editor did not collapse
    expect(await findByLabelText('chip-sober')).toBeTruthy()
    alertSpy.mockRestore()
  })

  it('good_day chip uses sage success colors when it is the current status', async () => {
    // Load an existing good_day row — chip should render with sage colors immediately
    loadMock.mockResolvedValueOnce({
      id: 'r1', status: 'good_day', note: null, check_in_date: '2026-05-05',
    })
    const { findByText, findByLabelText } = render(<TodayCheckInCard onSaved={jest.fn()} />)
    // wait for collapsed state, then expand to see chips
    const editBtn = await findByText(/edit/i)
    await act(async () => { fireEvent.press(editBtn) })
    const goodChip = await findByLabelText('chip-good_day')
    const chipStyle = goodChip.props.style
    const flatStyle = Array.isArray(chipStyle) ? Object.assign({}, ...chipStyle) : chipStyle
    // sage at low alpha background
    expect(flatStyle.backgroundColor).toBe('rgba(125,184,150,0.10)')
    // sage at medium alpha border
    expect(flatStyle.borderColor).toBe('rgba(125,184,150,0.30)')
    // confirm the token value itself
    expect(Colors.dark.success).toBe('#7DB896')
  })
})
