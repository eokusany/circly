import { createContext, useContext } from 'react'
import { useColorScheme } from 'react-native'
import { Colors, type ColorScheme } from '../constants/colors'

export const ForcedSchemeContext = createContext<ColorScheme | null>(null)

export function useColors() {
  const forced = useContext(ForcedSchemeContext)
  const system = useColorScheme() ?? 'light'
  return Colors[forced ?? system]
}
