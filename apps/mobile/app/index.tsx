import { useEffect, useMemo } from 'react'
import { View, Image, Animated, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import { type as t, spacing } from '../constants/theme'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logo = require('../assets/logo.png')

// Branded splash shown while _layout.tsx checks the session.
// SplashScreen hides after the auth check completes and routes away.
export default function SplashBrandScreen() {
  const colors = useColors()
  const logoOpacity = useMemo(() => new Animated.Value(0), [])
  const logoScale = useMemo(() => new Animated.Value(0.9), [])
  const taglineOpacity = useMemo(() => new Animated.Value(0), [])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start()
    })
  }, [logoOpacity, logoScale, taglineOpacity])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image source={logo} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <Animated.Text
        style={[styles.tagline, { color: colors.textSecondary, opacity: taglineOpacity }]}
      >
        support that moves with you
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 180,
    height: 180,
  },
  tagline: {
    ...t.h3,
    marginTop: spacing.xl,
    letterSpacing: 0.5,
    fontWeight: '400',
  },
})
