import { type ReactNode } from 'react'
import { Pressable, Text, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'
import { Colors } from '../../constants/colors'
import { spacing, radii } from '../../constants/theme'

const PILL_GRADIENT = ['rgba(217,167,102,0.18)', 'rgba(217,167,102,0.08)'] as const
const PILL_BORDER_COLOR = 'rgba(217,167,102,0.30)'

type RecoveryTabButtonProps = {
  focused: boolean
  icon: ReactNode
  label: string
  onPress?: BottomTabBarButtonProps['onPress']
  onLongPress?: BottomTabBarButtonProps['onLongPress']
  accessibilityState?: { selected?: boolean }
}

export function RecoveryTabButton({
  focused,
  icon,
  label,
  onPress,
  onLongPress,
  accessibilityState,
}: RecoveryTabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={accessibilityState ?? { selected: focused }}
      style={styles.tab}
    >
      {focused ? (
        <LinearGradient
          colors={PILL_GRADIENT}
          style={[styles.pill, styles.pillActive]}
        >
          {icon}
          <Text style={[styles.label, styles.labelActive]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.pill}>
          {icon}
          <Text style={[styles.label, styles.labelInactive]}>{label}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  pill: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  pillActive: {
    borderWidth: 1,
    borderColor: PILL_BORDER_COLOR,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: Colors.dark.textPrimary,
  },
  labelInactive: {
    color: Colors.dark.textSecondary,
  },
})
