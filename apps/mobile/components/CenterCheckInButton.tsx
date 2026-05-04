import { Pressable, View, StyleSheet, Platform } from 'react-native'
import type { AccessibilityState } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'

interface Props {
  onPress: () => void
  accessibilityState?: AccessibilityState
}

export function CenterCheckInButton({ onPress, accessibilityState }: Props) {
  const colors = useColors()
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="check in"
        accessibilityState={accessibilityState}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.accent,
            shadowColor: colors.accent,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Icon name="check" size={24} color="#fff" />
      </Pressable>
    </View>
  )
}

const SIZE = 56

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
})
