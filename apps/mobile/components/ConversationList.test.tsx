import { render, fireEvent } from '@testing-library/react-native'
import { ActivityIndicator } from 'react-native'
import { ConversationList } from './ConversationList'
import type { ConversationRow } from '../lib/conversations'

const alice: ConversationRow = {
  id: 'c1',
  otherId: 'alice',
  otherName: 'Alice',
  lastMessageBody: 'hey there',
  lastMessageAt: '2026-04-09T10:00:00.000Z',
}

const bob: ConversationRow = {
  id: 'c2',
  otherId: 'bob',
  otherName: 'Bob',
  lastMessageBody: '',
  lastMessageAt: null,
}

describe('<ConversationList />', () => {
  it('shows a spinner when loading', () => {
    const { UNSAFE_getByType } = render(
      <ConversationList rows={[]} loading onPressRow={() => {}} />,
    )
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
  })

  it('renders the empty state when there are no conversations', () => {
    const { getByText } = render(
      <ConversationList rows={[]} onPressRow={() => {}} />,
    )
    expect(getByText('no conversations yet')).toBeTruthy()
  })

  it('renders each row with the other participant name', () => {
    const { getByText } = render(
      <ConversationList rows={[alice, bob]} onPressRow={() => {}} />,
    )
    expect(getByText('Alice')).toBeTruthy()
    expect(getByText('Bob')).toBeTruthy()
  })

  it('renders the latest message body when present', () => {
    const { getByText } = render(
      <ConversationList rows={[alice]} onPressRow={() => {}} />,
    )
    expect(getByText('hey there')).toBeTruthy()
  })

  it('renders "no messages yet" for empty conversations', () => {
    const { getByText } = render(
      <ConversationList rows={[bob]} onPressRow={() => {}} />,
    )
    expect(getByText('no messages yet')).toBeTruthy()
  })

  it('calls onPressRow with the conversation id when a row is tapped', () => {
    const onPressRow = jest.fn()
    const { getByText } = render(
      <ConversationList rows={[alice]} onPressRow={onPressRow} />,
    )
    fireEvent.press(getByText('Alice'))
    expect(onPressRow).toHaveBeenCalledWith('c1')
  })

  it('does not render the empty state when rows are present', () => {
    const { queryByText } = render(
      <ConversationList rows={[alice]} onPressRow={() => {}} />,
    )
    expect(queryByText('no conversations yet')).toBeNull()
  })

  it('hides row content while loading even if rows are provided', () => {
    const { queryByText } = render(
      <ConversationList rows={[alice]} loading onPressRow={() => {}} />,
    )
    expect(queryByText('Alice')).toBeNull()
  })
})
