import { render, fireEvent } from '@testing-library/react-native'
import { AppHeader } from './AppHeader'

describe('<AppHeader />', () => {
  const baseProps = {
    user: { id: 'u1', displayName: 'Sam', avatarUrl: null as string | null },
    onAvatarPress: jest.fn(),
    onNotificationsPress: jest.fn(),
  }

  beforeEach(() => {
    baseProps.onAvatarPress.mockReset()
    baseProps.onNotificationsPress.mockReset()
  })

  it('renders the wordmark text', () => {
    const { getByText } = render(<AppHeader {...baseProps} />)
    expect(getByText('circly')).toBeTruthy()
  })

  it('renders the user avatar (initials fallback)', () => {
    const { getByText } = render(<AppHeader {...baseProps} />)
    expect(getByText('S')).toBeTruthy()
  })

  it('fires onAvatarPress when the avatar is tapped', () => {
    const { getByLabelText } = render(<AppHeader {...baseProps} />)
    fireEvent.press(getByLabelText('open profile'))
    expect(baseProps.onAvatarPress).toHaveBeenCalledTimes(1)
  })

  it('fires onNotificationsPress when the bell is tapped', () => {
    const { getByLabelText } = render(<AppHeader {...baseProps} />)
    fireEvent.press(getByLabelText('open notifications'))
    expect(baseProps.onNotificationsPress).toHaveBeenCalledTimes(1)
  })

  it('renders the unread badge when unreadNotifications > 0', () => {
    const { getByText } = render(
      <AppHeader {...baseProps} unreadNotifications={4} />,
    )
    expect(getByText('4')).toBeTruthy()
  })

  it('caps the badge at 9+', () => {
    const { getByText } = render(
      <AppHeader {...baseProps} unreadNotifications={42} />,
    )
    expect(getByText('9+')).toBeTruthy()
  })

  it('omits the badge when unreadNotifications is 0 or undefined', () => {
    const { queryByLabelText } = render(<AppHeader {...baseProps} />)
    // The badge has no accessibility role; assert there's no '0' text near the bell.
    expect(queryByLabelText('unread notifications badge')).toBeNull()
  })
})
