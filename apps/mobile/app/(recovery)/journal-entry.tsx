import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput as RNTextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { supabase } from '../../lib/supabase'
import { MOODS } from '../../lib/mood'
import { tapLight } from '../../lib/haptics'
import { spacing, radii, type as t, layout } from '../../constants/theme'

export default function JournalEntryScreen() {
  const colors = useColors()
  const { user } = useAuthStore()
  const params = useLocalSearchParams<{ id?: string }>()
  const editingId = params.id ?? null

  const [loading, setLoading] = useState(!!editingId)
  const [saving, setSaving] = useState(false)
  const [body, setBody] = useState('')
  const [moodTag, setMoodTag] = useState<string | null>(null)

  useEffect(() => {
    if (!editingId || !user) return
    ;(async () => {
      const { data } = await supabase
        .from('journal_entries')
        .select('body, mood_tag')
        .eq('id', editingId)
        .eq('user_id', user.id)
        .single<{ body: string; mood_tag: string | null }>()

      if (data) {
        setBody(data.body)
        setMoodTag(data.mood_tag)
      }
      setLoading(false)
    })()
  }, [editingId, user])

  async function handleSave() {
    if (!user) return
    const trimmed = body.trim()
    if (!trimmed) {
      Alert.alert('empty entry', 'write something first')
      return
    }

    setSaving(true)

    if (editingId) {
      const { error } = await supabase
        .from('journal_entries')
        .update({ body: trimmed, mood_tag: moodTag })
        .eq('id', editingId)
        .eq('user_id', user.id)

      setSaving(false)
      if (error) {
        Alert.alert('something went wrong', error.message)
        return
      }
    } else {
      const { error } = await supabase.from('journal_entries').insert({
        user_id: user.id,
        body: trimmed,
        mood_tag: moodTag,
        is_private: true,
      })

      setSaving(false)
      if (error) {
        Alert.alert('something went wrong', error.message)
        return
      }
    }

    router.back()
  }

  function handleDelete() {
    if (!editingId || !user) return
    Alert.alert('delete this entry?', 'this cannot be undone', [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('journal_entries')
            .delete()
            .eq('id', editingId)
            .eq('user_id', user.id)
          if (error) {
            Alert.alert('something went wrong', error.message)
            return
          }
          router.back()
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="chevron-left" size={20} color={colors.accent} />
          <Text style={[styles.back, { color: colors.accent }]}>back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {editingId ? 'edit entry' : 'new entry'}
        </Text>
      </View>

      <RNTextInput
        value={body}
        onChangeText={setBody}
        placeholder="what's on your mind?"
        placeholderTextColor={colors.textMuted}
        multiline
        autoFocus={!editingId}
        style={[
          styles.bodyInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
      />

      <View style={styles.moodSection}>
        <Text style={[styles.moodSectionLabel, { color: colors.textMuted }]}>
          how does this feel? (optional)
        </Text>
        <View style={styles.moodGrid}>
          {MOODS.map((mood) => {
            const isSelected = moodTag === mood.tag
            return (
              <TouchableOpacity
                key={mood.tag}
                activeOpacity={0.85}
                onPress={() => { setMoodTag(isSelected ? null : mood.tag); tapLight() }}
                style={[
                  styles.moodChip,
                  {
                    backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Icon name={mood.icon} size={14} color={isSelected ? colors.accent : colors.textSecondary} />
                <Text
                  style={[
                    styles.moodChipLabel,
                    { color: isSelected ? colors.accent : colors.textPrimary },
                  ]}
                >
                  {mood.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <Button label="save entry" onPress={handleSave} loading={saving} />

      {editingId && (
        <TouchableOpacity onPress={handleDelete} style={styles.deleteWrap}>
          <Text style={[styles.deleteText, { color: colors.danger }]}>delete entry</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  header: { gap: spacing.xs },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  back: { ...t.bodyStrong },
  title: { ...t.h1 },

  bodyInput: {
    minHeight: 200,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },

  moodSection: { gap: spacing.md },
  moodSectionLabel: { ...t.label },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  moodChipLabel: { fontSize: 13, fontWeight: '600' },

  deleteWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  deleteText: { ...t.smallStrong },
})
