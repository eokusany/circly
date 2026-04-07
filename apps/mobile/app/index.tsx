import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'

export default function SplashScreen() {
  const colors = useColors()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.logoContainer}>
        <Text style={[styles.logoText, { color: colors.accent }]}>reeco</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          recovery, together
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
})
