import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { TextInput } from '../../components/TextInput'
import { spacing, type as t, layout } from '../../constants/theme'

export default function EditNameScreen() {
  const colors = useColors()
  const { user, setUser } = useAuthStore()
  const [name, setName] = useState(user?.displayName ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!user) return
    const trimmed = name.trim()
    if (!trimmed) {
      Alert.alert('name required', 'please enter a name')
      return
    }
    if (trimmed === user.displayName) {
      router.back()
      return
    }

    setLoading(true)
    const { error } = await supabase
      .from('users')
      .update({ display_name: trimmed })
      .eq('id', user.id)

    if (error) {
      setLoading(false)
      Alert.alert('something went wrong', error.message)
      return
    }

    setUser({ ...user, displayName: trimmed })
    setLoading(false)
    router.back()
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.accent }]}>← back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>display name</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          this is how your people will see you
        </Text>
      </View>

      <TextInput
        label="name"
        value={name}
        onChangeText={setName}
        placeholder="your name"
        autoCapitalize="words"
      />

      <Button label="save" onPress={handleSave} loading={loading} />
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
  back: { ...t.smallStrong, marginBottom: spacing.xs },
  title: { ...t.h1 },
  subtitle: { ...t.body },
})
