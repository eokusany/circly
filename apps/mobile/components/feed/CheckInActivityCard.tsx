import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface CheckInActivityCardProps {
  userName: string
  userInitial: string
  status: 'sober' | 'struggling' | 'good_day'
  onEncourage: () => void
}

const STATUS_LABEL: Record<string, string> = {
  sober: 'checked in — sober',
  struggling: 'checked in — struggling',
  good_day: 'checked in — good day',
}

export function CheckInActivityCard({ userName, userInitial, status, onEncourage }: CheckInActivityCardProps) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.background }]}>{userInitial}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>{userName}</Text>
          <Text style={[type.small, { color: colors.textSecondary }]}>Today · {STATUS_LABEL[status]}</Text>
        </View>
      </View>
      <Pressable
        onPress={onEncourage}
        style={[styles.cta, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
        accessibilityLabel={`Send encouragement to ${userName}`}
      >
        <Text style={[type.small, { color: colors.textSecondary }]}>Send encouragement</Text>
        <Icon name="arrow-right" size={14} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  meta: { flex: 1, gap: 2 },
  cta: { borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
