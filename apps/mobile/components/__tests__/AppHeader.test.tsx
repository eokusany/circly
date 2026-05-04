import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { AppHeader } from '../AppHeader'

describe('AppHeader', () => {
  const baseProps = {
    displayName: 'Alex',
    unreadMessages: 0,
    onSOS: () => {},
    onAddSupporter: () => {},
    onMessages: () => {},
    onProfile: () => {},
  }

  it('renders the circly wordmark', () => {
    render(<AppHeader {...baseProps} />)
    expect(screen.getByText('circly')).toBeTruthy()
  })

  it('renders the user initial from displayName', () => {
    render(<AppHeader {...baseProps} />)
    expect(screen.getByText('A')).toBeTruthy()
  })

  it('shows unread badge when unreadMessages > 0', () => {
    render(<AppHeader {...baseProps} unreadMessages={3} />)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('shows 9+ badge when unreadMessages > 9', () => {
    render(<AppHeader {...baseProps} unreadMessages={15} />)
    expect(screen.getByText('9+')).toBeTruthy()
  })

  it('does not show badge when unreadMessages is 0', () => {
    render(<AppHeader {...baseProps} unreadMessages={0} />)
    expect(screen.queryByText('0')).toBeNull()
  })
})
