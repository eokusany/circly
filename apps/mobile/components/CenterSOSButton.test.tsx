import { render, fireEvent, act } from '@testing-library/react-native'
import { CenterSOSButton } from './CenterSOSButton'

describe('<CenterSOSButton />', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers() })

  it('renders an accessible SOS label', () => {
    const { getByLabelText } = render(<CenterSOSButton onArmed={jest.fn()} />)
    expect(getByLabelText('hold to alert your supporters')).toBeTruthy()
  })

  it('does not fire onArmed on a brief tap', () => {
    const onArmed = jest.fn()
    const { getByLabelText } = render(<CenterSOSButton onArmed={onArmed} />)
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressIn')
    act(() => { jest.advanceTimersByTime(200) })
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressOut')
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onArmed).not.toHaveBeenCalled()
  })

  it('fires onArmed once when held for the full 1500ms', () => {
    const onArmed = jest.fn()
    const { getByLabelText } = render(<CenterSOSButton onArmed={onArmed} />)
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressIn')
    act(() => { jest.advanceTimersByTime(1600) })
    expect(onArmed).toHaveBeenCalledTimes(1)
  })

  it('cancels if released before the full hold duration', () => {
    const onArmed = jest.fn()
    const { getByLabelText } = render(<CenterSOSButton onArmed={onArmed} />)
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressIn')
    act(() => { jest.advanceTimersByTime(1000) })
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressOut')
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onArmed).not.toHaveBeenCalled()
  })

  it('does not double-fire if pressIn is dispatched while already armed', () => {
    const onArmed = jest.fn()
    const { getByLabelText } = render(<CenterSOSButton onArmed={onArmed} />)
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressIn')
    act(() => { jest.advanceTimersByTime(1600) })
    fireEvent(getByLabelText('hold to alert your supporters'), 'pressIn')
    act(() => { jest.advanceTimersByTime(1600) })
    expect(onArmed).toHaveBeenCalledTimes(1)
  })
})
