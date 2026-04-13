import { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet, ViewStyle } from 'react-native'
import { useColors } from '../hooks/useColors'
import { radii, spacing } from '../constants/theme'

interface Props {
  /** Height of the skeleton card. Defaults to 80. */
  height?: number
  /** Number of skeleton cards to render. Defaults to 1. */
  count?: number
  style?: ViewStyle
}

function Shimmer({ height, style }: { height: number; style?: ViewStyle }) {
  const colors = useColors()
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        styles.card,
        { height, backgroundColor: colors.surfaceRaised, opacity },
        style,
      ]}
    >
      <View style={[styles.line, { backgroundColor: colors.border, width: '60%' }]} />
      <View style={[styles.line, { backgroundColor: colors.border, width: '90%' }]} />
      <View style={[styles.line, { backgroundColor: colors.border, width: '40%' }]} />
    </Animated.View>
  )
}

export function SkeletonCard({ height = 80, count = 1, style }: Props) {
  return (
    <View style={styles.wrap}>
      {Array.from({ length: count }, (_, i) => (
        <Shimmer key={i} height={height} style={style} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  line: {
    height: 10,
    borderRadius: 5,
  },
})
