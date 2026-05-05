import { render, fireEvent } from '@testing-library/react-native'
import { AppHeader } from './AppHeader'

describe('<AppHeader />', () => {
  const baseProps = {
    user: { id: 'u1', displayName: 'Sam', avatarUrl: null as string | null },
    onAvatarPress: jest.fn(),
  }

  beforeEach(() => baseProps.onAvatarPress.mockReset())

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

  it('renders the messages icon button when onMessagesPress is provided', () => {
    const onMessagesPress = jest.fn()
    const { getByLabelText } = render(
      <AppHeader {...baseProps} onMessagesPress={onMessagesPress} />,
    )
    fireEvent.press(getByLabelText('open messages'))
    expect(onMessagesPress).toHaveBeenCalledTimes(1)
  })

  it('renders the SOS button when onSosPress is provided', () => {
    const onSosPress = jest.fn()
    const { getByLabelText } = render(
      <AppHeader {...baseProps} onSosPress={onSosPress} />,
    )
    fireEvent.press(getByLabelText('alert your supporters'))
    expect(onSosPress).toHaveBeenCalledTimes(1)
  })

  it('omits the SOS button when onSosPress is undefined', () => {
    const { queryByLabelText } = render(<AppHeader {...baseProps} />)
    expect(queryByLabelText('alert your supporters')).toBeNull()
  })
})
