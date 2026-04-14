import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Image } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'
import { spacing, type as t } from '../../constants/theme'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logo = require('../../assets/logo.png')

export default function SignUpScreen() {
  const colors = useColors()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('missing fields', 'please fill in all fields.')
      return
    }
    if (password.length < 8) {
      Alert.alert('weak password', 'password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (error) {
      Alert.alert('sign up failed', error.message)
      return
    }

    if (data.user) {
      // Store name in session metadata for role-select to use
      await supabase.auth.updateUser({ data: { display_name: name.trim() } })
      router.replace('/(auth)/onboarding')
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Image source={logo} style={styles.logoImage} resizeMode="contain" />
        <Text style={[styles.title, { color: colors.textPrimary }]}>create account</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          your circle starts here
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="name"
          value={name}
          onChangeText={setName}
          placeholder="what should we call you?"
          autoCapitalize="words"
        />
        <TextInput
          label="email"
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
        />
        <TextInput
          label="password"
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
    padding: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xxxl,
  },
  header: { gap: spacing.sm, alignItems: 'center' },
  logoImage: {
    width: 280,
    height: 280,
    marginBottom: spacing.sm,
  },
  title: { ...t.h2 },
  subtitle: { ...t.body, textAlign: 'center' },
  form: { gap: spacing.lg },
  link: { ...t.small, textAlign: 'center' },
})
