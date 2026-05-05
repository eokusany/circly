import { render } from '@testing-library/react-native'
import { Image, Text } from 'react-native'
import { Avatar } from './Avatar'

describe('<Avatar />', () => {
  it('renders an Image when avatarUrl is provided', () => {
    const { UNSAFE_getByType, queryByText } = render(
      <Avatar userId="u1" displayName="Sam Smith" avatarUrl="https://x/y.jpg" />,
    )
    const img = UNSAFE_getByType(Image)
    expect(img.props.source).toEqual({ uri: 'https://x/y.jpg' })
    expect(queryByText('SS')).toBeNull()
  })

  it('renders initials when avatarUrl is null', () => {
    const { getByText } = render(
      <Avatar userId="u1" displayName="Sam Smith" avatarUrl={null} />,
    )
    expect(getByText('SS')).toBeTruthy()
  })

  it('uses a single initial for one-word names', () => {
    const { getByText } = render(
      <Avatar userId="u1" displayName="sam" avatarUrl={null} />,
    )
    expect(getByText('S')).toBeTruthy()
  })

  it('falls back to "?" when displayName is empty', () => {
    const { getByText } = render(
      <Avatar userId="u1" displayName="" avatarUrl={null} />,
    )
    expect(getByText('?')).toBeTruthy()
  })

  it('renders the same background color for the same userId', () => {
    const a = render(<Avatar userId="stable-id" displayName="A" avatarUrl={null} />)
    const b = render(<Avatar userId="stable-id" displayName="B" avatarUrl={null} />)
    const aColor = (a.UNSAFE_getByType(Text).parent?.props.style as { backgroundColor: string }[])
      .find?.((s) => s?.backgroundColor)?.backgroundColor
    const bColor = (b.UNSAFE_getByType(Text).parent?.props.style as { backgroundColor: string }[])
      .find?.((s) => s?.backgroundColor)?.backgroundColor
    expect(aColor).toBe(bColor)
  })

  it('respects the size prop', () => {
    const { UNSAFE_getByType } = render(
      <Avatar userId="u1" displayName="A" avatarUrl={null} size={64} />,
    )
    const txt = UNSAFE_getByType(Text)
    const wrapStyle = txt.parent?.props.style as Array<{ width?: number; height?: number; borderRadius?: number }>
    const flat = Array.isArray(wrapStyle) ? Object.assign({}, ...wrapStyle) : wrapStyle
    expect(flat.width).toBe(64)
    expect(flat.height).toBe(64)
    expect(flat.borderRadius).toBe(32)
  })
})
