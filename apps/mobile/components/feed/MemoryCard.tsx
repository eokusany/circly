import { View, Text, StyleSheet } from 'react-native'
import { useColors } from '../../hooks/useColors'
import { Icon } from '../Icon'
import { spacing, radii, type } from '../../constants/theme'

interface MemoryCardProps {
  entryText: string
  daysAgo: number
  dayNumber: number
}

export function MemoryCard({ entryText, daysAgo, dayNumber }: MemoryCardProps) {
  const colors = useColors()
  const label = daysAgo === 7 ? 'one week ago' : daysAgo === 30 ? 'one month ago' : `${daysAgo} days ago`
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.labelRow}>
        <Icon name="calendar" size={11} color={colors.textMuted} />
        <Text style={[styles.label, { color: colors.textMuted }]}>{label} · day {dayNumber}</Text>
      </View>
      <Text style={[styles.entry, { color: colors.textSecondary }]}>"{entryText}"</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label },
  entry: { ...type.body, fontStyle: 'italic', lineHeight: 22 },
})
