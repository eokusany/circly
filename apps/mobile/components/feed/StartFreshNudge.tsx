import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { spacing, radii, type } from '../../constants/theme'

export function StartFreshNudge() {
  const colors = useColors()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.warningSoft, borderColor: colors.warning },
      ]}
    >
      <Text style={[type.h3, { color: colors.textPrimary }]}>
        need a fresh start?
      </Text>
      <Text style={[type.small, { color: colors.textSecondary }]}>
        if today wasn&apos;t a clean day, you can reset your start date. it&apos;s not a failure, it&apos;s honesty.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="start fresh"
        onPress={() => router.push('/(recovery)/start-fresh')}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.warning, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.btnText}>{'\u21bb'} start fresh</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
