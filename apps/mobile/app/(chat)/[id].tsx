import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { Icon } from '../../components/Icon'
import { api } from '../../lib/api'
import { notifySuccess } from '../../lib/haptics'
import { spacing, radii, type as t, layout } from '../../constants/theme'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const hours = d.getHours().toString().padStart(2, '0')
  const mins = d.getMinutes().toString().padStart(2, '0')
  const time = `${hours}:${mins}`

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  if (isToday) return time

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()

  if (isYesterday) return `yesterday ${time}`

  return `${d.getDate()}/${d.getMonth() + 1} ${time}`
}

export default function ChatThreadScreen() {
  const colors = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [otherName, setOtherName] = useState('')
  const flatListRef = useRef<FlatList>(null)
  const insets = useSafeAreaInsets()

  // Load conversation info + messages
  const load = useCallback(async () => {
    if (!user || !id) return

    const [convoRes, msgsRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('participant_ids')
        .eq('id', id)
        .single(),
      supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
        .limit(100),
    ])

    if (convoRes.data) {
      const pids = (convoRes.data as { participant_ids: string[] }).participant_ids
      const otherId = pids.find((p) => p !== user.id)
      if (otherId) {
        const { data: u } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', otherId)
          .single()
        if (u) setOtherName((u as { display_name: string }).display_name)
      }
    }

    if (msgsRes.data) {
      setMessages(msgsRes.data as Message[])
    }
    setLoading(false)
  }, [user, id])

  useEffect(() => {
    load()
  }, [load])

  // Realtime subscription for new messages
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => {
            // Skip if we already have this message (from optimistic update or prior event)
            if (prev.some((m) => m.id === msg.id)) return prev
            // Also skip if there's a pending version of this message (same body from same sender)
            if (prev.some((m) => m.id.startsWith('pending-') && m.sender_id === msg.sender_id && m.body === msg.body)) return prev
            return [...prev, msg]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  async function send() {
    const body = text.trim()
    if (!body || sending || !id || !user) return

    setSending(true)
    setText('')

    // Optimistic: show the message immediately
    const optimisticId = `pending-${Date.now()}`
    const optimisticMsg: Message = {
      id: optimisticId,
      conversation_id: id,
      sender_id: user.id,
      body,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const res = await api<{ ok: boolean; message: Message }>('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: id, body }),
      })
      // Replace optimistic message with the real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? res.message : m)),
      )
      notifySuccess()
    } catch (err) {
      console.warn('send message failed:', err)
      // Remove optimistic message and restore text
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setText(body)
    }
    setSending(false)
  }

  function renderMessage({ item }: { item: Message }) {
    const isMine = item.sender_id === user?.id

    return (
      <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
        <View
          style={[
            styles.bubble,
            isMine
              ? { backgroundColor: colors.accent }
              : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <Text
            style={[
              t.body,
              { color: isMine ? '#fff' : colors.textPrimary },
            ]}
          >
            {item.body}
          </Text>
          <Text
            style={[
              t.small,
              styles.timestamp,
              { color: isMine ? 'rgba(255,255,255,0.7)' : colors.textMuted },
            ]}
          >
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: otherName || 'chat',
          headerTintColor: colors.textPrimary,
          headerStyle: { backgroundColor: colors.background },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
              <Icon name="chevron-left" size={24} color={colors.textSecondary} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            onLayout={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Icon name="message-circle" size={32} color={colors.textMuted} />
                <Text style={[t.body, { color: colors.textMuted, textAlign: 'center' }]}>
                  no messages yet.{'\n'}say something.
                </Text>
              </View>
            }
          />
        )}

        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder="message..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            editable={!sending}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            hitSlop={8}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: text.trim() ? colors.accent : colors.surfaceRaised,
                opacity: pressed && text.trim() ? 0.7 : 1,
              },
            ]}
          >
            <Icon
              name="send"
              size={18}
              color={text.trim() ? '#fff' : colors.textMuted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.xs,
  },
  timestamp: {
    alignSelf: 'flex-end',
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xxxl * 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxHeight: 100,
    ...t.body,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
})
