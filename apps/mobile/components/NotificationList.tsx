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
import { Icon } from './Icon'
import { Avatar } from './Avatar'
import { SkeletonCard } from './SkeletonCard'
import { useNotificationStore } from '../store/notifications'
import { api } from '../lib/api'
import { notifySuccess } from '../lib/haptics'
import { spacing, radii, type as t, layout } from '../constants/theme'
import {
  partitionByRead,
  groupRepeats,
  formatTimeAgo,
  type AlertItem,
  type GroupedAlert,
} from '../lib/alerts'

interface Section {
  title: 'NEW' | 'EARLIER'
  data: GroupedAlert[]
}

const TYPE_LABEL: Record<string, string> = {
  warm_ping: 'warm ping',
  encouragement: 'encouragement',
  emergency: 'emergency',
  silence_nudge: 'silence nudge',
  milestone: 'milestone',
  message: 'message',
}

function typeColor(
  type: string,
  colors: ReturnType<typeof useColors>,
): string {
  switch (type) {
    case 'encouragement':
      return colors.accent
    case 'warm_ping':
      return '#4ca8a8'
    case 'message':
      return '#8b5cf6'
    case 'emergency':
      return colors.danger
    case 'milestone':
      return colors.success
    default:
      return colors.accent
  }
}

function notificationBody(n: AlertItem): string {
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

function senderInfo(n: AlertItem): { id: string; name: string; avatarUrl: string | null } {
  const p = n.payload as Record<string, unknown>
  return {
    id: (p.from_user_id as string) ?? n.id,
    name: (p.from_display_name as string) ?? 'someone',
    avatarUrl: (p.from_avatar_url as string | null) ?? null,
  }
}

const SCREEN_WIDTH = Dimensions.get('window').width
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3

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

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dy) < 20,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) translateX.setValue(gesture.dx)
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(onDismiss)
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start()
        }
      },
    }),
  ).current

  const swipeOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  return (
    <Animated.View style={{ opacity: entryOpacity, transform: [{ translateY: entryY }] }}>
      <Animated.View style={[styles.swipeBehind, { opacity: swipeOpacity }]}>
        <Icon name="check" size={16} color={colors.textMuted} />
        <Text style={[t.small, { color: colors.textMuted }]}>dismiss</Text>
      </Animated.View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}> {/* eslint-disable-line react-hooks/refs */}
        {children}
      </Animated.View>
    </Animated.View>
  )
}

function AnimatedEmptyState({ emptyBody }: { emptyBody: string }) {
  const colors = useColors()
  const bellRotation = useMemo(() => new Animated.Value(0), [])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let cancelled = false

    const swing = () => Animated.sequence([
      Animated.timing(bellRotation, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(bellRotation, { toValue: -1, duration: 300, useNativeDriver: true }),
      Animated.timing(bellRotation, { toValue: 0, duration: 200, useNativeDriver: true }),
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
      <Text style={[t.h3, { color: colors.textPrimary, textAlign: 'center' }]}>all quiet</Text>
      <Text style={[t.small, { color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }]}>
        {emptyBody}
      </Text>
    </View>
  )
}

interface Props {
  emptyBody: string
}

export function NotificationList({ emptyBody }: Props) {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const decrementBadge = useNotificationStore((s) => s.decrement)
  const resetBadge = useNotificationStore((s) => s.reset)
  const setBadge = useNotificationStore((s) => s.setUnreadCount)
  const [notifications, setNotifications] = useState<AlertItem[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
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
      const items = data as AlertItem[]
      setNotifications(items)
      setBadge(items.filter((n) => !n.read_at).length)
    }
    setLoading(false)
  }, [user, setBadge])

  useFocusEffect(
    useCallback(() => { load() }, [load]),
  )

  const sections = useMemo<Section[]>(() => {
    const { new: newer, earlier } = partitionByRead(notifications)
    const result: Section[] = []
    if (newer.length > 0) result.push({ title: 'NEW', data: groupRepeats(newer) })
    if (earlier.length > 0) result.push({ title: 'EARLIER', data: groupRepeats(earlier) })
    return result
  }, [notifications])

  const hasUnread = useMemo(() => notifications.some((n) => !n.read_at), [notifications])

  const markAsRead = useCallback(async (id: string) => {
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

  const handleAction = useCallback(async (n: AlertItem) => {
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

    if (!n.read_at) markAsRead(n.id)

    if (n.type === 'message' && n.payload.conversation_id) {
      router.push(`/(chat)/${n.payload.conversation_id as string}`)
    }
  }, [markAsRead])

  const renderItem = useCallback(({ item: g, index }: { item: GroupedAlert; index: number }) => {
    const item = g.item
    const sender = senderInfo(item)
    const color = typeColor(item.type, colors)
    const isUnread = !item.read_at
    const dimmed = !isUnread

    return (
      <SwipeableCard index={index} onDismiss={() => markAsRead(item.id)}>
        <Pressable
          onPress={() => handleAction(item)}
          accessibilityRole="button"
          accessibilityLabel={`${TYPE_LABEL[item.type] ?? 'notification'}: ${notificationBody(item)}`}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderLeftColor: dimmed ? colors.border : color,
              borderLeftWidth: 3,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={{ opacity: dimmed ? 0.55 : 1 }}>
            <Avatar
              userId={sender.id}
              displayName={sender.name}
              avatarUrl={sender.avatarUrl}
              size={36}
            />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <Text
                style={[
                  styles.senderName,
                  { color: colors.textPrimary, opacity: dimmed ? 0.55 : 1 },
                ]}
                numberOfLines={1}
              >
                {sender.name}
              </Text>
              <View style={[styles.pill, { backgroundColor: dimmed ? colors.surfaceRaised : color + '22' }]}>
                <Text style={[styles.pillText, { color: dimmed ? colors.textMuted : color }]}>
                  {TYPE_LABEL[item.type] ?? 'notification'}
                </Text>
              </View>
              <Text style={[t.small, { color: colors.textMuted }]}>
                {formatTimeAgo(item.created_at)}
              </Text>
            </View>
            <Text
              style={[
                t.body,
                { color: colors.textPrimary, opacity: dimmed ? 0.55 : 1 },
                isUnread && { fontWeight: '500' },
              ]}
            >
              {notificationBody(item)}
            </Text>
            {g.extras.length > 0 && (
              <Pressable
                onPress={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
                hitSlop={6}
                style={{ paddingTop: spacing.xs }}
                accessibilityRole="button"
                accessibilityLabel={
                  expanded[item.id]
                    ? 'collapse repeated alerts'
                    : `show ${g.extras.length} more from ${sender.name}`
                }
              >
                <Text style={[t.small, { color: colors.accent }]}>
                  {expanded[item.id]
                    ? 'show less'
                    : `+ ${g.extras.length} more from ${sender.name} \u203a`}
                </Text>
              </Pressable>
            )}
            {expanded[item.id] && g.extras.length > 0 && (
              <View style={styles.extras}>
                {g.extras.map((ex) => (
                  <Text
                    key={ex.id}
                    style={[t.small, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    · {notificationBody(ex)} · {formatTimeAgo(ex.created_at)}
                  </Text>
                ))}
              </View>
            )}
          </View>
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
        </Pressable>
      </SwipeableCard>
    )
  }, [colors, handleAction, markAsRead, expanded])

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {section.title}
      </Text>
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
        keyExtractor={(g) => g.item.id}
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
  cardBody: { flex: 1, gap: spacing.xs },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  senderName: {
    ...t.bodyStrong,
    flexShrink: 1,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'lowercase',
  },
  extras: {
    marginTop: spacing.xs,
    gap: 2,
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
