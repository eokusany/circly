import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { tapLight } from '../../lib/haptics'
import type { UserRole } from '../../store/auth'
import { spacing, radii, type as t, layout } from '../../constants/theme'
import { COPY, DEFAULT_CONTEXT, type AppContext } from '../../lib/copy'

export default function RoleSelectScreen() {
  const colors = useColors()
  const setUser = useAuthStore((s) => s.setUser)
  const [selected, setSelected] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(false)

  // Context was stashed in auth metadata by context-select. If it's missing
  // (shouldn't happen in the normal flow, but be defensive) we fall back to
  // the default context rather than crashing. No early return — we read it
  // inside the handler so we don't need to await the session here.

  async function handleConfirm() {
    if (!selected) return

    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      setLoading(false)
      return
    }

    const displayName =
      (authUser.user_metadata?.display_name as string) ||
      authUser.email?.split('@')[0] ||
      'user'

    const context =
      ((authUser.user_metadata?.context as AppContext | undefined) ?? DEFAULT_CONTEXT)

    // Create the public.users row with role + context in one shot.
    const { error } = await supabase.from('users').insert({
      id: authUser.id,
      email: authUser.email!,
      display_name: displayName,
      role: selected,
      context,
    })

    if (error) {
      setLoading(false)
      Alert.alert('something went wrong', error.message)
      return
    }

    // Create the profiles row
    await supabase.from('profiles').insert({ user_id: authUser.id })

    setUser({
      id: authUser.id,
      email: authUser.email!,
      displayName: displayName,
      role: selected,
      context,
      sobrietyStartDate: null,
    })

    setLoading(false)

    switch (selected) {
      case 'recovery':
        // Only recovery context asks for a sobriety start date. In family
        // context, "the person at the center" goes straight to the dashboard.
        if (context === 'recovery') {
          router.replace('/(auth)/sobriety-start')
        } else {
          router.replace('/(recovery)')
        }
        break
      case 'supporter':
        router.replace('/(auth)/invite-code')
        break
    }
  }

  // Context was stashed in auth metadata by context-select. Load it on mount
  // so the role cards render in the right language. Falls back to default if
  // metadata is missing (defensive — shouldn't happen in the normal flow).
  const [activeContext, setActiveContext] = useState<AppContext>(DEFAULT_CONTEXT)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const ctx = data.user?.user_metadata?.context as AppContext | undefined
      if (ctx) setActiveContext(ctx)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const copy = COPY[activeContext]
  const roles = copy.roles

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {copy.roleSelect.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {copy.roleSelect.subtitle}
        </Text>
        <View style={[styles.privacyNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="shield" size={14} color={colors.textMuted} />
          <Text style={[styles.privacyText, { color: colors.textMuted }]}>
            your journal is always private. you control what your supporters can see.
          </Text>
        </View>
      </View>

      <View style={styles.cards}>
        {roles.map((roleValue) => {
          const role = copy.roleCopy[roleValue]
          const isSelected = selected === roleValue
          return (
            <TouchableOpacity
              key={roleValue}
              style={[
                styles.card,
                {
                  backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => { setSelected(roleValue); tapLight() }}
              activeOpacity={0.85}
            >
              <View style={[styles.iconCircle, { backgroundColor: isSelected ? colors.accent : colors.surfaceRaised }]}>
                <Icon name={role.icon} size={20} color={isSelected ? '#fff' : colors.textSecondary} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>
                  {role.label}
                </Text>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  {role.description}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <Button
        label="continue"
        onPress={handleConfirm}
        loading={loading}
        style={{ opacity: selected ? 1 : 0.4 }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: layout.screenPadding,
    paddingTop: layout.screenTopPadding,
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
    justifyContent: 'space-between',
  },
  header: { gap: spacing.md },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  privacyText: { ...t.small, flex: 1 },
  title: { ...t.h1 },
  subtitle: { ...t.body },
  cards: { gap: spacing.md },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardText: { flex: 1, gap: spacing.xs },
  cardLabel: { ...t.h3 },
  cardDescription: { ...t.small },
})
