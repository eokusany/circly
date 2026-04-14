import { useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
  Image,
} from 'react-native'
import { router } from 'expo-router'
import { useColors } from '../../hooks/useColors'
import { Button } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { spacing, type as t, layout } from '../../constants/theme'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logo = require('../../assets/logo.png')

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface Slide {
  icon: IconName | 'logo'
  title: string
  body: string
}

const SLIDES: Slide[] = [
  {
    icon: 'logo',
    title: 'hey.',
    body: "circly is for the people who show up for you, and for you to show up for them. no pressure, no performance.",
  },
  {
    icon: 'eye-off',
    title: 'your space, your rules.',
    body: "your journal is yours alone. forever. everything else, like check-ins and milestones, you decide who sees what.",
  },
  {
    icon: 'heart',
    title: "showing up is enough.",
    body: "a tap to say you're okay. a check-in when you're ready. your people don't need a paragraph. they just want to know you're there.",
  },
  {
    icon: 'bell',
    title: "we notice when you go quiet.",
    body: "if you stop showing up, circly lets your people know. you never have to ask for help. sometimes the silence says it for you.",
  },
]

export default function OnboardingScreen() {
  const colors = useColors()
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollX = useMemo(() => new Animated.Value(0), [])
  const flatListRef = useRef<FlatList>(null)

  const isLast = currentIndex === SLIDES.length - 1

  function handleNext() {
    if (isLast) {
      router.replace('/(auth)/context-select')
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 })
    }
  }

  function handleSkip() {
    router.replace('/(auth)/context-select')
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(_, i) => String(i)}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
          setCurrentIndex(idx)
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.slideContent}>
              {item.icon === 'logo' ? (
                <Image source={logo} style={styles.logoImage} resizeMode="contain" />
              ) : (
                <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
                  <Icon name={item.icon} size={32} color={colors.accent} />
                </View>
              )}
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {item.title}
              </Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                {item.body}
              </Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [
              (i - 1) * SCREEN_WIDTH,
              i * SCREEN_WIDTH,
              (i + 1) * SCREEN_WIDTH,
            ]
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [1, 1.4, 1],
              extrapolate: 'clamp',
            })
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            })
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: colors.accent,
                    opacity,
                    transform: [{ scale }],
                  },
                ]}
              />
            )
          })}
        </View>

        <Button
          label={isLast ? 'get started' : 'next'}
          onPress={handleNext}
        />

        {!isLast && (
          <Text
            onPress={handleSkip}
            style={[styles.skip, { color: colors.textMuted }]}
          >
            skip
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.screenPadding,
  },
  slideContent: {
    alignItems: 'center',
    gap: spacing.lg,
    maxWidth: 320,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...t.h1,
    textAlign: 'center',
  },
  body: {
    ...t.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  skip: {
    ...t.body,
    paddingVertical: spacing.sm,
  },
})
