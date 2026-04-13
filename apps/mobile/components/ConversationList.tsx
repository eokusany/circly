import React, { useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, FlatList, ScrollView, RefreshControl } from 'react-native'
import { useColors } from '../hooks/useColors'
import { spacing, radii, type as t } from '../constants/theme'
import { SkeletonCard } from './SkeletonCard'
import { EmptyState } from './EmptyState'
import { Badge } from './Badge'
import {
  formatConversationTime,
  type ConversationRow,
} from '../lib/conversations'

interface Props {
  rows: ConversationRow[]
  loading?: boolean
  onPressRow: (id: string) => void
  header?: React.ReactElement
  refreshControl?: React.ReactElement<React.ComponentProps<typeof RefreshControl>>
}

const ConversationItem = React.memo(function ConversationItem({
  row,
  onPress,
}: {
  row: ConversationRow
  onPress: (id: string) => void
}) {
  const colors = useColors()

  return (
    <Pressable
      onPress={() => onPress(row.id)}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${row.otherName}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.rowHeader}>
        <View style={styles.nameRow}>
          {row.unread && <Badge dot />}
          <Text
            style={[styles.name, { color: colors.textPrimary }, row.unread && { fontWeight: '700' }]}
            numberOfLines={1}
          >
            {row.otherName}
          </Text>
        </View>
        <Text style={[styles.time, { color: colors.textMuted }]}>
          {formatConversationTime(row.lastMessageAt)}
        </Text>
      </View>
      <Text
        style={[styles.preview, { color: colors.textSecondary }]}
        numberOfLines={2}
      >
        {row.lastMessageBody || 'no messages yet'}
      </Text>
    </Pressable>
  )
})

export function ConversationList({ rows, loading, onPressRow, header, refreshControl }: Props) {
  const colors = useColors()

  const renderItem = useCallback(
    ({ item }: { item: ConversationRow }) => (
      <ConversationItem row={item} onPress={onPressRow} />
    ),
    [onPressRow],
  )

  const keyExtractor = useCallback((item: ConversationRow) => item.id, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <SkeletonCard count={3} height={72} />
      </View>
    )
  }

  if (rows.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={refreshControl}
        style={{ backgroundColor: colors.background }}
      >
        {header}
        <EmptyState
          icon="message-circle"
          title="no conversations yet"
          body="once someone joins your circle, you can talk here."
        />
      </ScrollView>
    )
  }

  return (
    <FlatList
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshControl={refreshControl}
      style={{ backgroundColor: colors.background }}
    />
  )
}

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xxl, alignItems: 'center' },
  list: { gap: spacing.md },
  row: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    flex: 1,
  },
  name: { ...t.h3, flex: 1 },
  time: { ...t.small },
  preview: { ...t.small },
  emptyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { ...t.h3 },
  emptyBody: { ...t.small },
})
