import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'
import { BackButton } from '../../components/BackButton'
import { spacing, type as t, layout } from '../../constants/theme'

const CONFIRM_PHRASE = 'delete'

/**
 * Delete account flow.
 *
 * Calls the delete_self_account RPC (migration 005), which runs with
 * SECURITY DEFINER to delete the user's auth.users row. The FK cascade from
 * migration 001 wipes public.users, profiles, relationships, check_ins,
 * journal_entries, milestones, messages, and notifications in one shot.
 * The client then signs out to clear the now-invalid local session.
 */
export default function DeleteAccountScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!user) return
    if (confirmText.trim().toLowerCase() !== CONFIRM_PHRASE) {
      Alert.alert(
        'confirmation required',
        `please type "${CONFIRM_PHRASE}" exactly to confirm`
      )
      return
    }

    Alert.alert(
      'delete account permanently?',
      'this will remove your profile, check-ins, journals, and relationships. this cannot be undone.',
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            const { error } = await supabase.rpc('delete_self_account')

            if (error) {
              setLoading(false)
              Alert.alert('something went wrong', error.message)
              return
            }

            // The auth row is gone. Sign out to clear the local session.
            // _layout.tsx routes to sign-in via the auth listener.
            await supabase.auth.signOut()
            setUser(null)
            setLoading(false)
          },
        },
      ]
    )
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <BackButton />
        <Text style={[styles.title, { color: colors.danger }]}>delete account</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          we&apos;re sorry to see you go
        </Text>
      </View>

      <View
        style={[
          styles.warningBox,
          { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
        ]}
      >
        <Text style={[styles.warningTitle, { color: colors.danger }]}>
          this cannot be undone
        </Text>
        <Text style={[styles.warningBody, { color: colors.textPrimary }]}>
          deleting your account will permanently remove:
        </Text>
        <View style={styles.list}>
          <Text style={[styles.listItem, { color: colors.textPrimary }]}>
            • your profile and sobriety history
          </Text>
          <Text style={[styles.listItem, { color: colors.textPrimary }]}>
            • all check-ins and journal entries
          </Text>
          <Text style={[styles.listItem, { color: colors.textPrimary }]}>
            • your relationships with supporters
          </Text>
          <Text style={[styles.listItem, { color: colors.textPrimary }]}>
            • any notifications sent or received
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={[styles.prompt, { color: colors.textSecondary }]}>
          type <Text style={{ fontWeight: '700' }}>{CONFIRM_PHRASE}</Text> to confirm
        </Text>
        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={CONFIRM_PHRASE}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Button
        label="delete my account"
        onPress={handleDelete}
        loading={loading}
        style={{
          opacity: confirmText.trim().toLowerCase() === CONFIRM_PHRASE ? 1 : 0.4,
          backgroundColor: colors.danger,
        }}
      />

      <TouchableOpacity onPress={() => router.back()} style={styles.cancelWrap}>
        <Text style={[styles.cancel, { color: colors.accent }]}>nevermind, take me back</Text>
      </TouchableOpacity>
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
  title: { ...t.h1 },
  subtitle: { ...t.body },
  warningBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  warningTitle: { ...t.h3 },
  warningBody: { ...t.body },
  list: { gap: spacing.xs },
  listItem: { ...t.small, lineHeight: 20 },
  form: { gap: spacing.md },
  prompt: { ...t.body },
  cancelWrap: { alignItems: 'center', paddingVertical: spacing.md },
  cancel: { ...t.smallStrong },
})
