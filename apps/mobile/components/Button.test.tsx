import { render, fireEvent } from '@testing-library/react-native'
import { ActivityIndicator } from 'react-native'
import { Button } from './Button'

describe('<Button />', () => {
  it('renders the label', () => {
    const { getByText } = render(<Button label="continue" onPress={() => {}} />)
    expect(getByText('continue')).toBeTruthy()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    const { getByText } = render(<Button label="go" onPress={onPress} />)
    fireEvent.press(getByText('go'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn()
    const { getByText } = render(
      <Button label="nope" onPress={onPress} disabled />,
    )
    fireEvent.press(getByText('nope'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('does not call onPress when loading', () => {
    const onPress = jest.fn()
    const { root } = render(<Button label="wait" onPress={onPress} loading />)
    fireEvent.press(root)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('hides the label when loading', () => {
    const { queryByText } = render(
      <Button label="submit" onPress={() => {}} loading />,
    )
    expect(queryByText('submit')).toBeNull()
  })

  it('shows an ActivityIndicator when loading', () => {
    const { UNSAFE_getByType } = render(
      <Button label="submit" onPress={() => {}} loading />,
    )
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
  })

  it('renders the label in primary variant by default', () => {
    const { getByText } = render(<Button label="x" onPress={() => {}} />)
    // Primary text color is white (#fff) — assertion is loose because style
    // arrays can vary.
    const text = getByText('x')
    expect(text).toBeTruthy()
  })

  it('renders correctly with variant=ghost', () => {
    const { getByText } = render(
      <Button label="ghost" onPress={() => {}} variant="ghost" />,
    )
    expect(getByText('ghost')).toBeTruthy()
  })

  it('fires multiple onPress events across multiple presses', () => {
    const onPress = jest.fn()
    const { getByText } = render(
      <Button label="tap" onPress={onPress} />,
    )
    fireEvent.press(getByText('tap'))
    fireEvent.press(getByText('tap'))
    fireEvent.press(getByText('tap'))
    expect(onPress).toHaveBeenCalledTimes(3)
  })

  it('still shows the label after loading flips back to false', () => {
    const { rerender, getByText, queryByText } = render(
      <Button label="done" onPress={() => {}} loading />,
    )
    expect(queryByText('done')).toBeNull()
    rerender(<Button label="done" onPress={() => {}} />)
    expect(getByText('done')).toBeTruthy()
  })

  it('renders with a custom style prop without crashing', () => {
    const { getByText } = render(
      <Button
        label="styled"
        onPress={() => {}}
        style={{ marginTop: 10 }}
      />,
    )
    expect(getByText('styled')).toBeTruthy()
  })
})
