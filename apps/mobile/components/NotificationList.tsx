import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  RefreshControl,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../hooks/useColors'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'
import { Icon, type IconName } from './Icon'
import { SkeletonCard } from './SkeletonCard'
import { useNotificationStore } from '../store/notifications'
import { api } from '../lib/api'
import { notifySuccess } from '../lib/haptics'
import { spacing, radii, type as t, layout } from '../constants/theme'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface NotificationItem {
  id: string
  type: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

interface Section {
  title: string
  data: NotificationItem[]
}

/* ------------------------------------------------------------------ */
/*  Metadata by notification type                                     */
/* ------------------------------------------------------------------ */

const TYPE_META: Record<string, { icon: IconName; label: string; color: 'accent' | 'danger' | 'success' | 'warning' }> = {
  warm_ping: { icon: 'heart', label: 'warm ping', color: 'accent' },
  encouragement: { icon: 'message-circle', label: 'encouragement', color: 'accent' },
  emergency: { icon: 'alert-triangle', label: 'emergency', color: 'danger' },
  silence_nudge: { icon: 'alert-circle', label: 'silence nudge', color: 'warning' },
  milestone: { icon: 'award', label: 'milestone', color: 'success' },
  message: { icon: 'message-circle', label: 'message', color: 'accent' },
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

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
    case 'milestone':
      return `${name} reached a milestone!`
    case 'message':
      return `${name}: "${(p.preview as string) ?? ''}"`
    default:
      return 'new notification'
  }
}

function dateSection(iso: string): string {
  const d = new Date(iso)
  const now = new Date()

  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (isToday) return 'today'

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return 'yesterday'

  return 'earlier'
}

function groupIntoSections(items: NotificationItem[]): Section[] {
  const map = new Map<string, NotificationItem[]>()
  const order = ['today', 'yesterday', 'earlier']

  for (const item of items) {
    const key = dateSection(item.created_at)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }

  return order
    .filter((key) => map.has(key))
    .map((key) => ({ title: key, data: map.get(key)! }))
}

const SCREEN_WIDTH = Dimensions.get('window').width
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3

/* ------------------------------------------------------------------ */
/*  Swipeable card wrapper                                            */
/* ------------------------------------------------------------------ */

function SwipeableCard({
  children,
  index,
  onDismiss,
}: {
  children: React.ReactNode
  index: number
  onDismiss: () => void
}) {
  const colors = useColors()
  const entryOpacity = useMemo(() => new Animated.Value(0), [])
  const entryY = useMemo(() => new Animated.Value(12), [])
  const translateX = useMemo(() => new Animated.Value(0), [])
  useEffect(() => {
    const delay = Math.min(index * 50, 300)
    Animated.parallel([
      Animated.timing(entryOpacity, { toValue: 1, duration: 250, delay, useNativeDriver: true }),
      Animated.spring(entryY, { toValue: 0, delay, useNativeDriver: true, friction: 8 }),
    ]).start()
  }, [entryOpacity, entryY, index])

  // eslint-disable-next-line react-hooks/refs -- PanResponder must be accessed during render
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dy) < 20,
      onPanResponderMove: (_, gesture) => {
        // Only allow left swipe
        if (gesture.dx < 0) {
          translateX.setValue(gesture.dx)
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -SWIPE_THRESHOLD) {
          // Swipe out + collapse
          Animated.sequence([
            Animated.timing(translateX, {
              toValue: -SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            // Can't animate height with native driver, so we use a scale trick
          ]).start(() => {
            onDismiss()
          })
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start()
        }
      },
    }),
  ).current

  // Background that shows behind the card as you swipe
  const swipeOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  return (
    <Animated.View
      style={{
        opacity: entryOpacity,
        transform: [{ translateY: entryY }],
      }}
    >
      {/* Dismiss label behind the card */}
      <Animated.View style={[styles.swipeBehind, { opacity: swipeOpacity }]}>
        <Icon name="check" size={16} color={colors.textMuted} />
        <Text style={[t.small, { color: colors.textMuted }]}>dismiss</Text>
      </Animated.View>
      <Animated.View
        {...panResponder.panHandlers} // eslint-disable-line react-hooks/refs
        style={{ transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated empty state                                              */
/* ------------------------------------------------------------------ */

function AnimatedEmptyState({ emptyBody }: { emptyBody: string }) {
  const colors = useColors()
  const bellRotation = useMemo(() => new Animated.Value(0), [])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let cancelled = false

    const swing = () => Animated.sequence([
      Animated.timing(bellRotation, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(bellRotation, { toValue: -1, duration: 300, useNativeDriver: true }),
      Animated.timing(bellRotation, { toValue: 0.5, duration: 200, useNativeDriver: true }),
      Animated.timing(bellRotation, { toValue: -0.5, duration: 200, useNativeDriver: true }),
      Animated.timing(bellRotation, { toValue: 0, duration: 150, useNativeDriver: true }),
    ])

    const loop = () => {
      swing().start(() => {
        if (cancelled) return
        timeoutId = setTimeout(loop, 3000)
      })
    }

    loop()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      bellRotation.stopAnimation()
    }
  }, [bellRotation])

  const rotate = bellRotation.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg'],
  })

  return (
    <View style={styles.empty}>
      <Animated.View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.surfaceRaised, transform: [{ rotate }] },
        ]}
      >
        <Icon name="bell" size={28} color={colors.textMuted} />
      </Animated.View>
      <Text style={[t.h3, { color: colors.textPrimary, textAlign: 'center' }]}>
        all quiet
      </Text>
      <Text style={[t.small, { color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }]}>
        {emptyBody}
      </Text>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

