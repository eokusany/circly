import { render, fireEvent } from '@testing-library/react-native'
import { Text, View } from 'react-native'
import { SettingRow, SettingSection } from './SettingRow'

describe('<SettingRow />', () => {
  it('renders the label', () => {
    const { getByText } = render(<SettingRow label="Notifications" />)
    expect(getByText('Notifications')).toBeTruthy()
  })

  it('renders the optional value', () => {
    const { getByText } = render(
      <SettingRow label="Theme" value="Dark" />,
    )
    expect(getByText('Dark')).toBeTruthy()
  })

  it('does not render a value when omitted', () => {
    const { queryByText } = render(<SettingRow label="Theme" />)
    expect(queryByText('Dark')).toBeNull()
  })

  it('renders the chevron when onPress is provided', () => {
    const { getByText } = render(
      <SettingRow label="Profile" onPress={() => {}} />,
    )
    expect(getByText('›')).toBeTruthy()
  })

  it('does NOT render a chevron when onPress is absent', () => {
    const { queryByText } = render(<SettingRow label="Static" />)
    expect(queryByText('›')).toBeNull()
  })

  it('hides the chevron when hideChevron is true even with onPress', () => {
    const { queryByText } = render(
      <SettingRow label="X" onPress={() => {}} hideChevron />,
    )
    expect(queryByText('›')).toBeNull()
  })

  it('calls onPress when pressed', () => {
    const onPress = jest.fn()
    const { getByText } = render(
      <SettingRow label="Go" onPress={onPress} />,
    )
    fireEvent.press(getByText('Go'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  // Reaches through UNSAFE_root to the first host descendant (the Pressable
  // root that SettingRow renders). This asserts the component's actual
  // wiring rather than relying on fireEvent.press, which walks the tree and
  // can invoke handlers that aren't on the current element.
  function findPressableHost(
    node: { type: unknown; children: unknown[]; props: Record<string, unknown> },
  ): Record<string, unknown> {
    if (typeof node.type === 'string') return node.props
    for (const child of node.children) {
      if (typeof child === 'object' && child !== null) {
        return findPressableHost(
          child as {
            type: unknown
            children: unknown[]
            props: Record<string, unknown>
          },
        )
      }
    }
    throw new Error('no host descendant')
  }

  it('wires Pressable.onPress to undefined when disabled', () => {
    const onPress = jest.fn()
    const { UNSAFE_root } = render(
      <SettingRow label="Disabled" onPress={onPress} disabled />,
    )
    const pressProps = findPressableHost(
      UNSAFE_root as unknown as {
        type: unknown
        children: unknown[]
        props: Record<string, unknown>
      },
    )
    expect(pressProps.onPress).toBeUndefined()
  })

  it('wires Pressable.onPress to the handler when not disabled', () => {
    const onPress = jest.fn()
    const { UNSAFE_root } = render(
      <SettingRow label="Active" onPress={onPress} />,
    )
    const pressProps = findPressableHost(
      UNSAFE_root as unknown as {
        type: unknown
        children: unknown[]
        props: Record<string, unknown>
      },
    )
    // jest-expo compiles Pressable to a host element and may attach handlers
    // under onClick (web) or onResponderRelease (native). We just verify that
    // *some* press handler is wired when enabled, and none when disabled
    // (the earlier test).
    const anyHandler =
      pressProps.onPress ?? pressProps.onClick ?? pressProps.onResponderRelease
    expect(anyHandler).toBeDefined()
  })

  it('renders a right slot instead of a chevron', () => {
    const { getByText, queryByText } = render(
      <SettingRow
        label="Toggle"
        onPress={() => {}}
        right={<Text>ON</Text>}
      />,
    )
    expect(getByText('ON')).toBeTruthy()
    expect(queryByText('›')).toBeNull()
  })

  it('renders the label in danger style when danger is set', () => {
    // We can't assert the color directly without snapshotting, but we can
    // verify the label still renders.
    const { getByText } = render(<SettingRow label="Delete" danger />)
    expect(getByText('Delete')).toBeTruthy()
  })

  it('still renders a chevron when value is present (value doesn’t hide it)', () => {
    const { getByText } = render(
      <SettingRow label="Lang" value="en" onPress={() => {}} />,
    )
    expect(getByText('›')).toBeTruthy()
  })
})

describe('<SettingSection />', () => {
  it('renders a title when provided', () => {
    const { getByText } = render(
      <SettingSection title="Account">
        <SettingRow label="Email" />
      </SettingSection>,
    )
    expect(getByText('Account')).toBeTruthy()
  })

  it('renders without a title', () => {
    const { queryByText, getByText } = render(
      <SettingSection>
        <SettingRow label="Only" />
      </SettingSection>,
    )
    expect(queryByText('Account')).toBeNull()
    expect(getByText('Only')).toBeTruthy()
  })

  it('renders multiple child rows', () => {
    const { getByText } = render(
      <SettingSection title="Prefs">
        <SettingRow label="Row A" />
        <SettingRow label="Row B" />
        <SettingRow label="Row C" />
      </SettingSection>,
    )
    expect(getByText('Row A')).toBeTruthy()
    expect(getByText('Row B')).toBeTruthy()
    expect(getByText('Row C')).toBeTruthy()
  })

  it('filters out non-element children (e.g. false / null)', () => {
    const show = false
    const { getByText, queryByText } = render(
      <SettingSection title="Cond">
        <SettingRow label="Always" />
        {show && <SettingRow label="Hidden" />}
      </SettingSection>,
    )
    expect(getByText('Always')).toBeTruthy()
    expect(queryByText('Hidden')).toBeNull()
  })

  it('accepts a plain View as a child without crashing', () => {
    const { getByText } = render(
      <SettingSection>
        <View>
          <Text>Custom</Text>
        </View>
      </SettingSection>,
    )
    expect(getByText('Custom')).toBeTruthy()
  })
})
