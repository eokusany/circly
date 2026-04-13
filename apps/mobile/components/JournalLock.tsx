import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native'
import { useColors } from '../hooks/useColors'
import { Icon } from './Icon'
import { tapLight, tapMedium, notifySuccess, notifyWarning } from '../lib/haptics'
import { spacing, radii, type as t } from '../constants/theme'
import type { LockState } from '../hooks/useJournalLock'

interface Props {
  lockState: LockState
  biometricAvailable: boolean
  biometricEnabled: boolean
  isCoolingDown: boolean
  onSavePin: (pin: string) => void
  onCheckPin: (pin: string) => Promise<boolean>
  onBiometric: () => Promise<boolean>
  onUnlockComplete: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'] as const

export function JournalLock({
  lockState,
  biometricAvailable,
  biometricEnabled,
  isCoolingDown,
  onSavePin,
  onCheckPin,
  onBiometric,
  onUnlockComplete,
}: Props) {
  const colors = useColors()
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  const lockScale = useRef(new Animated.Value(1)).current
  const lockOpacity = useRef(new Animated.Value(1)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const contentTranslate = useRef(new Animated.Value(20)).current
  const shakeAnim = useRef(new Animated.Value(0)).current

  const isSetup = lockState === 'setup'

  // Auto-trigger biometric on mount when locked
  useEffect(() => {
    if (lockState === 'locked' && biometricEnabled && biometricAvailable) {
      onBiometric().then((success) => {
        if (success) playUnlockAnimation()
      })
    }
  }, [lockState, biometricEnabled, biometricAvailable])

  function playUnlockAnimation() {
    setUnlocking(true)
    notifySuccess()

    Animated.parallel([
      Animated.sequence([
        Animated.spring(lockScale, { toValue: 1.3, useNativeDriver: true }),
        Animated.timing(lockOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(contentOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(contentTranslate, { toValue: 0, useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => {
      onUnlockComplete()
    })
  }

  function playShake() {
    notifyWarning()
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start()
  }

  async function handleDigit(digit: string) {
    if (unlocking || isCoolingDown) return

    if (digit === 'delete') {
      setPin((p) => p.slice(0, -1))
      setError('')
      return
    }

    const next = pin + digit
    if (next.length > 4) return

    tapLight()
    setPin(next)

    if (next.length === 4) {
      if (isSetup) {
        if (confirmPin === null) {
          // First entry — ask to confirm
          setConfirmPin(next)
          setPin('')
          setError('')
        } else if (next === confirmPin) {
          // Confirmed — save
          onSavePin(next)
          playUnlockAnimation()
        } else {
          // Mismatch
          setConfirmPin(null)
          setPin('')
          setError("pins didn't match. try again.")
          playShake()
        }
      } else {
        // Verify against stored PIN
        const ok = await onCheckPin(next)
        if (ok) {
          playUnlockAnimation()
        } else {
          setPin('')
          setError(isCoolingDown ? 'too many attempts. wait 30 seconds.' : 'wrong pin')
          playShake()
        }
      }
    }
  }

  if (lockState === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  const title = isSetup
    ? confirmPin !== null
      ? 'confirm your pin'
      : 'set up your journal pin'
    : 'unlock your journal'

  const subtitle = isSetup
    ? confirmPin !== null
      ? 'enter it once more'
      : 'choose a 4-digit pin to keep your journal private'
    : 'your thoughts are safe here'

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.lockHeader,
          {
            opacity: lockOpacity,
            transform: [{ scale: lockScale }],
          },
        ]}
      >
        <View style={[styles.lockCircle, { backgroundColor: colors.accentSoft }]}>
          <Icon name="lock" size={32} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i < pin.length ? colors.accent : 'transparent',
                  borderColor: i < pin.length ? colors.accent : colors.border,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : (
        <View style={styles.errorPlaceholder} />
      )}

      <View style={styles.keypad}>
        {DIGITS.map((digit, i) => {
          if (digit === '') return <View key={i} style={styles.key} />

          if (digit === 'delete') {
            return (
              <Pressable
                key={i}
                onPress={() => handleDigit('delete')}
                style={({ pressed }) => [styles.key, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Icon name="delete" size={22} color={colors.textSecondary} />
              </Pressable>
            )
          }

          return (
            <Pressable
              key={i}
              onPress={() => handleDigit(digit)}
              style={({ pressed }) => [
                styles.key,
                styles.digitKey,
                {
                  backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
                },
              ]}
            >
              <Text style={[styles.digitText, { color: colors.textPrimary }]}>
                {digit}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {!isSetup && biometricAvailable && biometricEnabled && (
        <Pressable
          onPress={async () => {
            tapMedium()
            const ok = await onBiometric()
            if (ok) playUnlockAnimation()
          }}
          style={({ pressed }) => [
            styles.biometricBtn,
            { backgroundColor: colors.accentSoft, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="smartphone" size={18} color={colors.accent} />
          <Text style={[styles.biometricText, { color: colors.accent }]}>
            use face id / touch id
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  lockHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  lockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...t.h2, textAlign: 'center' },
  subtitle: { ...t.body, textAlign: 'center' },
  dots: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  error: { ...t.small, marginBottom: spacing.md, height: 18 },
  errorPlaceholder: { height: 18, marginBottom: spacing.md },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 270,
    justifyContent: 'center',
  },
  key: {
    width: 90,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitKey: {
    borderRadius: radii.md,
  },
  digitText: {
    fontSize: 28,
    fontWeight: '500',
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    marginTop: spacing.xl,
  },
  biometricText: { ...t.bodyStrong },
})
