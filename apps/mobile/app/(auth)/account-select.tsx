import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { BackButton } from '../../components/BackButton'
import { Icon, type IconName } from '../../components/Icon'
import { tapLight } from '../../lib/haptics'
import { spacing, radii, type as t, layout } from '../../constants/theme'
import type { AppContext, UserRole } from '../../store/auth'

type AccountKey = 'recovery' | 'daily' | 'supporter'

interface AccountOption {
  key: AccountKey
  label: string
  description: string
  icon: IconName
  role: UserRole
  context: AppContext | null
  next: '/(auth)/sobriety-start' | '/(recovery)' | '/(auth)/invite-code'
}

const OPTIONS: AccountOption[] = [
  {
    key: 'recovery',
    label: "i'm in recovery",
    description: 'track sobriety with daily check-ins',
    icon: 'sunrise',
    role: 'recovery',
    context: 'recovery',
    next: '/(auth)/sobriety-start',
  },
  {
    key: 'daily',
    label: 'i need daily support',
    description: 'check in and stay connected',
    icon: 'circle',
    role: 'recovery',
    context: 'life',
    next: '/(recovery)',
  },
  {
    key: 'supporter',
    label: "i'm here to support someone",
    description: 'show up for someone you care about',
    icon: 'heart',
    role: 'supporter',
    context: null,
    next: '/(auth)/invite-code',
  },
]

export default function AccountSelectScreen() {
  const colors = useColors()
  const setUser = useAuthStore((s) => s.setUser)
  const [selectedKey, setSelectedKey] = useState<AccountKey | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleContinue() {
    const choice = OPTIONS.find((o) => o.key === selectedKey)
    if (!choice) return

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

    const { error } = await supabase.from('users').insert({
      id: authUser.id,
      email: authUser.email!,
      display_name: displayName,
      role: choice.role,
      context: choice.context,
    })

    if (error) {
      setLoading(false)
      Alert.alert('something went wrong', error.message)
      return
    }

    await supabase.from('profiles').insert({ user_id: authUser.id })

    setUser({
      id: authUser.id,
      email: authUser.email!,
      displayName,
      role: choice.role,
      context: choice.context,
      sobrietyStartDate: null,
    })

    setLoading(false)
    router.replace(choice.next)
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <BackButton />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          who&apos;s circly for?
        </Text>
      </View>

      <View style={styles.cards}>
        {OPTIONS.map((option) => {
          const isSelected = selectedKey === option.key
          return (
            <TouchableOpacity
              key={option.key}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected }}
              activeOpacity={0.85}
              onPress={() => {
                setSelectedKey(option.key)
                tapLight()
              }}
              style={[
                styles.card,
                {
                  backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                  borderColor: isSelected ? colors.accent : 'transparent',
                },
              ]}
            >
              <View
                style={[
                  styles.iconTile,
                  {
                    backgroundColor: isSelected ? colors.accentSoft : colors.surfaceRaised,
                  },
                ]}
              >
                <Icon
                  name={option.icon}
                  size={20}
                  color={isSelected ? colors.accent : colors.textSecondary}
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>
                  {option.label}
                </Text>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  {option.description}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <Button
        label="continue"
        onPress={handleContinue}
        loading={loading}
        disabled={!selectedKey}
        style={{ opacity: selectedKey ? 1 : 0.4 }}
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
  header: {
    gap: spacing.lg,
  },
  title: {
    ...t.h1,
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    minHeight: 70,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardLabel: {
    ...t.h3,
  },
  cardDescription: {
    ...t.small,
  },
})
