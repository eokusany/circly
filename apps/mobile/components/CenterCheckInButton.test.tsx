import { render, fireEvent } from '@testing-library/react-native'
import { CenterCheckInButton } from './CenterCheckInButton'

describe('<CenterCheckInButton />', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    const { getByLabelText } = render(<CenterCheckInButton onPress={onPress} />)
    fireEvent.press(getByLabelText('check in'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders the check-in icon', () => {
    const { getByLabelText } = render(<CenterCheckInButton onPress={() => {}} />)
    expect(getByLabelText('check in')).toBeTruthy()
  })

  it('passes accessibilityState.disabled when accessibilityState.selected is true', () => {
    const { getByLabelText } = render(
      <CenterCheckInButton onPress={() => {}} accessibilityState={{ selected: true }} />,
    )
    const node = getByLabelText('check in')
    expect(node.props.accessibilityState).toEqual({ selected: true })
  })
})
