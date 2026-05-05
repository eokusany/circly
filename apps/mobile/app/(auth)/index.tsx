import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { CirclyLogo } from '../../components/CirclyLogo'
import { spacing, radii, type } from '../../constants/theme'
import { useLayout } from '../../hooks/useLayout'

export default function WelcomeScreen() {
  const colors = useColors()
  const { screenTopPadding } = useLayout()

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: screenTopPadding }]}>
      <View style={styles.center}>
        <CirclyLogo size={72} showText={false} />
        <Text style={[styles.wordmark, { color: colors.textPrimary }]}>circly</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          {`Recovery is easier when you're not alone.`}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/(auth)/sign-up')}
          style={[styles.primary, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={[type.bodyStrong, { color: colors.background }]}>Get started</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          accessibilityRole="button"
          accessibilityLabel="Sign in to existing account"
        >
          <Text style={[type.small, { color: colors.textMuted }]}>
            Already have an account?{' '}
            <Text style={{ color: colors.accent }}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  wordmark: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    ...type.body,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 24,
  },
  actions: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  primary: {
    width: '100%',
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
})
