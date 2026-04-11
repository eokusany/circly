import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { ConversationList } from '../../components/ConversationList'
import { Icon } from '../../components/Icon'
import {
  buildConversationRows,
  type ConversationRow,
  type RawConversation,
  type RawMessage,
  type RawParticipant,
} from '../../lib/conversations'
import { spacing, type as t, layout } from '../../constants/theme'

export default function ConversationsScreen() {
  const colors = useColors()
  const { user } = useAuthStore()
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // Conversations where I'm a participant. RLS restricts this to us
    // regardless of the filter — the contains() is belt-and-braces.
    const { data: convoRows } = await supabase
      .from('conversations')
      .select('id, participant_ids')
      .contains('participant_ids', [user.id])

    const conversations = (convoRows ?? []) as RawConversation[]

    if (conversations.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    const convoIds = conversations.map((c) => c.id)
    const otherIds = Array.from(
      new Set(
        conversations.flatMap((c) =>
          c.participant_ids.filter((id) => id !== user.id),
        ),
      ),
    )

    // Only fetch the most recent message per conversation. We grab a
    // small window (1 per convo) to avoid pulling entire chat histories.
    const [msgsRes, usersRes] = await Promise.all([
      supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .in('conversation_id', convoIds)
        .order('created_at', { ascending: false })
        .limit(convoIds.length * 1),
      otherIds.length > 0
        ? supabase
            .from('users')
            .select('id, display_name')
            .in('id', otherIds)
        : Promise.resolve({ data: [] as RawParticipant[] }),
    ])

    const messages = (msgsRes.data ?? []) as RawMessage[]
    const participants = (usersRes.data ?? []) as RawParticipant[]

    setRows(buildConversationRows(conversations, messages, participants, user.id))
    setLoading(false)
  }, [user])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="back"
          hitSlop={12}
        >
          <Icon name="chevron-left" size={24} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          messages
        </Text>
      </View>

      <ConversationList
        rows={rows}
        loading={loading}
        onPressRow={(id) => router.push(`/(chat)/${id}`)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: { ...t.h1 },
})
