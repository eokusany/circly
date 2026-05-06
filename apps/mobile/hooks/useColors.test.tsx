import React from 'react'
import { renderHook } from '@testing-library/react-native'
import * as RN from 'react-native'
import { useColors, ForcedSchemeContext } from './useColors'
import { Colors } from '../constants/colors'

let schemeSpy: jest.SpyInstance

beforeEach(() => {
  schemeSpy = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light')
})

afterEach(() => {
  schemeSpy.mockRestore()
})

it('returns dark colors when ForcedSchemeContext provides "dark"', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ForcedSchemeContext.Provider value="dark">{children}</ForcedSchemeContext.Provider>
  )
  const { result } = renderHook(() => useColors(), { wrapper })
  expect(result.current).toBe(Colors.dark)
})

it('returns light colors when ForcedSchemeContext provides "light"', () => {
  schemeSpy.mockReturnValue('dark')
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ForcedSchemeContext.Provider value="light">{children}</ForcedSchemeContext.Provider>
  )
  const { result } = renderHook(() => useColors(), { wrapper })
  expect(result.current).toBe(Colors.light)
})

it('falls back to system scheme when no ForcedSchemeContext is present', () => {
  schemeSpy.mockReturnValue('dark')
  const { result } = renderHook(() => useColors())
  expect(result.current).toBe(Colors.dark)
})

it('falls back to light when system scheme is null', () => {
  schemeSpy.mockReturnValue(null)
  const { result } = renderHook(() => useColors())
  expect(result.current).toBe(Colors.light)
})
