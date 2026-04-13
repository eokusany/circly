import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'
import { Icon } from '../../components/Icon'
import { spacing, type as t, layout } from '../../constants/theme'

export default function SponsorHome() {
  const colors = useColors()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
        <Icon name="star" size={28} color={colors.accent} />
      </View>
      <Text style={[styles.greeting, { color: colors.textPrimary }]}>
        hey, {user?.displayName ?? 'friend'}
      </Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        sponsor dashboard coming soon
      </Text>
      <Pressable
        onPress={signOut}
        style={({ pressed }) => [styles.signOut, { opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={[t.bodyStrong, { color: colors.accent }]}>sign out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  greeting: { ...t.h1 },
  sub: { ...t.body, marginTop: spacing.sm },
  signOut: { marginTop: spacing.xxl },
})
