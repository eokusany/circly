import { render } from '@testing-library/react-native'
import { StreakCard } from './StreakCard'

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

const nextWeek = { days: 7, label: '1 week', type: '7d' as const }

describe('<StreakCard />', () => {
  it('renders streak number and DAYS SOBER label', () => {
    const { getByText } = render(
      <StreakCard
        days={5}
        next={nextWeek}
        streakLabel="Days Sober"
        showResetChip={false}
        dayOfYear={1}
      />
    )
    expect(getByText('5')).toBeTruthy()
    expect(getByText('DAYS SOBER')).toBeTruthy()
  })

  it('pill renders correct phrasing (days to, not days until)', () => {
    const { queryByText, getAllByText } = render(
      <StreakCard
        days={5}
        next={nextWeek}
        streakLabel="Days Sober"
        showResetChip={false}
        dayOfYear={1}
      />
    )
    // "days until" should not appear
    expect(queryByText(/days until/i)).toBeNull()
    // "days to" should appear in the pill text
    const allText = getAllByText(/days to/i)
    expect(allText.length).toBeGreaterThan(0)
  })

  it('renders an encouragement line', () => {
    const { getByText } = render(
      <StreakCard
        days={5}
        next={nextWeek}
        streakLabel="Days Sober"
        showResetChip={false}
        dayOfYear={0}
      />
    )
    // dayOfYear=0 picks lines[0] = "You showed up today."
    expect(getByText('You showed up today.')).toBeTruthy()
  })

  it('overflow fallback — renders 1000 without crashing', () => {
    const { getByText } = render(
      <StreakCard
        days={1000}
        next={null}
        streakLabel="Days Sober"
        showResetChip={false}
        dayOfYear={1}
      />
    )
    expect(getByText('1000')).toBeTruthy()
  })
})
