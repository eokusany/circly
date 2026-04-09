import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'
import { api, ApiError } from '../../lib/api'
import { spacing, type as t, layout } from '../../constants/theme'

export default function InviteCodeScreen() {
  const colors = useColors()
  const { user } = useAuthStore()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  function goHome() {
    const role = user?.role
    if (role === 'sponsor') {
      router.replace('/(sponsor)')
    } else {
      router.replace('/(supporter)')
    }
  }

  async function handleContinue() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length !== 6) {
      Alert.alert('invalid code', 'invite codes are 6 characters.')
      return
    }

    setLoading(true)
    try {
      await api('/api/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ code: trimmed }),
      })
      setLoading(false)
      goHome()
    } catch (err) {
      setLoading(false)
      if (err instanceof ApiError) {
        const errorCode =
          typeof err.body === 'object' && err.body !== null && 'error' in err.body
            ? (err.body as { error: string }).error
            : null
        const message =
          errorCode === 'invalid_code'
            ? "that code doesn't exist. check it and try again."
            : errorCode === 'code_expired'
              ? 'that code has expired. ask for a new one.'
              : errorCode === 'code_used'
                ? 'that code has already been used.'
                : errorCode === 'self_invite'
                  ? "you can't use your own invite code."
                  : 'something went wrong. please try again.'
        Alert.alert('could not join', message)
      } else {
        Alert.alert('could not join', 'check your connection and try again.')
      }
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          enter your invite code
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          the person who invited you should have shared a 6-character code.
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="code"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder="ABC123"
          autoCapitalize="characters"
        />
        <Button label="continue" onPress={handleContinue} loading={loading} />
      </View>

      <TouchableOpacity onPress={goHome}>
        <Text style={[styles.link, { color: colors.textSecondary }]}>
          skip for now
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    justifyContent: 'center',
    gap: layout.sectionGap,
  },
  header: { gap: spacing.sm },
  title: { ...t.h1 },
  subtitle: { ...t.body },
  form: { gap: spacing.md },
  link: { textAlign: 'center', fontSize: 14 },
})
