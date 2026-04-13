import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput as RNTextInput,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { useTimeOfDay, getTimeTint } from '../../hooks/useTimeOfDay'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { MoodSlider } from '../../components/MoodSlider'
import { supabase } from '../../lib/supabase'
import { moodFromValue, valueFromTag } from '../../lib/mood'
import { tapLight, notifySuccess, notifyWarning } from '../../lib/haptics'
import { getPromptForToday } from '../../lib/prompts'
import { spacing, radii, type as t, layout } from '../../constants/theme'

export default function JournalEntryScreen() {
  const colors = useColors()
  const { user } = useAuthStore()
  const params = useLocalSearchParams<{ id?: string }>()
  const editingId = params.id ?? null
  const timeOfDay = useTimeOfDay()
  const timeTint = getTimeTint(timeOfDay)

  const [loading, setLoading] = useState(!!editingId)
  const [saving, setSaving] = useState(false)
  const [body, setBody] = useState('')
  const [moodValue, setMoodValue] = useState(50)
  const [moodSelected, setMoodSelected] = useState(false)
  const [promptUsed, setPromptUsed] = useState<string | null>(null)
  const [promptDismissed, setPromptDismissed] = useState(false)

  const [showSaveCheck, setShowSaveCheck] = useState(false)

  // Animations
  const saveScale = useRef(new Animated.Value(1)).current
  const saveCheckOpacity = useRef(new Animated.Value(0)).current
  const deleteShake = useRef(new Animated.Value(0)).current
  const promptOpacity = useRef(new Animated.Value(1)).current

  const todayPrompt = getPromptForToday()

  // Reset save overlay each time screen is focused (router reuses component)
  useFocusEffect(
    useCallback(() => {
      setShowSaveCheck(false)
      saveCheckOpacity.setValue(0)
      saveScale.setValue(1)
    }, [])
  )

  useEffect(() => {
    if (!editingId || !user) return
    ;(async () => {
      const { data } = await supabase
        .from('journal_entries')
        .select('body, mood_tag, mood_value, prompt_used')
        .eq('id', editingId)
        .eq('user_id', user.id)
        .single<{ body: string; mood_tag: string | null; mood_value: number | null; prompt_used: string | null }>()

      if (data) {
        setBody(data.body)
        if (data.mood_value !== null) {
          setMoodValue(data.mood_value)
          setMoodSelected(true)
        } else if (data.mood_tag) {
          const val = valueFromTag(data.mood_tag)
          if (val !== null) {
            setMoodValue(val)
            setMoodSelected(true)
          }
        }
        if (data.prompt_used) {
          setPromptUsed(data.prompt_used)
          setPromptDismissed(true)
        }
      }
      setLoading(false)
    })()
  }, [editingId, user])

  function handleUsePrompt() {
    tapLight()
    setBody(todayPrompt + '\n\n')
    setPromptUsed(todayPrompt)
    Animated.timing(promptOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setPromptDismissed(true)
    })
  }

  function handleDismissPrompt() {
    Animated.timing(promptOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setPromptDismissed(true)
    })
  }

  async function handleSave() {
    if (!user) return
    const trimmed = body.trim()
    if (!trimmed) {
      Alert.alert('empty entry', 'write something first')
      return
    }

    setSaving(true)
    setShowSaveCheck(false)
    saveCheckOpacity.setValue(0)

    const mood = moodFromValue(moodValue)
    const payload = {
      body: trimmed,
      mood_tag: moodSelected ? mood.tag : null,
      prompt_used: promptUsed,
    }

    const clampedMood = Math.max(0, Math.min(100, Math.round(moodValue)))
    const safePayload = {
      ...payload,
      mood_value: moodSelected ? clampedMood : null,
    }

    const doSave = editingId
      ? supabase
          .from('journal_entries')
          .update(safePayload)
          .eq('id', editingId)
          .eq('user_id', user.id)
      : supabase.from('journal_entries').insert({
          ...safePayload,
          user_id: user.id,
          is_private: true,
        })

    const { error } = await doSave

    if (error) {
      setSaving(false)
      console.error('[journal] save failed:', error.message)
      Alert.alert('something went wrong', 'your entry could not be saved. please try again.')
      return
    }

    // Save animation
    setSaving(false)
    notifySuccess()
    setShowSaveCheck(true)
    Animated.parallel([
      Animated.timing(saveScale, { toValue: 0.98, duration: 150, useNativeDriver: true }),
      Animated.timing(saveCheckOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => router.back(), 300)
    })
  }

  function handleDelete() {
    if (!editingId || !user) return

    // Shake animation before showing alert
    notifyWarning()
    Animated.sequence([
      Animated.timing(deleteShake, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(deleteShake, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(deleteShake, { toValue: -2, duration: 40, useNativeDriver: true }),
      Animated.timing(deleteShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start(() => {
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
              console.error('[journal] delete failed:', error.message)
              Alert.alert('something went wrong', 'your entry could not be deleted. please try again.')
              return
            }
            router.back()
          },
        },
      ])
    })
  }

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  const showPrompt = !editingId && !promptDismissed

  return (
    <Animated.View style={[{ flex: 1 }, { transform: [{ scale: saveScale }] }]}>
      <ScrollView
        style={[{ backgroundColor: colors.background }]}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Time-of-day tint overlay */}
        {timeTint !== 'rgba(0, 0, 0, 0)' && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: timeTint, pointerEvents: 'none' }]} />
        )}

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="chevron-left" size={20} color={colors.accent} />
            <Text style={[styles.back, { color: colors.accent }]}>back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {editingId ? 'edit entry' : 'new entry'}
          </Text>
        </View>

        {/* Guided prompt */}
        {showPrompt && (
          <Animated.View
            style={[
              styles.promptCard,
              {
                backgroundColor: colors.accentSoft,
                borderColor: colors.accent,
                opacity: promptOpacity,
              },
            ]}
          >
            <View style={styles.promptHeader}>
              <Icon name="zap" size={14} color={colors.accent} />
              <Text style={[styles.promptLabel, { color: colors.accent }]}>today's prompt</Text>
              <TouchableOpacity onPress={handleDismissPrompt} hitSlop={12} style={styles.promptDismiss}>
                <Text style={[styles.promptSkip, { color: colors.textMuted }]}>skip</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.promptText, { color: colors.textPrimary }]}>
              {todayPrompt}
            </Text>
            <TouchableOpacity onPress={handleUsePrompt} style={[styles.promptBtn, { borderColor: colors.accent }]}>
              <Text style={[styles.promptBtnText, { color: colors.accent }]}>use this prompt</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

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

        {/* Mood slider */}
        <View style={styles.moodSection}>
          {!moodSelected ? (
            <TouchableOpacity
              onPress={() => { setMoodSelected(true); tapLight() }}
              style={[styles.moodToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Icon name="sun" size={16} color={colors.textSecondary} />
              <Text style={[styles.moodToggleText, { color: colors.textSecondary }]}>
                add a mood (optional)
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.moodSliderWrap}>
              <MoodSlider value={moodValue} onChange={setMoodValue} />
              <TouchableOpacity
                onPress={() => { setMoodSelected(false); tapLight() }}
                style={styles.moodClear}
              >
                <Text style={[styles.moodClearText, { color: colors.textMuted }]}>remove mood</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Button label="save entry" onPress={handleSave} loading={saving} />

        {editingId && (
          <Animated.View style={{ transform: [{ translateX: deleteShake }] }}>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteWrap}>
              <Text style={[styles.deleteText, { color: colors.danger }]}>delete entry</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* Save success overlay — only rendered after save succeeds */}
      {showSaveCheck && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.saveOverlay,
            { opacity: saveCheckOpacity },
          ]}
        >
          <View style={[styles.saveCheck, { backgroundColor: colors.successSoft }]}>
            <Icon name="check" size={32} color={colors.success} />
          </View>
        </Animated.View>
      )}
    </Animated.View>
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

  promptCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  promptLabel: { ...t.label, flex: 1 },
  promptDismiss: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  promptSkip: { ...t.small, fontWeight: '600' },
  promptText: { ...t.body, lineHeight: 24 },
  promptBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  promptBtnText: { ...t.smallStrong },

  bodyInput: {
    minHeight: 200,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },

  moodSection: {},
  moodToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  moodToggleText: { ...t.body },
  moodSliderWrap: { gap: spacing.sm },
  moodClear: { alignSelf: 'center', padding: spacing.xs },
  moodClearText: { ...t.small },

  deleteWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  deleteText: { ...t.smallStrong },

  saveOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCheck: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
