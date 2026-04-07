import { View, ActivityIndicator } from 'react-native'
import { useColors } from '../hooks/useColors'

// This screen is shown briefly while _layout.tsx checks the session.
// SplashScreen hides it immediately after the check completes.
export default function LoadingScreen() {
  const colors = useColors()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  )
}
