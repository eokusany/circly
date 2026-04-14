import { useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  Animated,
  PanResponder,
} from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { moodFromValue } from '../lib/mood'
import { tapLight } from '../lib/haptics'
import { spacing, radii, type as t } from '../constants/theme'

interface Props {
  value: number
  onChange: (value: number) => void
}

const THUMB_SIZE = 44

export function MoodSlider({ value, onChange }: Props) {
  const colors = useColors()
  const trackLayoutRef = useRef({ x: 0, width: 0 })
  const [trackWidth, setTrackWidth] = useState(0)
  const lastMoodRef = useRef(moodFromValue(value).tag)
  const labelScale = useMemo(() => new Animated.Value(1), [])
  const trackRef = useRef<View>(null)
  const valueRef = useRef(value)
  valueRef.current = value // eslint-disable-line react-hooks/refs -- mutable ref sync

  function pageXToValue(pageX: number): number {
    const { x, width } = trackLayoutRef.current
    if (width <= 0) return valueRef.current
    const relativeX = pageX - x
    const ratio = Math.max(0, Math.min(1, relativeX / width))
    return Math.round(ratio * 100)
  }

  function checkBoundary(v: number) {
    const currentMood = moodFromValue(v)
    if (currentMood.tag !== lastMoodRef.current) {
      lastMoodRef.current = currentMood.tag
      tapLight()
      Animated.sequence([
        Animated.spring(labelScale, { toValue: 1.15, useNativeDriver: true }),
        Animated.spring(labelScale, { toValue: 1, useNativeDriver: true }),
      ]).start()
    }
  }

  /* eslint-disable react-hooks/refs -- PanResponder must be accessed during render */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const v = pageXToValue(evt.nativeEvent.pageX)
        onChange(v)
        checkBoundary(v)
      },
      onPanResponderMove: (evt) => {
        const v = pageXToValue(evt.nativeEvent.pageX)
        onChange(v)
        checkBoundary(v)
      },
    }),
  ).current
  /* eslint-enable react-hooks/refs */

  function handleLayout(e: LayoutChangeEvent) {
    const { width } = e.nativeEvent.layout
    setTrackWidth(width)
    // Measure absolute position for pageX calculation
    trackRef.current?.measureInWindow((x) => {
      trackLayoutRef.current = { x, width }
    })
  }

  const mood = moodFromValue(value)
  const thumbX = trackWidth > 0 ? (value / 100) * (trackWidth - THUMB_SIZE) : 0

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
        how does this feel?
      </Text>

      <View
        ref={trackRef}
        style={styles.trackWrap}
        onLayout={handleLayout}
        // eslint-disable-next-line react-hooks/refs
        {...panResponder.panHandlers}
      >
        {/* Track background */}
        <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]}>
          <View style={[styles.trackFill, { width: `${value}%` }]}>
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: radii.pill,
                  backgroundColor: colors.accent,
                  opacity: 0.25,
                },
              ]}
            />
          </View>
        </View>

        {/* Thumb */}
        {trackWidth > 0 && (
          <View
            style={[
              styles.thumb,
              {
                left: thumbX,
                backgroundColor: colors.accent,
              },
            ]}
            pointerEvents="none"
          >
            <Icon name={mood.icon} size={20} color="#fff" />
          </View>
        )}
      </View>

      {/* Mood label */}
      <Animated.View style={[styles.labelWrap, { transform: [{ scale: labelScale }] }]}>
        <Text style={[styles.moodLabel, { color: colors.accent }]}>{mood.label}</Text>
      </Animated.View>

      {/* Scale markers */}
      <View style={styles.markers}>
        <Text style={[styles.marker, { color: colors.textMuted }]}>struggling</Text>
        <Text style={[styles.marker, { color: colors.textMuted }]}>grateful</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  sectionLabel: { ...t.label },
  trackWrap: {
    height: THUMB_SIZE + 16,
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 8,
  },
  track: {
    height: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  thumb: {
    position: 'absolute',
    top: 8,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  labelWrap: {
    alignItems: 'center',
  },
  moodLabel: {
    ...t.h3,
  },
  markers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  marker: {
    ...t.label,
    fontSize: 10,
  },
})
