import { View, Text, Pressable, StyleSheet } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { Badge } from './Badge'
import { spacing } from '../constants/theme'
import type { IconName } from './Icon'
import { useNotificationStore } from '../store/notifications'

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index',         label: 'home',        icon: 'home'  },
  { name: 'invite',        label: 'connections', icon: 'users' },
  { name: 'notifications', label: 'alerts',      icon: 'bell'  },
  { name: 'profile',       label: 'profile',     icon: 'user'  },
]

export function SupporterTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const colors = useColors()
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
    <View style={[styles.container, {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      paddingBottom: insets.bottom + spacing.sm,
    }]}>
      {TABS.map((tabDef) => {
        const route = state.routes.find((r) => r.name === tabDef.name)
        if (!route) return null
        const isFocused = state.routes[state.index].key === route.key
        const color = isFocused ? colors.accent : colors.textMuted
        const isAlerts = tabDef.name === 'notifications'

        return (
          <Pressable
            key={tabDef.name}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              })
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(tabDef.name)
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel={tabDef.label}
            accessibilityState={{ selected: isFocused }}
            style={styles.tab}
          >
            <View style={styles.iconWrap}>
              <Icon name={tabDef.icon} size={22} color={color} />
              {isAlerts && unreadCount > 0 && (
                <View style={styles.badgeWrap}>
                  <Badge count={unreadCount} />
                </View>
              )}
            </View>
            <Text style={[styles.label, { color }]}>{tabDef.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  iconWrap: {
    position: 'relative',
  },
  badgeWrap: {
    position: 'absolute',
    top: -4,
    right: -8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
