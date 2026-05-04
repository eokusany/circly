import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../../components/Icon'
import { spacing, radii, type } from '../../constants/theme'
import { useLayout } from '../../hooks/useLayout'
import type { IconName } from '../../components/Icon'

const OPTIONS: Array<{ role: 'recovery' | 'supporter'; label: string; description: string; icon: IconName }> = [
  {
    role: 'recovery',
    label: "I'm in recovery",
    description: 'Track your progress and stay connected with the people who care about you.',
    icon: 'trending-up',
  },
  {
    role: 'supporter',
    label: "I'm supporting someone",
    description: "Stay in the loop and show up for someone you love without overstepping.",
    icon: 'heart',
  },
]

export default function RoleSelectScreen() {
  const colors = useColors()
  const { screenTopPadding } = useLayout()
  const setRole = useAuthStore((s) => s.setRole)
  const [selected, setSelected] = useState<'recovery' | 'supporter' | null>(null)

  function handleContinue() {
    if (!selected) return
    setRole(selected)
    if (selected === 'recovery') router.push('/(auth)/sobriety-start')
    else router.push('/(auth)/invite-code')
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: screenTopPadding }]}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>what brings you here?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          This shapes your experience. You can change it later.
        </Text>
      </View>

      <View style={styles.options}>
        {OPTIONS.map(({ role, label, description, icon }) => {
          const active = selected === role
          return (
            <Pressable
              key={role}
              onPress={() => setSelected(role)}
              style={[
                styles.card,
                {
                  backgroundColor: active ? colors.accentSoft : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Icon name={icon} size={22} color={active ? colors.accent : colors.textMuted} />
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{label}</Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{description}</Text>
              </View>
            </Pressable>
          )
        })}

        <View style={[styles.privacyNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="lock" size={14} color={colors.textMuted} />
          <Text style={[type.small, { color: colors.textMuted, flex: 1 }]}>
            Your role is private. Only people you invite can see your activity.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleContinue}
        disabled={!selected}
        style={[styles.cta, { backgroundColor: colors.accent, opacity: selected ? 1 : 0.4 }]}
        accessibilityRole="button"
      >
        <Text style={[type.bodyStrong, { color: colors.background }]}>Continue</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl },
  heading: { gap: spacing.sm },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { ...type.body, lineHeight: 22 },
  options: { flex: 1, gap: spacing.md },
  card: { borderRadius: radii.xl, borderWidth: 1.5, padding: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  cardText: { flex: 1, gap: spacing.xs },
  cardTitle: { ...type.h3 },
  cardDesc: { ...type.small, lineHeight: 18 },
  privacyNote: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  cta: { borderRadius: radii.xl, paddingVertical: spacing.lg, alignItems: 'center' },
})
