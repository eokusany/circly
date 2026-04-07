import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { useAuthStore } from '../../store/auth'

export default function SponsorHome() {
  const colors = useColors()
  const { user, signOut } = useAuthStore()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.greeting, { color: colors.textPrimary }]}>
        hey, {user?.displayName ?? 'friend'} ⭐
      </Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>sponsor dashboard coming soon</Text>
      <TouchableOpacity onPress={signOut}>
        <Text style={{ color: colors.accent, marginTop: 32 }}>sign out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  greeting: { fontSize: 24, fontWeight: '700' },
  sub: { fontSize: 15, marginTop: 8 },
})