interface Props {
  emptyBody: string
}

export function NotificationList({ emptyBody }: Props) {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const decrementBadge = useNotificationStore((s) => s.decrement)
  const resetBadge = useNotificationStore((s) => s.reset)
  const setBadge = useNotificationStore((s) => s.setUnreadCount)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, payload, read_at, created_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      const items = data as NotificationItem[]
      setNotifications(items)
      // Sync badge count with actual unread
      setBadge(items.filter((n) => !n.read_at).length)
    }
    setLoading(false)
  }, [user, setBadge])

  useFocusEffect(
    useCallback(() => { load() }, [load]),
  )

  const sections = useMemo(() => groupIntoSections(notifications), [notifications])
  const hasUnread = useMemo(() => notifications.some((n) => !n.read_at), [notifications])

  const markAsRead = useCallback(async (id: string) => {
    // Only decrement if this notification was actually unread
    const wasUnread = notifications.find((n) => n.id === id && !n.read_at)
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    )
    if (wasUnread) decrementBadge()
  }, [notifications, decrementBadge])

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return

    const now = new Date().toISOString()
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .in('id', unreadIds)
    setNotifications((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read_at: now } : n)),
    )
    resetBadge()
  }

  const handleAction = useCallback(async (n: NotificationItem) => {
    // Silence nudge → send warm ping back
    if (n.type === 'silence_nudge') {
      const forUserId = n.payload.for_user_id as string | undefined
      if (forUserId) {
        try {
          await api('/api/warm-ping', {
            method: 'POST',
            body: JSON.stringify({ recipient_id: forUserId }),
          })
          notifySuccess()
        } catch {
          // silent
        }
      }
      await markAsRead(n.id)
      return
    }

    // Mark as read on tap
    if (!n.read_at) markAsRead(n.id)

    // Navigate for messages
    if (n.type === 'message' && n.payload.conversation_id) {
      router.push(`/(chat)/${n.payload.conversation_id as string}`)
    }
  }, [markAsRead])

  const renderItem = useCallback(({ item, index }: { item: NotificationItem; index: number }) => {
    const meta = TYPE_META[item.type] ?? { icon: 'bell' as IconName, label: 'notification', color: 'accent' as const }
    const colorKey = meta.color
    const iconColor = colors[colorKey]
    const isUnread = !item.read_at
    const isEmergency = item.type === 'emergency'
    const isMilestone = item.type === 'milestone'

    // Type-specific background tints
    const cardBg = isEmergency && isUnread
      ? colors.dangerSoft
      : isMilestone && isUnread
        ? colors.successSoft
        : isUnread
          ? colors.accentSoft
          : colors.surface

    const cardBorder = isEmergency && isUnread
      ? colors.danger
      : isMilestone && isUnread
        ? colors.success
        : colors.border

    return (
      <SwipeableCard index={index} onDismiss={() => markAsRead(item.id)}>
        <Pressable
          onPress={() => handleAction(item)}
          accessibilityRole="button"
          accessibilityLabel={`${meta.label}: ${notificationBody(item)}`}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderLeftColor: iconColor,
              borderLeftWidth: 3,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={[
            styles.iconCircle,
            {
              backgroundColor: isEmergency && isUnread
                ? colors.danger
                : isMilestone && isUnread
                  ? colors.success
                  : isUnread ? colors.surface : colors.surfaceRaised,
            },
          ]}>
            <Icon
              name={meta.icon}
              size={18}
              color={isEmergency && isUnread ? '#fff' : isMilestone && isUnread ? '#fff' : iconColor}
            />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <Text style={[
                styles.typeLabel,
                { color: iconColor },
              ]}>
                {meta.label}
              </Text>
              <Text style={[t.small, { color: colors.textMuted }]}>
                {timeAgo(item.created_at)}
              </Text>
            </View>
            <Text
              style={[
                t.body,
                { color: colors.textPrimary },
                isUnread && { fontWeight: '500' },
              ]}
            >
              {notificationBody(item)}
            </Text>
            {item.type === 'silence_nudge' && isUnread && (
              <View style={styles.cardFooter}>
                <Pressable
                  onPress={() => handleAction(item)}
                  style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel="Send warm ping"
                >
                  <Icon name="heart" size={12} color="#fff" />
                  <Text style={[t.small, { color: '#fff', fontWeight: '600' }]}>send warm ping</Text>
                </Pressable>
              </View>
            )}
          </View>
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />}
        </Pressable>
      </SwipeableCard>
    )
  }, [colors, handleAction, markAsRead])

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {section.title}
      </Text>
      {section.title === 'today' && (
        <View style={[styles.sectionBadge, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.sectionBadgeText, { color: colors.accent }]}>
            {section.data.filter((n) => !n.read_at).length} new
          </Text>
        </View>
      )}
    </View>
  ), [colors])

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>alerts</Text>
        </View>
        <View style={styles.skeletonWrap}>
          <SkeletonCard count={4} height={80} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>alerts</Text>
        {hasUnread && (
          <Pressable
            onPress={markAllRead}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={[styles.markAllRead, { color: colors.accent }]}>mark all read</Text>
          </Pressable>
        )}
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={<AnimatedEmptyState emptyBody={emptyBody} />}
      />
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.md,
  },
  title: { ...t.h1 },
  markAllRead: { ...t.smallStrong },
  skeletonWrap: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
  },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { ...t.label },
  sectionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  sectionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  swipeBehind: {
    position: 'absolute',
    right: spacing.xl,
    top: 0,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: spacing.xs },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
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
