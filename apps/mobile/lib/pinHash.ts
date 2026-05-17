import * as Crypto from 'expo-crypto'

// Salted, iterated SHA-256. The PIN itself is short (4 digits, ~13 bits) so
// hashing won't defeat a determined offline attacker, but it does prevent the
// PIN being read in plaintext from a SecureStore extraction. Defense in depth
// on top of the platform keystore.

const ITERATIONS = 1000
const SALT_BYTES = 16
const VERSION = 'v2'

async function deriveHash(pin: string, saltHex: string): Promise<string> {
  let hash = saltHex + pin
  for (let i = 0; i < ITERATIONS; i++) {
    hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      hash + saltHex,
    )
  }
  return hash
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function hashPin(pin: string): Promise<string> {
  const saltBytes = await Crypto.getRandomBytesAsync(SALT_BYTES)
  const saltHex = bytesToHex(saltBytes)
  const hash = await deriveHash(pin, saltHex)
  return `${VERSION}:${saltHex}:${hash}`
}

export function isLegacyPinStorage(stored: string): boolean {
  return !stored.startsWith(`${VERSION}:`)
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  if (isLegacyPinStorage(stored)) {
    return constantTimeEqual(pin, stored)
  }
  const parts = stored.split(':')
  if (parts.length !== 3) return false
  const [, saltHex, expectedHash] = parts
  if (!saltHex || !expectedHash) return false
  const computed = await deriveHash(pin, saltHex)
  return constantTimeEqual(computed, expectedHash)
}
