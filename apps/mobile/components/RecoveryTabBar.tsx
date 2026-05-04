import { View, Text, Pressable, StyleSheet } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { router } from 'expo-router'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { spacing } from '../constants/theme'
import type { IconName } from './Icon'

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index',         label: 'home',    icon: 'home'      },
  { name: 'journal',       label: 'journal', icon: 'book-open' },
  { name: 'notifications', label: 'alerts',  icon: 'bell'      },
  { name: 'profile',       label: 'profile', icon: 'user'      },
]

const HIDDEN = new Set(['check-in', 'journal-entry', 'settings', 'supporter-settings', 'silence-settings', 'chat'])

export function RecoveryTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useColors()

  const visibleRoutes = state.routes.filter((r) => !HIDDEN.has(r.name))
  const half = Math.floor(visibleRoutes.length / 2)
  const left = visibleRoutes.slice(0, half)
  const right = visibleRoutes.slice(half)

  function renderTab(route: typeof state.routes[0], tabDef: typeof TABS[0]) {
    const isFocused = state.routes[state.index].name === route.name
    const color = isFocused ? colors.accent : colors.textMuted

    return (
      <Pressable
        key={route.name}
        onPress={() => navigation.navigate(route.name)}
        accessibilityRole="tab"
        accessibilityLabel={tabDef.label}
        style={styles.tab}
      >
        <Icon name={tabDef.icon} size={22} color={color} />
        <Text style={[styles.label, { color }]}>{tabDef.label}</Text>
      </Pressable>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {/* Left tabs */}
      {left.map((route) => {
        const def = TABS.find((t) => t.name === route.name)!
        return renderTab(route, def)
      })}

      {/* Center check-in button */}
      <Pressable
        onPress={() => router.push('/(recovery)/check-in')}
        accessibilityLabel="Check in"
        style={styles.centerWrap}
      >
        <View style={[styles.centerBtn, { backgroundColor: colors.accent }]}>
          <Icon name="check" size={24} color={colors.background} />
        </View>
        <Text style={[styles.label, { color: colors.accent, fontWeight: '700' }]}>check in</Text>
      </Pressable>

      {/* Right tabs */}
      {right.map((route) => {
        const def = TABS.find((t) => t.name === route.name)!
        return renderTab(route, def)
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 80,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingTop: spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    marginTop: -20,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
})
