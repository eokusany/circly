import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'

export default function SignUpScreen() {
  const colors = useColors()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (error) {
      Alert.alert('Sign up failed', error.message)
      return
    }

    if (data.user) {
      // Store name in session metadata for role-select to use
      await supabase.auth.updateUser({ data: { display_name: name.trim() } })
      router.replace('/(auth)/context-select')
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.accent }]}>circly</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>create account</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          your circle starts here
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="what should we call you?"
          autoCapitalize="words"
        />
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
          placeholder="at least 8 characters"
          secureTextEntry
        />
        <Button label="continue" onPress={handleSignUp} loading={loading} />
      </View>

      <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
        <Text style={[styles.link, { color: colors.textSecondary }]}>
          already have an account?{' '}
          <Text style={{ color: colors.accent, fontWeight: '600' }}>sign in</Text>
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
