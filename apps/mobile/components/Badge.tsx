import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'

interface Props {
  count?: number
  /** Show as a small dot without a count. */
  dot?: boolean
  color?: string
}

export function Badge({ count, dot, color }: Props) {
  const colors = useColors()
  const bg = color ?? colors.danger

  if (dot) {
    return <View style={[styles.dot, { backgroundColor: bg }]} />
  }

  if (!count || count <= 0) return null

  const label = count > 99 ? '99+' : String(count)

  return (
    <View style={[styles.badge, { backgroundColor: bg, minWidth: label.length > 1 ? 22 : 18 }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badge: {
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
})
