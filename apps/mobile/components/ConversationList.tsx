import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
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
}

export function ConversationList({ rows, loading, onPressRow }: Props) {
  const colors = useColors()

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (rows.length === 0) {
    return (
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
    )
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => onPressRow(row.id)}
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
      ))}
    </View>
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
