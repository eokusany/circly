import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'
import { Icon } from '../../components/Icon'
import { spacing, type as t, layout } from '../../constants/theme'

export default function ChangeEmailScreen() {
  const colors = useColors()
  const { user } = useAuthStore()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!user) return
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('invalid email', 'please enter a valid email address')
      return
    }
    if (trimmed === user.email) {
      router.back()
      return
    }

    setLoading(true)
    // Supabase sends a confirmation link to the new address. The old email
    // remains active until the new one is confirmed. We don't update
    // public.users.email here — that gets synced when the auth user's email
    // change is confirmed via the email link.
    const { error } = await supabase.auth.updateUser({ email: trimmed })

    setLoading(false)
    if (error) {
      Alert.alert('something went wrong', error.message)
      return
    }

    Alert.alert(
      'check your inbox',
      `we sent a confirmation link to ${trimmed}. your email will update once you confirm it.`,
      [{ text: 'ok', onPress: () => router.back() }]
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
        <Text style={[styles.title, { color: colors.textPrimary }]}>change email</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          currently signed in as {user?.email}
        </Text>
      </View>

      <TextInput
        label="new email"
        value={email}
        onChangeText={setEmail}
        placeholder="your@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        we&apos;ll send a confirmation link to the new address. your email will only update
        once you confirm it.
      </Text>

      <Button label="send confirmation" onPress={handleSave} loading={loading} />
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
  backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  back: { ...t.smallStrong },
  title: { ...t.h1 },
  subtitle: { ...t.body },
  hint: { ...t.small, lineHeight: 18 },
})
