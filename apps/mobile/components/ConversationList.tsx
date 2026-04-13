import React, { useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, FlatList, ScrollView, RefreshControl } from 'react-native'
import { useColors } from '../hooks/useColors'
import { spacing, radii, type as t } from '../constants/theme'
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
        <Text
          style={[styles.name, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {row.otherName}
        </Text>
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
        <ActivityIndicator color={colors.accent} />
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
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            no conversations yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            once someone joins your circle, you can talk here.
          </Text>
        </View>
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
