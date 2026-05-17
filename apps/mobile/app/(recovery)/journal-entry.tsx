import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput as RNTextInput,
  Alert,
  ActivityIndicator,
  Animated,
  useColorScheme,
} from 'react-native'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { useTimeOfDay, getTimeTint } from '../../hooks/useTimeOfDay'
import { Button } from '../../components/Button'
import { BackButton } from '../../components/BackButton'
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView'
import { Icon } from '../../components/Icon'
import { MoodSlider } from '../../components/MoodSlider'
import { supabase } from '../../lib/supabase'
import { moodFromValue, valueFromTag } from '../../lib/mood'
import { tapLight, notifySuccess, notifyWarning } from '../../lib/haptics'
import { getPromptForToday } from '../../lib/prompts'
import { spacing, radii, type as t, layout } from '../../constants/theme'
import { PromptChip } from '../../components/journal/PromptChip'

export default function JournalEntryScreen() {
  const colors = useColors()
  const scheme = useColorScheme() ?? 'light'
  const user = useAuthStore((s) => s.user)
  const params = useLocalSearchParams<{ id?: string; prompt?: string }>()
  const editingId = params.id ?? null
  const incomingPrompt = params.prompt ?? null
  const timeOfDay = useTimeOfDay()
  const timeTint = getTimeTint(timeOfDay)

  const [loading, setLoading] = useState(!!editingId)
  const [saving, setSaving] = useState(false)
  const [body, setBody] = useState('')
  const [moodValue, setMoodValue] = useState(50)
  const [moodSelected, setMoodSelected] = useState(false)
  const [promptUsed, setPromptUsed] = useState<string | null>(incomingPrompt)
  const [promptDismissed, setPromptDismissed] = useState(false)

  const [showSaveCheck, setShowSaveCheck] = useState(false)

  // Animations
  const saveScale = useMemo(() => new Animated.Value(1), [])
  const saveCheckOpacity = useMemo(() => new Animated.Value(0), [])
  const deleteShake = useMemo(() => new Animated.Value(0), [])
  const promptOpacity = useMemo(() => new Animated.Value(1), [])

  const todayPrompt = getPromptForToday()

  // Reset save overlay each time screen is focused (router reuses component)
  useFocusEffect(
    useCallback(() => {
      setShowSaveCheck(false)
      saveCheckOpacity.setValue(0)
      saveScale.setValue(1)
    }, [saveCheckOpacity, saveScale])
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
      Alert.alert('Empty entry', 'Write something first')
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
      Alert.alert('Something went wrong', 'Your entry could not be saved. Please try again.')
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
      Alert.alert('Delete this entry?', 'This cannot be undone', [
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
              Alert.alert('Something went wrong', 'Your entry could not be deleted. Please try again.')
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

  // Hide the in-screen prompt card when an external prompt was passed via nav params
  const showPrompt = !editingId && !promptDismissed && !incomingPrompt

  return (
    <Animated.View style={[{ flex: 1 }, { transform: [{ scale: saveScale }] }]}>
      <KeyboardAwareScrollView
        style={[{ backgroundColor: colors.background }]}
        contentContainerStyle={styles.container}
      >
        {/* Time-of-day tint overlay */}
        {timeTint !== 'rgba(0, 0, 0, 0)' && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: timeTint, pointerEvents: 'none' }]} />
        )}

        <View style={styles.header}>
          <BackButton />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {editingId ? 'edit entry' : 'new entry'}
          </Text>
          <View style={styles.privacyHint}>
            <Icon name="lock" size={12} color={colors.textMuted} />
            <Text style={[styles.privacyText, { color: colors.textMuted }]}>
              only you can see this
            </Text>
          </View>
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
              <Text style={[styles.promptLabel, { color: colors.accent }]}>today&apos;s prompt</Text>
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

        {incomingPrompt && <PromptChip prompt={incomingPrompt} />}

        <RNTextInput
          value={body}
          onChangeText={setBody}
          placeholder="what's on your mind?"
          placeholderTextColor={colors.textMuted}
          multiline
          autoFocus={!editingId}
          keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
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
      </KeyboardAwareScrollView>

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
  title: { ...t.h1 },
  privacyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  privacyText: { fontSize: 12 },

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
