import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { spacing, radii, type as t, layout } from '../../constants/theme'
import { COPY, DEFAULT_CONTEXT, type AppContext } from '../../lib/copy'

const CONTEXTS: AppContext[] = ['recovery', 'family']

export default function SwitchContextScreen() {
  const colors = useColors()
  const { user, setUser } = useAuthStore()
  const currentContext = user?.context ?? DEFAULT_CONTEXT
  const [selected, setSelected] = useState<AppContext>(currentContext)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!user || selected === currentContext) {
      router.back()
      return
    }

    // Prompt for confirmation — this is a meaningful change because the
    // entire app's language shifts. Some features (like sobriety date) become
    // invisible in the new context, though the underlying data is preserved.
    Alert.alert(
      'switch context?',
      `this will change the language and features you see. your data stays safe. you can switch back any time.`,
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'switch',
          onPress: async () => {
            setLoading(true)
            const { error } = await supabase
              .from('users')
              .update({ context: selected })
              .eq('id', user.id)

            if (error) {
              setLoading(false)
              Alert.alert('something went wrong', error.message)
              return
            }

            // Also update auth metadata so role-select / re-login both see
            // the same value if they're re-entered later.
            await supabase.auth.updateUser({ data: { context: selected } })

            setUser({ ...user, context: selected })
            setLoading(false)
            router.back()
          },
        },
      ]
    )
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.accent }]}>← back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>switch context</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          pick what fits your life right now. your data stays with you either way.
        </Text>
      </View>

      <View style={styles.cards}>
        {CONTEXTS.map((ctx) => {
          const card = COPY[ctx].contextCard
          const isSelected = selected === ctx
          const isCurrent = ctx === currentContext
          return (
            <TouchableOpacity
              key={ctx}
              style={[
                styles.card,
                {
                  backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => setSelected(ctx)}
              activeOpacity={0.85}
            >
              <Text style={styles.emoji}>{card.emoji}</Text>
              <View style={styles.cardText}>
                <View style={styles.cardLabelRow}>
                  <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>
                    {card.label}
                  </Text>
                  {isCurrent && (
                    <Text style={[styles.currentTag, { color: colors.textMuted }]}>
                      current
                    </Text>
                  )}
                </View>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  {card.description}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <Button
        label={selected === currentContext ? 'no change' : 'switch'}
        onPress={handleConfirm}
        loading={loading}
        style={{ opacity: selected === currentContext ? 0.4 : 1 }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    gap: spacing.xl,
  },
  header: { gap: spacing.sm },
  back: { ...t.smallStrong, marginBottom: spacing.xs },
  title: { ...t.h1 },
  subtitle: { ...t.body },
  cards: { gap: spacing.md },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  emoji: { fontSize: 26, marginTop: 2 },
  cardText: { flex: 1, gap: spacing.xs },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardLabel: { ...t.h3 },
  currentTag: { ...t.label },
  cardDescription: { ...t.small },
})
