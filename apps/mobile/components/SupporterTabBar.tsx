import { View, Text, Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { Badge } from './Badge'
import { spacing, radii } from '../constants/theme'
import { Colors } from '../constants/colors'
import type { IconName } from './Icon'
import { useNotificationStore } from '../store/notifications'

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index',         label: 'home',        icon: 'home'  },
  { name: 'invite',        label: 'connections', icon: 'users' },
  { name: 'notifications', label: 'alerts',      icon: 'bell'  },
  { name: 'profile',       label: 'profile',     icon: 'user'  },
]

const PILL_GRADIENT = ['rgba(217,167,102,0.18)', 'rgba(217,167,102,0.08)'] as const
const PILL_BORDER_COLOR = 'rgba(217,167,102,0.30)'

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
            {isFocused ? (
              <LinearGradient
                colors={PILL_GRADIENT}
                style={[styles.pill, styles.pillActive]}
              >
                <View style={styles.iconWrap}>
                  <Icon name={tabDef.icon} size={22} color={Colors.dark.accent} />
                  {isAlerts && unreadCount > 0 && (
                    <View style={styles.badgeWrap}>
                      <Badge count={unreadCount} />
                    </View>
                  )}
                </View>
                <Text style={[styles.label, styles.labelActive]}>{tabDef.label}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.pill}>
                <View style={styles.iconWrap}>
                  <Icon name={tabDef.icon} size={22} color={Colors.dark.textSecondary} />
                  {isAlerts && unreadCount > 0 && (
                    <View style={styles.badgeWrap}>
                      <Badge count={unreadCount} />
                    </View>
                  )}
                </View>
                <Text style={[styles.label, styles.labelInactive]}>{tabDef.label}</Text>
              </View>
            )}
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
  labelActive: {
    color: Colors.dark.textPrimary,
  },
  labelInactive: {
    color: Colors.dark.textSecondary,
  },
})
