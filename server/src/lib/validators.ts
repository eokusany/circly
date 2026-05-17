// RFC 4122 UUID (any version, lowercase or uppercase).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

// Expo push tokens look like `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]` or
// `ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]`. The inner payload is variable.
const EXPO_PUSH_TOKEN_RE = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{16,256}\]$/

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && EXPO_PUSH_TOKEN_RE.test(value)
}
