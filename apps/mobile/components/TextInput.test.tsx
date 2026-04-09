import { render, fireEvent } from '@testing-library/react-native'
import { TextInput as RNTextInput } from 'react-native'
import { TextInput } from './TextInput'

describe('<TextInput />', () => {
  it('renders the label when provided', () => {
    const { getByText } = render(
      <TextInput label="email" value="" onChangeText={() => {}} />,
    )
    expect(getByText('email')).toBeTruthy()
  })

  it('does not render a label when omitted', () => {
    const { queryByText } = render(
      <TextInput value="" onChangeText={() => {}} />,
    )
    expect(queryByText('email')).toBeNull()
  })

  it('displays the current value', () => {
    const { UNSAFE_getByType } = render(
      <TextInput value="hello" onChangeText={() => {}} />,
    )
    const input = UNSAFE_getByType(RNTextInput)
    expect(input.props.value).toBe('hello')
  })

  it('calls onChangeText when the user types', () => {
    const onChangeText = jest.fn()
    const { UNSAFE_getByType } = render(
      <TextInput value="" onChangeText={onChangeText} />,
    )
    fireEvent.changeText(UNSAFE_getByType(RNTextInput), 'typed')
    expect(onChangeText).toHaveBeenCalledWith('typed')
  })

  it('passes placeholder through to the native input', () => {
    const { UNSAFE_getByType } = render(
      <TextInput
        value=""
        onChangeText={() => {}}
        placeholder="your name"
      />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.placeholder).toBe('your name')
  })

  it('passes secureTextEntry through', () => {
    const { UNSAFE_getByType } = render(
      <TextInput value="" onChangeText={() => {}} secureTextEntry />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.secureTextEntry).toBe(true)
  })

  it('defaults secureTextEntry to false', () => {
    const { UNSAFE_getByType } = render(
      <TextInput value="" onChangeText={() => {}} />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.secureTextEntry).toBe(false)
  })

  it('defaults autoCapitalize to "none"', () => {
    const { UNSAFE_getByType } = render(
      <TextInput value="" onChangeText={() => {}} />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.autoCapitalize).toBe('none')
  })

  it('accepts autoCapitalize=characters', () => {
    const { UNSAFE_getByType } = render(
      <TextInput
        value=""
        onChangeText={() => {}}
        autoCapitalize="characters"
      />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.autoCapitalize).toBe('characters')
  })

  it('passes keyboardType through', () => {
    const { UNSAFE_getByType } = render(
      <TextInput
        value=""
        onChangeText={() => {}}
        keyboardType="email-address"
      />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.keyboardType).toBe('email-address')
  })

  it('passes maxLength through to the native input', () => {
    const { UNSAFE_getByType } = render(
      <TextInput value="" onChangeText={() => {}} maxLength={6} />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.maxLength).toBe(6)
  })

  it('does not set maxLength when omitted', () => {
    const { UNSAFE_getByType } = render(
      <TextInput value="" onChangeText={() => {}} />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.maxLength).toBeUndefined()
  })

  it('autoCorrect defaults to false', () => {
    const { UNSAFE_getByType } = render(
      <TextInput value="" onChangeText={() => {}} />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.autoCorrect).toBe(false)
  })

  it('autoCorrect can be enabled', () => {
    const { UNSAFE_getByType } = render(
      <TextInput value="" onChangeText={() => {}} autoCorrect />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.autoCorrect).toBe(true)
  })

  it('updates the displayed value when the prop changes', () => {
    const { UNSAFE_getByType, rerender } = render(
      <TextInput value="a" onChangeText={() => {}} />,
    )
    expect(UNSAFE_getByType(RNTextInput).props.value).toBe('a')
    rerender(<TextInput value="ab" onChangeText={() => {}} />)
    expect(UNSAFE_getByType(RNTextInput).props.value).toBe('ab')
  })
})
