import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'

export default function ForgotPasswordScreen() {
  const colors = useColors()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReset() {
    const trimmed = email.trim()
    if (!trimmed) {
      Alert.alert('Missing email', 'Please enter your email address.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed)
    setLoading(false)

    if (error) {
      Alert.alert('Reset failed', error.message)
      return
    }

    router.push({ pathname: '/(auth)/verify-reset', params: { email: trimmed } })
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.accent }]}>circly</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>reset password</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          enter your email and we&apos;ll send you a reset code
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
        />
        <Button label="send code" onPress={handleReset} loading={loading} />
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
