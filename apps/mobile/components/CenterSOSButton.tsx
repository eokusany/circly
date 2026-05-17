import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, Animated, StyleSheet, Platform } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { sos } from '../constants/theme'

interface Props {
  onArmed: () => void
}

const SIZE = 56
const RING_SIZE = 64
const RING_RADIUS = (RING_SIZE - 4) / 2 // stroke width 4
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const HOLD_MS = 1500

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export function CenterSOSButton({ onArmed }: Props) {
  const colors = useColors()
  const [pressed, setPressed] = useState(false)
  const armedRef = useRef(false)
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringProgress = useMemo(() => new Animated.Value(0), [])

  const cancelHold = useCallback(() => {
    if (armedRef.current) return
    if (armTimer.current) {
      clearTimeout(armTimer.current)
      armTimer.current = null
    }
    Animated.timing(ringProgress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start()
  }, [ringProgress])

  const startHold = useCallback(() => {
    if (armedRef.current) return
    if (armTimer.current) return
    Animated.timing(ringProgress, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
    }).start()
    armTimer.current = setTimeout(() => {
      armedRef.current = true
      armTimer.current = null
      onArmed()
      resetTimer.current = setTimeout(() => {
        armedRef.current = false
        ringProgress.setValue(0)
        resetTimer.current = null
      }, 250)
    }, HOLD_MS)
  }, [onArmed, ringProgress])

  useEffect(() => () => {
    if (armTimer.current) clearTimeout(armTimer.current)
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  const strokeDashoffset = ringProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  })

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={StyleSheet.absoluteFill}
        >
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.danger}
            strokeWidth={4}
            fill="transparent"
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.halo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="hold to alert your supporters"
            onPressIn={() => { setPressed(true); startHold() }}
            onPressOut={() => { setPressed(false); cancelHold() }}
            style={[
              styles.button,
              {
                transform: [{ scale: pressed ? 0.94 : 1 }],
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <LinearGradient
              colors={[sos.gradientStart, sos.gradientEnd]}
              start={{ x: 0.5, y: 0.2 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.gradient}
            >
              <Icon name="alert-triangle" size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]}>hold</Text>
    </View>
  )
}

const HALO_SIZE = SIZE + 8

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -20 },
  halo: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: sos.haloRing,
    alignItems: 'center',
    justifyContent: 'center',
    // iOS shadow
    shadowColor: sos.haloShadowColor,
    shadowOffset: { width: 0, height: sos.haloShadowOffsetY },
    shadowOpacity: 1,
    shadowRadius: sos.haloShadowRadius,
    // Android fallback (no color support — renders as gray drop shadow)
    elevation: Platform.OS === 'android' ? 12 : 0,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 2,
  },
})
