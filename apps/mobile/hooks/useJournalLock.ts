import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'

const PIN_KEY = 'journal_pin'
const BIO_KEY = 'journal_biometric'
const COOLDOWN_KEY = 'journal_cooldown_until'
const FAIL_COUNT_KEY = 'journal_fail_count'

export type LockState = 'loading' | 'setup' | 'locked' | 'unlocked'

export function useJournalLock() {
  const [state, setState] = useState<LockState>('loading')
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [failCount, setFailCount] = useState(0)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)

  useEffect(() => {
    ;(async () => {
      const [pin, bioFlag, hasHardware, storedCooldown, storedFails] = await Promise.all([
        SecureStore.getItemAsync(PIN_KEY),
        SecureStore.getItemAsync(BIO_KEY),
        Platform.OS !== 'web'
          ? LocalAuthentication.hasHardwareAsync()
          : Promise.resolve(false),
        SecureStore.getItemAsync(COOLDOWN_KEY),
        SecureStore.getItemAsync(FAIL_COUNT_KEY),
      ])

      const enrolled = hasHardware
        ? await LocalAuthentication.isEnrolledAsync()
        : false

      setBiometricAvailable(enrolled)
      setBiometricEnabled(bioFlag === 'true')

      // Restore persisted cooldown state
      if (storedCooldown) {
        const until = parseInt(storedCooldown, 10)
        if (Date.now() < until) {
          setCooldownUntil(until)
        } else {
          await SecureStore.deleteItemAsync(COOLDOWN_KEY)
        }
      }
      if (storedFails) {
        setFailCount(parseInt(storedFails, 10))
      }

      if (!pin) {
        setState('setup')
      } else {
        setState('locked')
      }
    })()
  }, [])

  const savePin = useCallback(async (pin: string) => {
    await SecureStore.setItemAsync(PIN_KEY, pin)
    setState('unlocked')
  }, [])

  const checkPin = useCallback(async (attempt: string): Promise<boolean> => {
    if (cooldownUntil && Date.now() < cooldownUntil) return false

    const stored = await SecureStore.getItemAsync(PIN_KEY)
    if (attempt === stored) {
      setFailCount(0)
      setCooldownUntil(null)
      await Promise.all([
        SecureStore.deleteItemAsync(COOLDOWN_KEY),
        SecureStore.deleteItemAsync(FAIL_COUNT_KEY),
      ])
      setState('unlocked')
      return true
    }

    const newCount = failCount + 1
    setFailCount(newCount)
    await SecureStore.setItemAsync(FAIL_COUNT_KEY, newCount.toString())

    if (newCount >= 3) {
      // Escalating cooldowns: 30s after 3, 2min after 6, 5min after 9
      const multiplier = Math.floor(newCount / 3)
      const cooldownMs = Math.min(multiplier * 30_000, 300_000)
      const until = Date.now() + cooldownMs
      setCooldownUntil(until)
      await SecureStore.setItemAsync(COOLDOWN_KEY, until.toString())
    }
    return false
  }, [failCount, cooldownUntil])

  const authenticateBiometric = useCallback(async (): Promise<boolean> => {
    if (!biometricAvailable || !biometricEnabled) return false

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'unlock your journal',
      cancelLabel: 'use pin',
      disableDeviceFallback: true,
    })

    if (result.success) {
      setFailCount(0)
      setCooldownUntil(null)
      await Promise.all([
        SecureStore.deleteItemAsync(COOLDOWN_KEY),
        SecureStore.deleteItemAsync(FAIL_COUNT_KEY),
      ])
      setState('unlocked')
      return true
    }
    return false
  }, [biometricAvailable, biometricEnabled])

  const toggleBiometric = useCallback(async () => {
    const next = !biometricEnabled
    await SecureStore.setItemAsync(BIO_KEY, next ? 'true' : 'false')
    setBiometricEnabled(next)
  }, [biometricEnabled])

  const lock = useCallback(() => {
    setState('locked')
  }, [])

  const isCoolingDown = cooldownUntil !== null && Date.now() < cooldownUntil

  return {
    state,
    biometricAvailable,
    biometricEnabled,
    isCoolingDown,
    cooldownUntil,
    savePin,
    checkPin,
    authenticateBiometric,
    toggleBiometric,
    lock,
  }
}
