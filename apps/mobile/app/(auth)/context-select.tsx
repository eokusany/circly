import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { spacing, radii, type as t, layout } from '../../constants/theme'
import { COPY, type AppContext } from '../../lib/copy'

const CONTEXTS: AppContext[] = ['recovery', 'family']

export default function ContextSelectScreen() {
  const colors = useColors()
  const [selected, setSelected] = useState<AppContext | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleContinue() {
    if (!selected) return

    setLoading(true)
    // Stash the context in auth metadata. Role-select will read it and persist
    // it to public.users when the row is created. This mirrors how display_name
    // flows from sign-up through role-select.
    const { error } = await supabase.auth.updateUser({
      data: { context: selected },
    })
    setLoading(false)

    if (error) {
      Alert.alert('something went wrong', error.message)
      return
    }

    router.replace('/(auth)/role-select')
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.accent }]}>circly</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          what brings you here?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          this shapes your experience. pick the one that fits. you can switch later.
        </Text>
      </View>

      <View style={styles.cards}>
        {CONTEXTS.map((ctx) => {
          const card = COPY[ctx].contextCard
          const isSelected = selected === ctx
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
                <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>
                  {card.label}
                </Text>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  {card.description}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <Button
        label="continue"
        onPress={handleContinue}
        loading={loading}
        style={{ opacity: selected ? 1 : 0.4 }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
    justifyContent: 'space-between',
  },
  header: { gap: spacing.sm },
  logo: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
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
  cardLabel: { ...t.h3 },
  cardDescription: { ...t.small },
})
