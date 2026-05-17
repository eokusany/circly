import { useState } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'
import { BackButton } from '../../components/BackButton'
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView'
import { spacing, type as t, layout } from '../../constants/theme'

export default function ChangePasswordScreen() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!user) return
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all fields')
      return
    }
    if (newPassword.length < 8) {
      Alert.alert('Weak password', 'New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter your new password')
      return
    }

    setLoading(true)

    // Re-authenticate with the current password to prove the user knows it.
    // Supabase's updateUser does not require the current password, so without
    // this check a stolen session token could change the password without
    // the user's knowledge.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (reauthError) {
      setLoading(false)
      Alert.alert('Incorrect password', 'Your current password is incorrect')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    setLoading(false)
    if (error) {
      Alert.alert('Something went wrong', error.message)
      return
    }

    Alert.alert('Password updated', 'Your password has been changed.', [
      { text: 'ok', onPress: () => router.back() },
    ])
  }

  return (
    <KeyboardAwareScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <BackButton />
        <Text style={[styles.title, { color: colors.textPrimary }]}>change password</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          use at least 8 characters
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="current password"
          secureTextEntry
        />
        <TextInput
          label="new password"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="at least 8 characters"
          secureTextEntry
        />
        <TextInput
          label="confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="re-enter new password"
          secureTextEntry
        />
      </View>

      <Button label="update password" onPress={handleSave} loading={loading} />
    </KeyboardAwareScrollView>
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
  form: { gap: spacing.lg },
})
