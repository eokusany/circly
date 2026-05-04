import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { spacing } from '../constants/theme'

interface AppHeaderProps {
  displayName: string
  unreadMessages: number
  onSOS: () => void
  onAddSupporter: () => void
  onMessages: () => void
  onProfile: () => void
}

export function AppHeader({
  displayName,
  unreadMessages,
  onSOS,
  onAddSupporter,
  onMessages,
  onProfile,
}: AppHeaderProps) {
  const colors = useColors()
  const initial = (displayName?.[0] ?? '?').toUpperCase()

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      {/* Avatar */}
      <Pressable
        onPress={onProfile}
        accessibilityLabel="Open profile"
        style={[styles.avatar, { backgroundColor: colors.accent }]}
      >
        <Text style={[styles.avatarText, { color: colors.background }]}>{initial}</Text>
      </Pressable>

      {/* Wordmark */}
      <Text style={[styles.wordmark, { color: colors.textPrimary }]}>circly</Text>

      {/* Right icons */}
      <View style={styles.icons}>
        {/* SOS */}
        <Pressable
          onPress={onSOS}
          accessibilityLabel="Get support"
          style={[styles.iconBtn, { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1 }]}
        >
          <Icon name="alert-triangle" size={16} color={colors.danger} />
        </Pressable>

        {/* Add supporter */}
        <Pressable
          onPress={onAddSupporter}
          accessibilityLabel="Add supporter"
          style={[styles.iconBtn, { backgroundColor: colors.surface }]}
        >
          <Icon name="user-plus" size={16} color={colors.textSecondary} />
        </Pressable>

        {/* Messages */}
        <Pressable
          onPress={onMessages}
          accessibilityLabel={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
          style={[styles.iconBtn, { backgroundColor: colors.surface }]}
        >
          <Icon name="message-circle" size={16} color={colors.textSecondary} />
          {unreadMessages > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.danger }]}>
              <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  wordmark: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  icons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
})
