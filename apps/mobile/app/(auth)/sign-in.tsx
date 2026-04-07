import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'

export default function SignInScreen() {
  const colors = useColors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      Alert.alert('Sign in failed', error.message)
    }
    // Navigation is handled by the auth state listener in _layout.tsx
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.accent }]}>reeco</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {"keep going — you're doing great"}
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
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="your password"
          secureTextEntry
        />
        <Button label="sign in" onPress={handleSignIn} loading={loading} />
      </View>

      <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}>
        <Text style={[styles.link, { color: colors.textSecondary }]}>
          new here?{' '}
          <Text style={{ color: colors.accent, fontWeight: '600' }}>{'create an account'}</Text>
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
