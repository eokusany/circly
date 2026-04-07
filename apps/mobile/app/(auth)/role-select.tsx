import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import type { UserRole } from '../../store/auth'

const ROLES: { value: UserRole; label: string; description: string; emoji: string }[] = [
  {
    value: 'recovery',
    label: 'person in recovery',
    description: 'track your journey, check in daily, and stay connected with your support network',
    emoji: '🌱',
  },
  {
    value: 'supporter',
    label: 'supporter',
    description: 'show up for someone you love — see their updates and send encouragement',
    emoji: '🤝',
  },
  {
    value: 'sponsor',
    label: 'sponsor',
    description: 'guide others through their recovery with professional support',
    emoji: '⭐',
  },
]

export default function RoleSelectScreen() {
  const colors = useColors()
  const { setUser } = useAuthStore()
  const [selected, setSelected] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!selected) return

    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      setLoading(false)
      return
    }

    const displayName =
      (authUser.user_metadata?.display_name as string) ||
      authUser.email?.split('@')[0] ||
      'user'

    // Create the public.users row
    const { error } = await supabase.from('users').insert({
      id: authUser.id,
      email: authUser.email!,
      display_name: displayName,
      role: selected,
    })

    if (error) {
      setLoading(false)
      Alert.alert('Something went wrong', error.message)
      return
    }

    // Create the profiles row
    await supabase.from('profiles').insert({ user_id: authUser.id })

    setUser({
      id: authUser.id,
      email: authUser.email!,
      displayName: displayName,
      role: selected,
    })

    setLoading(false)

    switch (selected) {
      case 'recovery': router.replace('/(recovery)'); break
      case 'supporter': router.replace('/(supporter)'); break
      case 'sponsor':   router.replace('/(sponsor)'); break
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>who are you here as?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          this shapes your experience — you can only choose once
        </Text>
      </View>

      <View style={styles.cards}>
        {ROLES.map((role) => {
          const isSelected = selected === role.value
          return (
            <TouchableOpacity
              key={role.value}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                  borderWidth: isSelected ? 2 : 1.5,
                },
              ]}
              onPress={() => setSelected(role.value)}
              activeOpacity={0.85}
            >
              <Text style={styles.emoji}>{role.emoji}</Text>
              <View style={styles.cardText}>
                <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>{role.label}</Text>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  {role.description}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <Button
        label="continue"
        onPress={handleConfirm}
        loading={loading}
        style={{ opacity: selected ? 1 : 0.4 }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 28,
    gap: 32,
    paddingTop: 60,
  },
  header: { gap: 8 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  cards: { gap: 12 },
  card: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  emoji: { fontSize: 28, marginTop: 2 },
  cardText: { flex: 1, gap: 4 },
  cardLabel: { fontSize: 16, fontWeight: '600' },
  cardDescription: { fontSize: 13, lineHeight: 19 },
})
