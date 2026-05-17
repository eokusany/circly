import { render } from '@testing-library/react-native'
import { DailyPulseCard } from './DailyPulseCard'

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, style }: { children: React.ReactNode; style?: object }) => {
    const { View } = jest.requireActual('react-native')
    return <View style={style}>{children}</View>
  },
}))

describe('<DailyPulseCard />', () => {
  it('renders without crashing', () => {
    const { getByText } = render(
      <DailyPulseCard prompt="What made you smile today?" onWriteAnswer={jest.fn()} />
    )
    expect(getByText(/"What made you smile today\?"/)).toBeTruthy()
  })

  it('section label is rendered and uses UPPERCASE style (textTransform: uppercase via type.label)', () => {
    const { getByText } = render(
      <DailyPulseCard prompt="What made you smile today?" onWriteAnswer={jest.fn()} />
    )
    const label = getByText(/today's reflection/i)
    expect(label).toBeTruthy()
    const flatStyle = Array.isArray(label.props.style)
      ? Object.assign({}, ...label.props.style)
      : label.props.style ?? {}
    // type.label sets textTransform: 'uppercase'
    expect(flatStyle.textTransform).toBe('uppercase')
  })

  it('renders the write answer CTA', () => {
    const { getByLabelText } = render(
      <DailyPulseCard prompt="What made you smile today?" onWriteAnswer={jest.fn()} />
    )
    expect(getByLabelText('Write your answer in the journal')).toBeTruthy()
  })
})
