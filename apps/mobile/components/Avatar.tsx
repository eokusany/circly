import { View, Text, Image, StyleSheet } from 'react-native'
import { colorForUserId } from '../lib/alerts'

interface Props {
  userId: string
  displayName: string
  avatarUrl: string | null | undefined
  size?: number
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ userId, displayName, avatarUrl, size = 40 }: Props) {
  const radius = size / 2
  const wrapper = { width: size, height: size, borderRadius: radius }

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, wrapper]}
        accessibilityIgnoresInvertColors
      />
    )
  }

  const bg = colorForUserId(userId)
  const initials = getInitials(displayName)
  const fontSize = Math.max(10, Math.round(size * 0.4))

  return (
    <View style={[styles.fallback, wrapper, { backgroundColor: bg }]}>
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#0000',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
