import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { spacing, type as t } from '../constants/theme'

interface Props {
  user: { id: string; displayName: string; avatarUrl: string | null | undefined }
  onAvatarPress: () => void
  onMessagesPress?: () => void
  onSosPress?: () => void
  unreadMessages?: number
}

export function AppHeader({
  user,
  onAvatarPress,
  onMessagesPress,
  onSosPress,
  unreadMessages,
}: Props) {
  const colors = useColors()
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onAvatarPress}
        accessibilityRole="button"
        accessibilityLabel="open profile"
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Avatar
          userId={user.id}
          displayName={user.displayName}
          avatarUrl={user.avatarUrl}
          size={36}
        />
      </Pressable>

      <Text style={[styles.wordmark, { color: colors.accent }]}>circly</Text>

      <View style={styles.actions}>
        {onSosPress && (
          <Pressable
            onPress={onSosPress}
            accessibilityRole="button"
            accessibilityLabel="alert your supporters"
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.dangerSoft,
                borderColor: colors.danger,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Icon name="alert-triangle" size={16} color={colors.danger} />
          </Pressable>
        )}
        {onMessagesPress && (
          <Pressable
            onPress={onMessagesPress}
            accessibilityRole="button"
            accessibilityLabel="open messages"
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Icon name="message-circle" size={16} color={colors.textPrimary} />
            {unreadMessages !== undefined && unreadMessages > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Text style={styles.badgeText}>
                  {unreadMessages > 9 ? '9+' : String(unreadMessages)}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  wordmark: {
    ...t.h3,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
})
