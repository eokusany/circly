import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams, useFocusEffect, Stack } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { supabase } from '../../lib/supabase'
import { SettingRow, SettingSection } from '../../components/SettingRow'
import { Button } from '../../components/Button'
import { spacing, type, layout } from '../../constants/theme'

interface Permissions {
  check_ins: boolean
  milestones: boolean
  messages: boolean
}

interface RelationshipRow {
  id: string
  supporter_id: string
  permissions: Permissions
  users: { display_name: string } | null
}

export default function SupporterSettingsScreen() {
  const colors = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [displayName, setDisplayName] = useState('supporter')
  const [permissions, setPermissions] = useState<Permissions>({
    check_ins: true,
    milestones: true,
    messages: true,
  })

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('relationships')
      .select('id, supporter_id, permissions, users:supporter_id(display_name)')
      .eq('id', id)
      .single()

    if (error || !data) {
      setLoading(false)
      Alert.alert('could not load', 'this supporter could not be found.')
      router.back()
      return
    }

    const row = data as unknown as RelationshipRow
    setDisplayName(row.users?.display_name ?? 'supporter')
    setPermissions({
      check_ins: row.permissions?.check_ins ?? true,
      milestones: row.permissions?.milestones ?? true,
      messages: row.permissions?.messages ?? true,
    })
    setLoading(false)
  }, [id])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function togglePermission(key: keyof Permissions, value: boolean) {
    // Optimistic update — snap back on failure.
    const prev = permissions
    const next = { ...permissions, [key]: value }
    setPermissions(next)
    setSaving(true)

    const { error } = await supabase
      .from('relationships')
      .update({ permissions: next })
      .eq('id', id)

    setSaving(false)
    if (error) {
      setPermissions(prev)
      Alert.alert('could not save', error.message)
    }
  }

  function handleRemove() {
    Alert.alert(
      `remove ${displayName}?`,
      "they won't see your updates anymore. you can always invite them again.",
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true)
            const { error } = await supabase
              .from('relationships')
              .update({ status: 'removed' })
              .eq('id', id)
            setRemoving(false)
            if (error) {
              Alert.alert('could not remove', error.message)
              return
            }
            router.back()
          },
        },
      ],
    )
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: displayName,
          headerTintColor: colors.textPrimary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            what {displayName} can see
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            toggles take effect immediately. your journal is always private.
          </Text>
        </View>

        <SettingSection title="permissions">
          <SettingRow
            label="can see check-ins"
            hideChevron
            right={
              <Switch
                value={permissions.check_ins}
                onValueChange={(v) => togglePermission('check_ins', v)}
                disabled={saving}
              />
            }
          />
          <SettingRow
            label="can see milestones"
            hideChevron
            right={
              <Switch
                value={permissions.milestones}
                onValueChange={(v) => togglePermission('milestones', v)}
                disabled={saving}
              />
            }
          />
          <SettingRow
            label="can send messages"
            hideChevron
            right={
              <Switch
                value={permissions.messages}
                onValueChange={(v) => togglePermission('messages', v)}
                disabled={saving}
              />
            }
          />
        </SettingSection>

        <View style={styles.removeWrap}>
          <Button
            label={removing ? 'removing...' : 'remove supporter'}
            onPress={handleRemove}
            loading={removing}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
  },
  header: { gap: spacing.sm },
  title: { ...type.h2 },
  subtitle: { ...type.small },
  removeWrap: { marginTop: spacing.lg },
})
