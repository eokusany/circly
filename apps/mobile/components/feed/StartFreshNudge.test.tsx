import { render, fireEvent } from '@testing-library/react-native'
import { StartFreshNudge } from './StartFreshNudge'
import { router } from 'expo-router'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

describe('<StartFreshNudge />', () => {
  beforeEach(() => (router.push as jest.Mock).mockReset())

  it('renders the prompt and pushes to start-fresh on press', () => {
    const { getByText, getByLabelText } = render(<StartFreshNudge />)
    expect(getByText(/need a fresh start/i)).toBeTruthy()
    fireEvent.press(getByLabelText('start fresh'))
    expect(router.push).toHaveBeenCalledWith('/(recovery)/start-fresh')
  })
})
