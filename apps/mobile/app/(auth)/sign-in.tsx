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

export default function SignInScreen() {
  const colors = useColors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('missing fields', 'please enter your email and password.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      Alert.alert('sign in failed', error.message)
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
        <Image source={logo} style={styles.logoImage} resizeMode="contain" />
        <Text style={[styles.title, { color: colors.textPrimary }]}>welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {"keep going, you're doing great"}
        </Text>
      </View>

      <View style={styles.form}>
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
          placeholder="your password"
          secureTextEntry
        />
        <Button label="sign in" onPress={handleSignIn} loading={loading} />
        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={[styles.forgot, { color: colors.accent }]}>forgot password?</Text>
        </TouchableOpacity>
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
  forgot: { ...t.smallStrong, textAlign: 'center', marginTop: spacing.xs },
})
