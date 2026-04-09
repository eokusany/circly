import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'

export default function VerifyResetScreen() {
  const colors = useColors()
  const { email } = useLocalSearchParams<{ email: string }>()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleVerify() {
    if (!email) {
      Alert.alert('Missing email', 'Please restart the reset flow.')
      return
    }
    if (!code.trim()) {
      Alert.alert('Missing code', 'Enter the code from your email.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Please re-enter the same password.')
      return
    }

    setLoading(true)

    const { error: otpError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'recovery',
    })

    if (otpError) {
      setLoading(false)
      Alert.alert('Invalid code', otpError.message)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      Alert.alert('Update failed', updateError.message)
      return
    }

    await supabase.auth.signOut()
    Alert.alert('Password updated', 'Sign in with your new password.', [
      { text: 'OK', onPress: () => router.replace('/(auth)/sign-in') },
    ])
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.accent }]}>circly</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>check your email</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          enter the code we sent to {email}
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="Reset code"
          value={code}
          onChangeText={setCode}
          placeholder="enter code"
          keyboardType="number-pad"
        />
        <TextInput
          label="New password"
          value={password}
          onChangeText={setPassword}
          placeholder="at least 8 characters"
          secureTextEntry
        />
        <TextInput
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="re-enter password"
          secureTextEntry
        />
        <Button label="update password" onPress={handleVerify} loading={loading} />
      </View>

      <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
        <Text style={[styles.link, { color: colors.textSecondary }]}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>back to sign in</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 28,
    justifyContent: 'center',
    gap: 40,
  },
  header: { gap: 8 },
  logo: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15 },
  form: { gap: 16 },
  link: { textAlign: 'center', fontSize: 14 },
})
