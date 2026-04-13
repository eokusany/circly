import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native'
import { Stack, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { Icon, type IconName } from '../../components/Icon'
import { api } from '../../lib/api'
import { notifySuccess } from '../../lib/haptics'
import { spacing, radii, type as t, layout } from '../../constants/theme'

interface NotificationItem {
  id: string
  type: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

const TYPE_META: Record<string, { icon: IconName; label: string; color: 'accent' | 'danger' | 'success' }> = {
  warm_ping: { icon: 'heart', label: 'warm ping', color: 'accent' },
  encouragement: { icon: 'message-circle', label: 'encouragement', color: 'accent' },
  emergency: { icon: 'alert-triangle', label: 'emergency', color: 'danger' },
  silence_nudge: { icon: 'alert-circle', label: 'silence nudge', color: 'accent' },
  milestone: { icon: 'award', label: 'milestone', color: 'success' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function notificationBody(n: NotificationItem): string {
  const p = n.payload
  const name = (p.from_display_name as string) ?? 'someone'

  switch (n.type) {
    case 'warm_ping':
      return `${name} is with you.`
    case 'encouragement':
      return `${name}: "${(p.message as string) ?? ''}"`
    case 'emergency':
      return `${name} needs support right now.`
    case 'silence_nudge': {
      const days = (p.days_since_last_signal as number) ?? 0
      return `it's been ${days} ${days === 1 ? 'day' : 'days'} since ${name} checked in.`
    }
    default:
      return 'new notification'
  }
}

export default function NotificationsScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, payload, read_at, created_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      setNotifications(data as NotificationItem[])
    }
  }, [user])

  // Reload on focus (Realtime is handled in layout)
  useFocusEffect(
    useCallback(() => { load() }, [load]),
  )

  async function markAsRead(id: string) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    )
  }

  async function handleWarmPingResponse(n: NotificationItem) {
    const forUserId = n.payload.for_user_id as string | undefined
    if (!forUserId) return
    try {
      await api('/api/warm-ping', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: forUserId }),
      })
      notifySuccess()
    } catch {
      // silent
    }
    await markAsRead(n.id)
  }

  function renderItem({ item }: { item: NotificationItem }) {
    const meta = TYPE_META[item.type] ?? { icon: 'bell' as IconName, label: 'notification', color: 'accent' as const }
    const colorKey = meta.color
    const iconColor = colors[colorKey]
    const isUnread = !item.read_at

    return (
      <Pressable
        onPress={() => { if (isUnread) markAsRead(item.id) }}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isUnread ? colors.accentSoft : colors.surface,
            borderColor: colors.border,
            borderLeftColor: iconColor,
            borderLeftWidth: 3,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: isUnread ? colors.surface : colors.surfaceRaised }]}>
          <Icon name={meta.icon} size={18} color={iconColor} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[t.body, { color: colors.textPrimary }]}>
            {notificationBody(item)}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={[t.small, { color: colors.textMuted }]}>
              {timeAgo(item.created_at)}
            </Text>
            {item.type === 'silence_nudge' && isUnread && (
              <Pressable
                onPress={() => handleWarmPingResponse(item)}
                style={[styles.actionBtn, { backgroundColor: colors.accent }]}
              >
                <Icon name="heart" size={12} color="#fff" />
                <Text style={[t.small, { color: '#fff', fontWeight: '600' }]}>send warm ping</Text>
              </Pressable>
            )}
          </View>
        </View>
        {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
      </Pressable>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            notifications
          </Text>
        </View>
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceRaised }]}>
                <Icon name="bell" size={28} color={colors.textMuted} />
              </View>
              <Text style={[t.h3, { color: colors.textPrimary, textAlign: 'center' }]}>
                all quiet
              </Text>
              <Text style={[t.small, { color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }]}>
                warm pings, encouragements, and alerts{'\n'}from your circle will show up here.
              </Text>
            </View>
          }
        />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.md,
  },
  title: { ...t.h1 },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: spacing.xs },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxxl * 2,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
})
